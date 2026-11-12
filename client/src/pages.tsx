import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Cat, Paged, Post, SITE, fmt, useFetch } from './lib';
import { Card, State, Thumb } from './ui';

function PageMetadata({ title, description, image, structuredData }: { title: string; description: string; image?: string; structuredData?: object }) {
  const pageUrl = typeof location === 'undefined' ? '' : location.href;
  const imageUrl = image && typeof location !== 'undefined' ? new URL(image, location.origin).href : '';
  return <Helmet>
    <title>{title}</title>
    <meta name="description" content={description} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content={structuredData ? 'article' : 'website'} />
    <meta property="og:url" content={pageUrl} />
    <meta property="og:image" content={imageUrl} />
    <meta name="twitter:card" content="summary_large_image" />
    {structuredData && <script type="application/ld+json">{JSON.stringify(structuredData)}</script>}
  </Helmet>;
}

export function Home() {
  const f = useFetch<Post[]>('/posts/featured'), l = useFetch<Paged>('/posts?limit=6'), trending = useFetch<Post[]>('/posts/trending');
  const c = useFetch<Cat[]>('/categories');
  const [lead, ...rest] = f.data ?? [];
  return <>
    <PageMetadata title={`${SITE} Blog: software, AI, cloud and security`} description="Articles, tutorials and company news from our engineering team." />
    <div className="home">
      <section aria-labelledby="feat">
        <h1 id="feat" className="h">Featured</h1>
        <State loading={f.loading} error={f.error} empty={!f.loading && !f.error && !lead ? 'No featured articles yet.' : ''} />
        {lead && <>
          <article className="home-hero">
            <div className="home-hero-copy">
              {lead.category && <Link className="tag" to={`/category/${lead.category.slug}`}>{lead.category.name}</Link>}
              <h2><Link to={`/blog/${lead.slug}`}>{lead.title}</Link></h2>
              <p>{lead.excerpt}</p>
              <small>{lead.authorName || lead.author?.name || 'Editorial Team'} · {fmt(lead.publishAt)}</small>
              <Link className="btn" to={`/blog/${lead.slug}`}>Read article</Link>
            </div>
            <Link className="home-hero-media" to={`/blog/${lead.slug}`} aria-label={`Read ${lead.title}`}>
              <Thumb p={lead} />
            </Link>
          </article>
          {rest.length > 0 && <div className="home-featured-more">{rest.map(post => <Card key={post._id} p={post} />)}</div>}
        </>}
      </section>

      <div className="home-layout">
        <section className="home-latest" aria-labelledby="latest">
          <h2 id="latest" className="h">Latest articles</h2>
          <State loading={l.loading} error={l.error} empty={!l.loading && !l.error && !l.data?.items.length ? 'No articles published yet.' : ''} />
          <div className="home-latest-grid">{l.data?.items.map(post => <Card key={post._id} p={post} />)}</div>
          <p><Link className="btn" to="/blog">Browse all articles</Link></p>
        </section>

        <aside className="home-sidebar">
          <section aria-labelledby="home-categories">
            <h2 id="home-categories" className="h">Categories</h2>
            <State loading={c.loading} error={c.error} empty={!c.loading && !c.error && !c.data?.length ? 'No categories yet.' : ''} />
            <ul className="home-category-list">{c.data?.map(category => <li key={category._id}>
              <Link to={`/category/${category.slug}`}>{category.name}</Link>
            </li>)}</ul>
          </section>
          <section aria-labelledby="home-popular">
            <h2 id="home-popular" className="h">Popular Articles</h2>
            <State loading={trending.loading} error={trending.error} empty={!trending.loading && !trending.error && !trending.data?.length ? 'No popular articles yet.' : ''} />
            <ol className="home-trending-list">{trending.data?.map((post, index) => <li key={post._id || post.slug}>
              <span className="home-trending-rank" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <div className="home-trending-copy"><Link to={`/blog/${post.slug}`}>{post.title}</Link><small>{post.views ?? 0} views</small></div>
            </li>)}</ol>
          </section>
        </aside>
      </div>
    </div>
  </>;
}

