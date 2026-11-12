import { useCallback, useEffect, useRef, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Cat, Post, api, fmt, useSeo } from './lib';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

type User = { id?: string; name: string; role: string };
type Author = { _id: string; name: string; email: string; role: string };
const local = (d?: string) => { const x = d ? new Date(d) : new Date(); return new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };

export function Admin() {
  useSeo('Team sign in', 'Admin area'); const [u, setU] = useState<User | null>(() => { try { return JSON.parse(localStorage.getItem('usr') || 'null'); } catch { return null; } });
  return <div className="wrap adm">{u ? <Dash user={u} out={() => { localStorage.clear(); setU(null); }} /> : <Login done={setU} />}</div>;
}
function Login({ done }: { done: (u: User) => void }) {
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true); setErr(''); const f = new FormData(e.currentTarget);
    try { const r = await api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email: f.get('email'), password: f.get('password') }) });
      localStorage.setItem('tok', r.token); localStorage.setItem('usr', JSON.stringify(r.user)); done(r.user); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return <form className="login" onSubmit={submit}><h1>Team sign in</h1>
    <label>Email<input name="email" type="email" required autoComplete="username" /></label>
    <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
    {err && <p className="state err" role="alert">{err}</p>}<button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button><p><Link to="/">Back to the blog</Link></p></form>;
}
function Dash({ user, out }: { user: User; out: () => void }) {
  const [posts, setPosts] = useState<Post[]>([]), [cats, setCats] = useState<Cat[]>([]), [authors, setAuthors] = useState<Author[]>([]), [edit, setEdit] = useState<string | null>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const [p, c, a] = await Promise.all([
        api<Post[]>('/admin/posts'),
        api<Cat[]>('/categories'),
        user.role === 'admin' ? api<Author[]>('/admin/authors') : Promise.resolve([])
      ]);
      setPosts(p); setCats(c); setAuthors(a);
    }
    catch (e) { setErr((e as Error).message); if (!localStorage.getItem('tok')) out(); } finally { setLoading(false); }
  }, [user.role]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  const run = async (fn: () => Promise<unknown>, ok: string) => { setErr(''); setMsg(''); try { await fn(); setMsg(ok); await load(); } catch (e) { setErr((e as Error).message); } };
  const state = (p: Post) => p.status === 'draft' ? 'Draft' : new Date(p.publishAt) > new Date() ? 'Scheduled' : 'Published';
  if (edit) return <Editor id={edit === 'new' ? null : edit} cats={cats} authors={authors} user={user} close={() => { setEdit(null); load(); }} />;
  return (<><div className="row"><h1>Posts</h1><span>Signed in as {user.name} ({user.role}) <button onClick={out}>Sign out</button></span></div>
    <button className="btn" disabled={loading} onClick={() => setEdit('new')}>New post</button>
    <div aria-live="polite">{msg && <p className="state ok">{msg}</p>}{err && <p className="state err" role="alert">{err}</p>}</div>
    {loading ? <p className="state" role="status">Loading…</p> : !posts.length ? <p className="state">No posts yet. Create your first post.</p> :
      <div className="scroll"><table><thead><tr><th>Title</th><th>Status</th><th>Category</th><th>Date</th><th>Featured</th><th>Actions</th></tr></thead><tbody>
        {posts.map(p => <tr key={p._id}><td>{p.title}</td><td>{state(p)}</td><td>{p.category?.name}</td><td>{fmt(p.publishAt)}</td>
          <td><input type="checkbox" aria-label={`Feature ${p.title}`} checked={p.featured} onChange={e => run(() => api(`/admin/posts/${p._id}`, { method: 'PUT', body: JSON.stringify({ featured: e.target.checked }) }), 'Updated')} /></td>
          <td><button onClick={() => setEdit(p._id)}>Edit</button> <button onClick={() => run(() => api(`/admin/posts/${p._id}`, { method: 'PUT', body: JSON.stringify({ status: p.status === 'draft' ? 'published' : 'draft' }) }), p.status === 'draft' ? 'Published' : 'Moved to drafts')}>{p.status === 'draft' ? 'Publish' : 'Unpublish'}</button>
            {user.role === 'admin' && <> <button onClick={() => confirm(`Delete “${p.title}”?`) && run(() => api(`/admin/posts/${p._id}`, { method: 'DELETE' }), 'Deleted')}>Delete</button></>}</td></tr>)}</tbody></table></div>}
    <Cats cats={cats} admin={user.role === 'admin'} run={run} />
    {user.role === 'admin' && <Authors authors={authors} onCreated={load} />}</>);
}
function Cats({ cats, admin, run }: { cats: Cat[]; admin: boolean; run: (f: () => Promise<unknown>, ok: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (<section aria-labelledby="cm"><h2 id="cm">Categories</h2>
    <form className="row" onSubmit={e => { e.preventDefault(); const name = ref.current!.value.trim(); if (name) { run(() => api('/admin/categories', { method: 'POST', body: JSON.stringify({ name }) }), 'Category added'); ref.current!.value = ''; } }}>
      <label className="sr" htmlFor="nc">New category name</label><input id="nc" ref={ref} maxLength={60} placeholder="New category" /><button>Add category</button></form>
    <ul className="chips">{cats.map(c => <li key={c._id}>{c.name} <button aria-label={`Rename ${c.name}`} onClick={() => { const n = prompt('New name', c.name); if (n) run(() => api(`/admin/categories/${c._id}`, { method: 'PUT', body: JSON.stringify({ name: n }) }), 'Category renamed'); }}>Rename</button>
      {admin && <button aria-label={`Delete ${c.name}`} onClick={() => confirm(`Delete ${c.name}?`) && run(() => api(`/admin/categories/${c._id}`, { method: 'DELETE' }), 'Category deleted')}>Delete</button>}</li>)}</ul></section>);
}
function Authors({ authors, onCreated }: { authors: Author[]; onCreated: () => Promise<void> }) {
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const target = e.currentTarget, form = new FormData(target);
    try {
      await api('/admin/users', { method: 'POST', body: JSON.stringify({ name: form.get('name'), email: form.get('email'), password: form.get('password'), role: 'editor' }) });
      target.reset();
      await onCreated();
    } catch (error) { setErr((error as Error).message); }
    finally { setBusy(false); }
  };
  return <section aria-labelledby="authors-heading">
    <h2 id="authors-heading">Authors</h2>
    <ul className="chips">{authors.map(author => <li key={author._id}>{author.name} ({author.role})</li>)}</ul>
    <form className="row" onSubmit={submit}>
      <label>Name<input name="name" required maxLength={100} /></label>
      <label>Email<input name="email" type="email" required /></label>
      <label>Temporary password<input name="password" type="password" minLength={10} required autoComplete="new-password" /></label>
      <button disabled={busy}>{busy ? 'Creating…' : 'Add author account'}</button>
    </form>
    {err && <p className="state err" role="alert">{err}</p>}
  </section>;
}
function Editor({ id, cats, authors, user, close }: { id: string | null; cats: Cat[]; authors: Author[]; user: User; close: () => void }) {
  const [f, setF] = useState({ title: '', slug: '', excerpt: '', content: '', image: '', category: '', tags: '', author: user.id || '', authorName: user.name, status: 'draft', publishAt: local(), featured: false, seoTitle: '', seoDescription: '' });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(!!id);
  const set = (k: string, v: string | boolean) => setF(s => ({ ...s, [k]: v }));
  useEffect(() => {
    if (id) api<Omit<Post, 'author' | 'category'> & { category?: string | { _id: string }; author?: string | { _id: string; name: string } }>(`/admin/posts/${id}`)
      .then(p => setF({
        title: p.title, slug: p.slug, excerpt: p.excerpt || '', content: p.content || '', image: p.image || '',
        category: typeof p.category === 'string' ? p.category : p.category?._id || '',
        tags: p.tags.join(', '),
        author: typeof p.author === 'string' ? p.author : p.author?._id || user.id || '',
        authorName: p.authorName || (typeof p.author === 'object' ? p.author?.name : '') || user.name,
        status: p.status, publishAt: local(p.publishAt), featured: p.featured, seoTitle: p.seoTitle || '', seoDescription: p.seoDescription || ''
      }))
      .catch(e => setErr(e.message)).finally(() => setLoading(false));
  }, [id]); // eslint-disable-line
  const up = async (file: File | undefined, cb: (url: string) => void) => {
    if (!file) return; setErr(''); const d = new FormData(); d.append('file', file);
    try { cb((await api<{ url: string }>('/admin/upload', { method: 'POST', body: d })).url); } catch (e) { setErr((e as Error).message); }
  };
  const save = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    const body = { ...f, tags: f.tags.split(',').map(t => t.trim()).filter(Boolean), publishAt: new Date(f.publishAt).toISOString() };
    try { await api(id ? `/admin/posts/${id}` : '/admin/posts', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) }); close(); } catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  if (loading) return <p className="state" role="status">Loading…</p>;
  const future = f.status === 'published' && new Date(f.publishAt) > new Date();
  return (<form className="editor" onSubmit={save}><div className="row"><h1>{id ? 'Edit post' : 'New post'}</h1><button type="button" onClick={close}>Back to posts</button></div>
    <label>Title<input required maxLength={200} value={f.title} onChange={e => set('title', e.target.value)} /></label>
    <label>URL slug<input value={f.slug} maxLength={90} placeholder="Generated from the title if empty" onChange={e => set('slug', e.target.value)} /></label>
    <label>Short description<textarea rows={2} maxLength={400} value={f.excerpt} onChange={e => set('excerpt', e.target.value)} /></label>
    <label className="article-content">Article Content
      <ReactQuill className="article-quill" theme="snow" value={f.content} onChange={value => set('content', value)} />
    </label>
    <label>Insert image into content<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => up(e.target.files?.[0], url => set('content', f.content + `<p><img src="${url}" alt="Describe the image"></p>`))} /></label>
    <label>Featured image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => up(e.target.files?.[0], url => set('image', url))} /></label>
    {f.image && <p><img src={f.image} alt="Featured image preview" width={160} /> <button type="button" onClick={() => set('image', '')}>Remove</button></p>}
    <label>Category<select value={f.category} onChange={e => set('category', e.target.value)}><option value="">Choose…</option>{cats.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
    {user.role === 'admin'
      ? <label>Author<select value={f.author} onChange={e => {
        const author = authors.find(a => a._id === e.target.value);
        setF(s => ({ ...s, author: e.target.value, authorName: author?.name || 'Editorial Team' }));
      }}>{authors.map(author => <option key={author._id} value={author._id}>{author.name} ({author.role})</option>)}</select></label>
      : <p>Author: {user.name}</p>}
    <label>Tags (comma separated)<input value={f.tags} onChange={e => set('tags', e.target.value)} /></label>
    <label>Status<select value={f.status} onChange={e => set('status', e.target.value)}><option value="draft">Draft</option><option value="published">Published</option></select></label>
    <label>Publish date and time<input type="datetime-local" value={f.publishAt} onChange={e => set('publishAt', e.target.value)} /></label>
    {future && <p className="state">This post is scheduled and will appear on the site at the time above.</p>}
    <label className="chk"><input type="checkbox" checked={f.featured} onChange={e => set('featured', e.target.checked)} /> Show as featured on the homepage</label>
    <label>SEO title<input maxLength={70} value={f.seoTitle} onChange={e => set('seoTitle', e.target.value)} /></label>
    <label>Meta description<textarea rows={2} maxLength={160} value={f.seoDescription} onChange={e => set('seoDescription', e.target.value)} /></label>
    {err && <p className="state err" role="alert">{err}</p>}<button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save post'}</button></form>);
}
