import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Cat, Post, api, fmt, useSeo } from './lib';
import { renderArticleContent } from './pages';
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
  const [filter, setFilter] = useState<'all' | 'published' | 'drafts' | 'scheduled' | 'featured'>('all'), [search, setSearch] = useState('');
  const [now, setNow] = useState(Date.now);
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
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const run = async (fn: () => Promise<unknown>, ok: string) => { setErr(''); setMsg(''); try { await fn(); setMsg(ok); await load(); } catch (e) { setErr((e as Error).message); } };
  const isScheduled = (p: Post) => p.status !== 'draft' && new Date(p.publishAt).getTime() > now;
  const state = (p: Post) => p.status === 'draft' ? 'Draft' : isScheduled(p) ? 'Scheduled' : 'Published';
  const publishedCount = posts.filter(p => p.status === 'published' && !isScheduled(p)).length;
  const draftsCount = posts.filter(p => p.status === 'draft').length;
  const scheduledCount = posts.filter(isScheduled).length;
  const query = search.trim().toLowerCase();
  const filteredPosts = posts.filter(post => {
    const matchesFilter = filter === 'all' || (filter === 'published' && post.status === 'published' && !isScheduled(post)) ||
      (filter === 'drafts' && post.status === 'draft') || (filter === 'scheduled' && isScheduled(post)) ||
      (filter === 'featured' && post.featured);
    const searchable = [post.title, post.slug, post.excerpt, post.category?.name, ...(post.tags || [])].join(' ').toLowerCase();
    return matchesFilter && (!query || searchable.includes(query));
  });
  if (edit) return <Editor id={edit === 'new' ? null : edit} cats={cats} authors={authors} user={user} close={() => { setEdit(null); load(); }} />;
  return (<><div className="row"><h1>Posts</h1><span>Signed in as {user.name} ({user.role}) <button onClick={out}>Sign out</button></span></div>
    <section className="admin-kpis" aria-label="Content overview">
      <div className="admin-kpi"><span>Total articles</span><strong>{loading ? '—' : posts.length}</strong></div>
      <div className="admin-kpi"><span>Published</span><strong>{loading ? '—' : publishedCount}</strong></div>
      <div className="admin-kpi"><span>Drafts</span><strong>{loading ? '—' : draftsCount}</strong></div>
      <div className="admin-kpi"><span>Scheduled</span><strong>{loading ? '—' : scheduledCount}</strong></div>
      <div className="admin-kpi"><span>Total categories</span><strong>{loading ? '—' : cats.length}</strong></div>
    </section>
    <button className="btn" disabled={loading} onClick={() => setEdit('new')}>New post</button>
    <div aria-live="polite">{msg && <p className="state ok">{msg}</p>}{err && <p className="state err" role="alert">{err}</p>}</div>
    {loading ? <p className="state" role="status">Loading…</p> : !posts.length ? <p className="state">No posts yet. Create your first post.</p> : <>
      <section className="admin-post-tools" aria-label="Filter posts">
        <div className="admin-filter-pills" role="group" aria-label="Post status filters">
          {([
            ['all', 'All'], ['published', 'Published'], ['drafts', 'Drafts'], ['scheduled', 'Scheduled'], ['featured', 'Featured']
          ] as const).map(([value, label]) => <button key={value} type="button" className={filter === value ? 'active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <label className="admin-post-search">Quick search<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Title, category, tag…" /></label>
      </section>
      {!filteredPosts.length ? <p className="state">No posts match these filters.</p> :
      <div className="scroll"><table><thead><tr><th>Title</th><th>Status</th><th>Category</th><th>Date</th><th>Featured</th><th>Actions</th></tr></thead><tbody>
        {filteredPosts.map(p => <tr key={p._id}><td>{p.title}</td><td>{state(p)}</td><td>{p.category?.name}</td><td>{fmt(p.publishAt)}</td>
          <td><input type="checkbox" aria-label={`Feature ${p.title}`} checked={p.featured} onChange={e => run(() => api(`/admin/posts/${p._id}`, { method: 'PUT', body: JSON.stringify({ featured: e.target.checked }) }), 'Updated')} /></td>
          <td><button onClick={() => setEdit(p._id)}>Edit</button> <button onClick={() => run(() => api(`/admin/posts/${p._id}`, { method: 'PUT', body: JSON.stringify({ status: p.status === 'draft' ? 'published' : 'draft' }) }), p.status === 'draft' ? 'Published' : 'Moved to drafts')}>{p.status === 'draft' ? 'Publish' : 'Unpublish'}</button>
            {user.role === 'admin' && <> <button onClick={() => confirm(`Delete “${p.title}”?`) && run(() => api(`/admin/posts/${p._id}`, { method: 'DELETE' }), 'Deleted')}>Delete</button></>}</td></tr>)}</tbody></table></div>}
    </>}
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

function ArticlePreview({ draft, cats }: {
  draft: { title: string; excerpt: string; content: string; image: string; category: string; tags: string; authorName: string; publishAt: string };
  cats: Cat[];
}) {
  const body = useMemo(() => renderArticleContent(draft.content), [draft.content]);
  const category = cats.find(cat => cat._id === draft.category);
  const date = new Date(draft.publishAt);
  const dateLabel = Number.isNaN(date.getTime()) ? 'Publish date not set' : fmt(date.toISOString());
  const tags = draft.tags.split(',').map(tag => tag.trim()).filter(Boolean);
  return <section className="admin-live-preview" aria-label="Live article preview">
    <p className="admin-preview-label">Live preview</p>
    <div className="post-page">
      <header className="post-header">
        {category && <span className="tag">{category.name}</span>}
        <h1>{draft.title || 'Article title preview'}</h1>
        <p className="meta">By {draft.authorName || 'Editorial Team'} · <time dateTime={draft.publishAt}>{dateLabel}</time></p>
        {draft.excerpt && <p className="preview-excerpt">{draft.excerpt}</p>}
        {tags.length > 0 && <p className="preview-tags">{tags.map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}</p>}
      </header>
      {draft.image && <img className="post-cover" src={draft.image} alt={draft.title || 'Article cover preview'} />}
      <div className={`post-layout${body.toc.length ? '' : ' preview-no-toc'}`}>
        {body.toc.length > 0 && <aside className="post-sidebar"><div className="post-sidebar-sticky">
          <nav className="toc" aria-label="Preview table of contents"><h2>In this article</h2>
            <ul>{body.toc.map(item => <li key={item.id} className={'l' + item.lvl}><a href={`#${item.id}`}>{item.text}</a></li>)}</ul>
          </nav>
        </div></aside>}
        <article className="post-content">
          <div className="article-content prose" dangerouslySetInnerHTML={{ __html: body.html || '<p>Article content preview will appear here.</p>' }} />
        </article>
      </div>
    </div>
  </section>;
}

function Editor({ id, cats, authors, user, close }: { id: string | null; cats: Cat[]; authors: Author[]; user: User; close: () => void }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const editTabRef = useRef<HTMLButtonElement>(null), previewTabRef = useRef<HTMLButtonElement>(null);
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
    e.preventDefault(); setErr('');
    const publishDate = new Date(f.publishAt);
    if (!f.title.trim() || Number.isNaN(publishDate.getTime())) {
      setPreviewOpen(false);
      setErr(!f.title.trim() ? 'Title is required.' : 'Enter a valid publish date and time.');
      return;
    }
    setBusy(true);
    const body = { ...f, tags: f.tags.split(',').map(t => t.trim()).filter(Boolean), publishAt: publishDate.toISOString() };
    try { await api(id ? `/admin/posts/${id}` : '/admin/posts', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) }); close(); } catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let next: boolean | undefined;
    if (event.key === 'ArrowLeft') next = false;
    if (event.key === 'ArrowRight') next = true;
    if (event.key === 'Home') next = false;
    if (event.key === 'End') next = true;
    if (next === undefined) return;
    event.preventDefault();
    setPreviewOpen(next);
    (next ? previewTabRef : editTabRef).current?.focus();
  };
  if (loading) return <p className="state" role="status">Loading…</p>;
  const future = f.status === 'published' && new Date(f.publishAt) > new Date();
  return (<form className="editor admin-editor" noValidate onSubmit={save}><div className="row"><h1>{id ? 'Edit post' : 'New post'}</h1><button type="button" onClick={close}>Back to posts</button></div>
    <div className="editor-tabs" role="tablist" aria-label="Post editor views">
      <button ref={editTabRef} type="button" role="tab" id="edit-post-tab" aria-controls="edit-post-panel" aria-selected={!previewOpen} tabIndex={previewOpen ? -1 : 0} onKeyDown={onTabKeyDown} onClick={() => setPreviewOpen(false)}>Edit</button>
      <button ref={previewTabRef} type="button" role="tab" id="preview-post-tab" aria-controls="preview-post-panel" aria-selected={previewOpen} tabIndex={previewOpen ? 0 : -1} onKeyDown={onTabKeyDown} onClick={() => setPreviewOpen(true)}>Live Preview</button>
    </div>
    <div id="edit-post-panel" className="admin-editor-panel" role="tabpanel" aria-labelledby="edit-post-tab" hidden={previewOpen}>
      <label>Title<input required maxLength={200} value={f.title} onChange={e => set('title', e.target.value)} /></label>
      <label>URL slug<input value={f.slug} maxLength={90} placeholder="Generated from the title if empty" onChange={e => set('slug', e.target.value)} /></label>
      <label>Short description<textarea rows={2} maxLength={400} value={f.excerpt} onChange={e => set('excerpt', e.target.value)} /></label>
      <label>Article Content</label>
      <div className="article-content"><ReactQuill className="article-quill" theme="snow" value={f.content} onChange={value => set('content', value)} /></div>
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
    </div>
    <div id="preview-post-panel" className="admin-preview-panel" role="tabpanel" aria-labelledby="preview-post-tab" hidden={!previewOpen}>
      <ArticlePreview draft={f} cats={cats} />
    </div>
    {err && <p className="state err" role="alert">{err}</p>}<button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save post'}</button></form>);
}