export function Blog() {
  const { slug } = useParams(); const [sp, setSp] = useSearchParams();
  const q = sp.get('q') || '', page = Math.max(1, +(sp.get('page') || 1) || 1);
  const qs = new URLSearchParams({ page: String(page), limit: '6', ...(q && { search: q }), ...(slug && { category: slug }) }).toString();
  const { data, error, loading } = useFetch<Paged>('/posts?' + qs); const { data: cats } = useFetch<Cat[]>('/categories');
  const cat = cats?.find(c => c.slug === slug);
  const pageTitle = `${cat?.name ?? (q ? `Search: ${q}` : 'All articles')} | ${SITE}`;
  const pageDescription = `Browse ${cat?.name ?? ''} articles from ${SITE}.`;
  const go = (n: number) => { const s = new URLSearchParams(sp); s.set('page', String(n)); setSp(s); window.scrollTo(0, 0); };
  return <>
    <PageMetadata title={pageTitle} description={pageDescription} />
    <section aria-labelledby="t"><h1 id="t" className="h">{cat ? cat.name : q ? `Results for “${q}”` : 'All articles'}</h1>
      <State loading={loading} error={error} empty={!loading && !error && !data?.items.length ? (q ? 'No articles match your search. Try different keywords.' : 'No articles here yet.') : ''} />
      <label className="blog-search"><span className="sr">Search articles</span>
        <input type="search" placeholder="Search articles..." value={q} onChange={e => {
          const value = e.target.value, params = new URLSearchParams(sp);
          if (value) params.set('q', value); else params.delete('q');
          params.delete('page'); setSp(params);
        }} />
      </label>
      <div className="grid">{data?.items.map(x => <Card key={x._id} p={x} />)}</div>
      {data && data.pages > 1 && <nav className="pager" aria-label="Pagination"><button disabled={page <= 1} onClick={() => go(page - 1)}>Previous</button>
        <span>Page {data.page} of {data.pages}</span><button disabled={page >= data.pages} onClick={() => go(page + 1)}>Next</button></nav>}
    </section>
  </>;
}

DOMPurify.addHook('afterSanitizeAttributes', n => {
  if (n.tagName === 'IFRAME' && !/^https:\/\/www\.youtube(-nocookie)?\.com\/embed\//.test(n.getAttribute('src') || '')) n.remove();
  if (n.tagName === 'A') n.setAttribute('rel', 'noopener noreferrer');
});

function render(md: string) {
  const toc: { id: string; text: string; lvl: number }[] = [];
  const raw = (marked.parse(md, { async: false }) as string).replace(/<h([23])>(.*?)<\/h\1>/g, (_m, l, t) => {
    const text = t.replace(/<[^>]+>/g, ''); const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    toc.push({ id, text, lvl: +l }); return `<h${l} id="${id}">${t}</h${l}>`;
  });
  return { toc, html: DOMPurify.sanitize(raw, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allowfullscreen', 'frameborder'] }) };
}

export function PostPage() {
  const { slug } = useParams();
  const { data, error, loading } = useFetch<{ post: Post; relatedPosts: Post[]; prevPost: { title: string; slug: string } | null; nextPost: { title: string; slug: string } | null }>(`/posts/${slug}`);
  const post = data?.post; const body = useMemo(() => render(post?.content || ''), [post]);
  const [progress, setProgress] = useState(0), [speaking, setSpeaking] = useState(false), [paused, setPaused] = useState(false), [audioError, setAudioError] = useState('');
  const contentRef = useRef<HTMLDivElement>(null), utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const here = typeof location !== 'undefined' ? location.href : '';
  const articleText = useMemo(() => {
    const text = document.createElement('div');
    text.innerHTML = body.html;
    return text.textContent?.trim() || '';
  }, [body.html]);
  useEffect(() => {
    const update = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(100, Math.max(0, window.scrollY / scrollable * 100)) : 0);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [post?._id, body.html]);
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const buttons: { button: HTMLButtonElement; click: () => void }[] = [];
    const timers: number[] = [];
    container.querySelectorAll('pre').forEach(pre => {
      const button = document.createElement('button');
      const code = pre.querySelector('code')?.textContent || pre.textContent || '';
      button.type = 'button';
      button.className = 'code-copy';
      button.textContent = 'Copy code';
      button.setAttribute('aria-label', 'Copy code block');
      const click = async () => {
        try {
          await navigator.clipboard.writeText(code);
          button.textContent = 'Copied';
        } catch {
          button.textContent = 'Copy failed';
        }
        timers.push(window.setTimeout(() => { button.textContent = 'Copy code'; }, 1800));
      };
      button.addEventListener('click', click);
      pre.appendChild(button);
      buttons.push({ button, click });
    });
    return () => {
      buttons.forEach(({ button, click }) => {
        button.removeEventListener('click', click);
        button.remove();
      });
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }, [body.html]);
  useEffect(() => () => {
    const utterance = utteranceRef.current;
    if (utterance) { utterance.onend = null; utterance.onerror = null; }
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
  }, [post?._id]);
  const toggleSpeech = () => {
    const speech = window.speechSynthesis;
    setAudioError('');
    if (speaking) {
      if (speech.paused) { speech.resume(); setPaused(false); }
      else { speech.pause(); setPaused(true); }
      return;
    }
    const utterance = new SpeechSynthesisUtterance(articleText);
    utterance.onend = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null; setSpeaking(false); setPaused(false);
    };
    utterance.onerror = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null; setSpeaking(false); setPaused(false); setAudioError('Audio playback failed.');
    };
    utteranceRef.current = utterance;
    speech.cancel();
    speech.speak(utterance);
    setSpeaking(true); setPaused(false);
  };
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const schemaData = post && {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.seoTitle || post.title, description: post.seoDescription || post.excerpt,
    image: post.image ? [new URL(post.image, location.origin).href] : undefined, datePublished: post.publishAt || post.createdAt,
    author: [{ '@type': 'Person', name: post.authorName || post.author?.name || 'Editorial Team' }],
    publisher: { '@type': 'Organization', name: SITE }, mainEntityOfPage: here
  };
  if (loading || error) return <State loading={loading} error={error} />;
  if (!post) return null;
  const u = encodeURIComponent(here), t = encodeURIComponent(post.title);
  const getReadingTime = (htmlContent: string) => {
    if (!htmlContent) return 1;
    const plainText = htmlContent.replace(/<[^>]+>/g, '');
    const wordCount = plainText.trim().split(/\s+/).length;
    return Math.ceil(wordCount / 200);
  };
  return <>
    <div className="reading-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
    <PageMetadata title={`${post.seoTitle || post.title} | ${SITE}`} description={post.seoDescription || post.excerpt || ''} image={post.image} structuredData={schemaData} />
    <div className="post-page">
      <header className="post-header">
        {post.category && <Link className="tag" to={`/category/${post.category.slug}`}>{post.category.name}</Link>}
        <h1>{post.title}</h1>
        <p className="meta">By {post.authorName || post.author?.name || 'Editorial Team'} · <time dateTime={post.publishAt}>{fmt(post.publishAt)}</time>
          <span className="reading-controls"><span>{getReadingTime(post.content || '')} min read</span>
            <button type="button" onClick={toggleSpeech} disabled={!speechSupported || !articleText}>{speaking ? paused ? 'Resume' : 'Pause' : 'Listen'}</button>
            <span className="sr" aria-live="polite">{audioError}</span>
          </span>
        </p>
      </header>
      {post.image && <img className="post-cover" src={post.image} alt={post.title} width={1200} height={630} />}

      <div className="post-layout">
        <aside className="post-sidebar">
          <div className="post-sidebar-sticky">
            {body.toc.length > 0 && <nav className="toc" aria-label="In this article">
              <h2>In this article</h2>
              <ul>{body.toc.map(item => <li key={item.id} className={'l' + item.lvl}><a href={`#${item.id}`}>{item.text}</a></li>)}</ul>
            </nav>}
            <section className="post-share" aria-labelledby="share-heading">
              <h2 id="share-heading">Share</h2>
              <div>
                <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${u}`} target="_blank" rel="noopener noreferrer">LinkedIn</a>
                <a href={`https://twitter.com/intent/tweet?url=${u}&text=${t}`} target="_blank" rel="noopener noreferrer">X</a>
                <button onClick={() => navigator.clipboard?.writeText(here)}>Copy link</button>
              </div>
            </section>
          </div>
        </aside>

        <article className="post-content">
          <div ref={contentRef} className="article-content prose" dangerouslySetInnerHTML={{ __html: body.html }} />
          <hr />
          <nav className="pn" aria-label="Previous and next articles">
            {data!.prevPost ? <Link to={`/blog/${data!.prevPost.slug}`}><small>Previous article</small><strong>{data!.prevPost.title}</strong></Link> : <span />}
            {data!.nextPost && <Link to={`/blog/${data!.nextPost.slug}`}><small>Next article</small><strong>{data!.nextPost.title}</strong></Link>}
          </nav>
          {data!.relatedPosts.length > 0 && <section className="post-related" aria-labelledby="rel">
            <h2 id="rel" className="h">Related articles</h2>
            <div className="post-related-grid">{data!.relatedPosts.map(article => <Card key={article._id} p={article} />)}</div>
          </section>}
        </article>
      </div>
    </div>
  </>;
}
