import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { api, Cat, Paged, Post, SITE, fmt, useFetch } from './lib';
import { BookmarkButton, Card, readingTime, State, Thumb } from './ui';
import { toSavedArticle, useSavedArticles } from './saved';

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

export function SpotlightSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<Post[]>([]);
  const [searchError, setSearchError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: categories, loading: categoriesLoading, error: categoriesError } = useFetch<Cat[]>('/categories');
  const { data: trending, loading: trendingLoading, error: trendingError } = useFetch<Post[]>('/posts/trending');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 240);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setSearchError('');
      setSearchLoading(false);
      return;
    }
    let active = true;
    setSearchLoading(true);
    setSearchError('');
    api<Paged>(`/posts?limit=8&search=${encodeURIComponent(debouncedQuery)}`)
      .then(data => { if (active) setResults(data.items); })
      .catch(error => { if (active) setSearchError(error instanceof Error ? error.message : 'Search failed.'); })
      .finally(() => { if (active) setSearchLoading(false); });
    return () => { active = false; };
  }, [debouncedQuery]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = event.currentTarget.querySelectorAll<HTMLElement>('input:not([disabled]),button:not([disabled]),a[href]');
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return <div className="spotlight-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="spotlight-modal" role="dialog" aria-modal="true" aria-labelledby="spotlight-title" onKeyDown={handleDialogKeyDown}>
      <header className="spotlight-header">
        <div><span className="spotlight-kicker">TechPulse spotlight</span><h2 id="spotlight-title">Search the publication</h2></div>
        <button type="button" className="spotlight-close" onClick={onClose} aria-label="Close search">Esc</button>
      </header>
      <label className="sr" htmlFor="spotlight-query">Search articles</label>
      <div className="spotlight-input-wrap">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
        <input ref={inputRef} id="spotlight-query" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search articles, topics, and ideas…" autoComplete="off" />
        {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">Clear</button>}
      </div>
      {debouncedQuery
        ? <section className="spotlight-results" aria-live="polite" aria-label="Search results">
          <h3>Results for “{debouncedQuery}”</h3>
          {searchLoading && <p className="spotlight-hint" role="status">Searching…</p>}
          {searchError && <p className="state err" role="alert">{searchError}</p>}
          {!searchLoading && !searchError && !results.length && <p className="spotlight-hint">No matching articles. Try another search.</p>}
          {results.map(post => <Link className="spotlight-result" key={post._id} to={`/blog/${post.slug}`} onClick={onClose}>
            <span className="spotlight-result-icon" aria-hidden="true">↗</span>
            <span><strong>{post.title}</strong><small>{post.category?.name || 'Article'} · {post.excerpt}</small></span>
          </Link>)}
        </section>
        : <div className="spotlight-discover">
          <section aria-labelledby="spotlight-categories">
            <h3 id="spotlight-categories">Jump to a category</h3>
            {categoriesLoading && <p className="spotlight-hint" role="status">Loading categories…</p>}
            {categoriesError && <p className="state err" role="alert">{categoriesError}</p>}
            <div className="spotlight-categories">{categories?.map(category =>
              <Link key={category._id} to={`/category/${category.slug}`} onClick={onClose}>{category.name}<span aria-hidden="true">→</span></Link>
            )}</div>
          </section>
          <section className="spotlight-trending" aria-labelledby="spotlight-trending-heading">
            <h3 id="spotlight-trending-heading">Trending now</h3>
            <State loading={trendingLoading} error={trendingError} empty={!trendingLoading && !trendingError && !trending?.length ? 'No trending articles yet.' : ''} />
            {trending?.slice(0, 4).map((post, index) => <Link key={post._id || post.slug} to={`/blog/${post.slug}`} onClick={onClose}>
              <span>{String(index + 1).padStart(2, '0')}</span><strong>{post.title}</strong><small>↗</small>
            </Link>)}
          </section>
        </div>}
      <footer className="spotlight-footer"><span>Search TechPulse articles and categories</span><span><kbd>Ctrl</kbd><kbd>K</kbd> to open <b>Esc</b> to close</span></footer>
    </section>
  </div>;
}

export function Home() {
  const f = useFetch<Post[]>('/posts/featured'), l = useFetch<Paged>('/posts?limit=6'), trending = useFetch<Post[]>('/posts/trending');
  const c = useFetch<Cat[]>('/categories');
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [lead, ...rest] = f.data ?? [];
  return <>
    <PageMetadata title={`${SITE} Blog: software, AI, cloud and security`} description="Articles, tutorials and company news from our engineering team." />
    <div className="home">
      <section className="editorial-hero" aria-labelledby="editorial-title">
        <div className="editorial-hero-content">
          <span className="editorial-eyebrow"><span aria-hidden="true">⚡</span> Engineering &amp; product insights</span>
          <h1 id="editorial-title">Ideas for the <span>builders</span> shaping what’s next.</h1>
          <p>Thoughtful perspectives on software, AI, cloud, and the craft of building better products.</p>
          <form className="editorial-search" role="search" onSubmit={event => {
            event.preventDefault();
            const value = query.trim();
            if (value) navigate(`/blog?q=${encodeURIComponent(value)}`);
          }}>
            <label className="sr" htmlFor="editorial-search-input">Search engineering articles</label>
            <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
            <input id="editorial-search-input" type="search" placeholder="Search ideas, technologies, and more..." value={query} onChange={event => setQuery(event.target.value)} />
            <button type="submit">Search</button>
          </form>
          <nav className="editorial-topics" aria-label="Explore topics">
            <Link className="topic-pill active" to="/">All topics</Link>
            {c.data?.map(category => <Link className="topic-pill" key={category._id} to={`/category/${category.slug}`}>{category.name}</Link>)}
          </nav>
        </div>
      </section>
      <section aria-labelledby="feat">
        <div className="section-heading"><div><span className="section-kicker">Editor’s pick</span><h2 id="feat" className="h">Featured story</h2></div></div>
        <State loading={f.loading} error={f.error} empty={!f.loading && !f.error && !lead ? 'No featured articles yet.' : ''} />
        {lead && <>
          <article className="home-hero">
            <div className="home-hero-copy">
              <div className="feature-meta">
                {lead.category && <Link className="tag" to={`/category/${lead.category.slug}`}>{lead.category.name}</Link>}
                <span className="reading-time"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.2 1.4" /></svg>{lead.readingTime || readingTime(lead.content || lead.excerpt)} min read</span>
              </div>
              <h2><Link to={`/blog/${lead.slug}`}>{lead.title}</Link></h2>
              <p>{lead.excerpt}</p>
              <div className="feature-byline">
                <span className="author-avatar" aria-hidden="true">{(lead.authorName || lead.author?.name || 'Editorial Team').trim().charAt(0).toUpperCase()}</span>
                <span><strong>{lead.authorName || lead.author?.name || 'Editorial Team'}</strong><small><time dateTime={lead.publishAt}>{fmt(lead.publishAt)}</time></small></span>
              </div>
              <Link className="feature-link" to={`/blog/${lead.slug}`}>Read article <span aria-hidden="true">→</span></Link>
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
          <div className="section-heading"><div><span className="section-kicker">Fresh perspectives</span><h2 id="latest" className="h">Latest articles</h2></div><Link className="section-link" to="/blog">View all <span aria-hidden="true">→</span></Link></div>
          <State loading={l.loading} error={l.error} empty={!l.loading && !l.error && !l.data?.items.length ? 'No articles published yet.' : ''} />
          <div className="home-latest-grid">{l.data?.items.map(post => <Card key={post._id} p={post} />)}</div>
          <p><Link className="btn" to="/blog">Browse all articles</Link></p>
        </section>

        <aside className="home-sidebar">
          <section aria-labelledby="home-categories">
            <h2 id="home-categories" className="h">Categories</h2>
            <State loading={c.loading} error={c.error} empty={!c.loading && !c.error && !c.data?.length ? 'No categories yet.' : ''} />
            <ul className="home-category-list">{c.data?.map(category => <li key={category._id}>
              <Link to={`/category/${category.slug}`}><span>{category.name}</span><span className="category-arrow" aria-hidden="true">→</span></Link>
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

export function SavedPage() {
  const { articles, error } = useSavedArticles();
  return <>
    <PageMetadata title={`Saved articles | ${SITE}`} description={`Your saved ${SITE} articles.`} />
    <section aria-labelledby="saved-heading">
      <h1 id="saved-heading" className="h">Saved articles <span className="saved-page-count">{articles.length}</span></h1>
      {error && <p className="state err" role="alert">{error}</p>}
      {articles.length
        ? <div className="grid">{articles.map(article => <Card key={article.slug} p={article} />)}</div>
        : <p className="state">You have no saved articles yet. <Link to="/blog">Browse articles</Link>.</p>}
    </section>
  </>;
}

DOMPurify.addHook('afterSanitizeAttributes', n => {
  if (n.tagName === 'IFRAME' && !/^https:\/\/www\.youtube(-nocookie)?\.com\/embed\//.test(n.getAttribute('src') || '')) n.remove();
  if (n.tagName === 'A') n.setAttribute('rel', 'noopener noreferrer');
});

export function renderArticleContent(md: string) {
  const toc: { id: string; text: string; lvl: number }[] = [];
  const raw = (marked.parse(md, { async: false }) as string).replace(/<h([23])>(.*?)<\/h\1>/g, (_m, l, t) => {
    const text = t.replace(/<[^>]+>/g, ''); const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    toc.push({ id, text, lvl: +l }); return `<h${l} id="${id}">${t}</h${l}>`;
  });
  return { toc, html: DOMPurify.sanitize(raw, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allowfullscreen', 'frameborder'] }) };
}

type ArticleReactionCounts = { applaud: number; insightful: number; helpful: number };
type ArticleReactionState = { counts: ArticleReactionCounts; error: string };
const emptyReactions = (): ArticleReactionCounts => ({ applaud: 0, insightful: 0, helpful: 0 });

function isArticleReactionCounts(value: unknown): value is ArticleReactionCounts {
  if (typeof value !== 'object' || value === null) return false;
  const counts = value as Record<string, unknown>;
  return ['applaud', 'insightful', 'helpful'].every(key =>
    typeof counts[key] === 'number' && Number.isSafeInteger(counts[key]) && counts[key] >= 0
  );
}

function readArticleReactions(slug: string): ArticleReactionState {
  try {
    const stored = localStorage.getItem(`techpulse:reactions:${slug}`);
    if (!stored) return { counts: emptyReactions(), error: '' };
    const parsed: unknown = JSON.parse(stored);
    return isArticleReactionCounts(parsed)
      ? { counts: parsed, error: '' }
      : { counts: emptyReactions(), error: 'Saved reactions could not be read.' };
  } catch {
    return { counts: emptyReactions(), error: 'Saved reactions could not be read.' };
  }
}

function ArticleReactions({ slug }: { slug: string }) {
  const [state, setState] = useState(() => readArticleReactions(slug));
  const react = (reaction: keyof ArticleReactionCounts) => {
    const counts = { ...state.counts, [reaction]: state.counts[reaction] + 1 };
    try {
      localStorage.setItem(`techpulse:reactions:${slug}`, JSON.stringify(counts));
      setState({ counts, error: '' });
    } catch {
      setState(previous => ({ ...previous, error: 'Could not save your reaction. Check browser storage and try again.' }));
    }
  };
  return <section className="article-reactions" aria-labelledby="article-reactions-title">
    <div><span className="section-kicker">Your perspective</span><h2 id="article-reactions-title">Was this article helpful?</h2></div>
    <div className="reaction-buttons">
      <button type="button" onClick={() => react('applaud')}><span aria-hidden="true">👏</span> Applaud <b aria-live="polite">{state.counts.applaud}</b></button>
      <button type="button" onClick={() => react('insightful')}><span aria-hidden="true">🔥</span> Insightful <b aria-live="polite">{state.counts.insightful}</b></button>
      <button type="button" onClick={() => react('helpful')}><span aria-hidden="true">💡</span> Helpful <b aria-live="polite">{state.counts.helpful}</b></button>
    </div>
    {state.error && <p className="reaction-error" role="alert">{state.error}</p>}
  </section>;
}

export function PostPage() {
  const { slug } = useParams();
  const { data, error, loading } = useFetch<{ post: Post; relatedPosts: Post[]; prevPost: { title: string; slug: string } | null; nextPost: { title: string; slug: string } | null }>(`/posts/${slug}`);
  const post = data?.post; const body = useMemo(() => renderArticleContent(post?.content || ''), [post]);
  const [progress, setProgress] = useState(0), [activeHeading, setActiveHeading] = useState(''), [speaking, setSpeaking] = useState(false), [paused, setPaused] = useState(false), [audioError, setAudioError] = useState('');
  const [speed, setSpeed] = useState<1 | 1.25 | 1.5>(1);
  const pageRef = useRef<HTMLDivElement>(null), contentRef = useRef<HTMLDivElement>(null), utteranceRef = useRef<SpeechSynthesisUtterance | null>(null), speechPositionRef = useRef(0);
  const here = typeof location !== 'undefined' ? location.href : '';
  const articleText = useMemo(() => {
    const text = document.createElement('div');
    text.innerHTML = body.html;
    return text.textContent?.trim() || '';
  }, [body.html]);
  const speechText = useMemo(() => post ? `${post.title}. ${articleText}` : '', [post?.title, articleText]);
  useEffect(() => {
    const update = () => {
      const page = pageRef.current;
      if (!page) return;
      const pageTop = window.scrollY + page.getBoundingClientRect().top;
      const scrollable = page.offsetHeight - window.innerHeight;
      const pageProgress = scrollable > 0
        ? (window.scrollY - pageTop) / scrollable * 100
        : window.scrollY >= pageTop ? 100 : 0;
      setProgress(Math.min(100, Math.max(0, pageProgress)));
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
    const article = contentRef.current;
    if (!article || !body.toc.length) { setActiveHeading(''); return; }
    const headings = body.toc
      .map(item => document.getElementById(item.id))
      .filter((heading): heading is HTMLElement => heading instanceof HTMLElement && article.contains(heading));
    if (!headings.length) { setActiveHeading(''); return; }
    const update = () => {
      const current = headings.filter(heading => heading.getBoundingClientRect().top <= window.innerHeight * 0.2);
      const next = current[current.length - 1]?.id || '';
      setActiveHeading(previous => previous === next ? previous : next);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [post?._id, body.html, body.toc]);
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
          button.textContent = '✓ Copied!';
        } catch {
          button.textContent = 'Copy failed';
        }
        timers.push(window.setTimeout(() => { button.textContent = 'Copy code'; }, 2000));
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
  useEffect(() => {
    setSpeaking(false);
    setPaused(false);
    setAudioError('');
    speechPositionRef.current = 0;
    return () => {
      const utterance = utteranceRef.current;
      if (utterance) {
        utterance.onboundary = null;
        utterance.onend = null;
        utterance.onerror = null;
      }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      utteranceRef.current = null;
    };
  }, [slug]);
  const speakFrom = (offset: number, rate: number) => {
    if (!speechText) return;
    const speech = window.speechSynthesis;
    const previous = utteranceRef.current;
    if (previous) {
      previous.onboundary = null;
      previous.onend = null;
      previous.onerror = null;
    }
    const utterance = new SpeechSynthesisUtterance(speechText.slice(offset));
    utterance.rate = rate;
    utterance.onboundary = event => {
      if (utteranceRef.current === utterance) speechPositionRef.current = offset + event.charIndex;
    };
    utterance.onend = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      speechPositionRef.current = 0;
      setSpeaking(false);
      setPaused(false);
    };
    utterance.onerror = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      speechPositionRef.current = 0;
      setSpeaking(false);
      setPaused(false);
      setAudioError('Audio playback failed.');
    };
    speech.cancel();
    utteranceRef.current = utterance;
    speech.speak(utterance);
    setSpeaking(true);
    setPaused(false);
  };
  const toggleSpeech = () => {
    const speech = window.speechSynthesis;
    setAudioError('');
    if (speaking) {
      if (speech.paused) { speech.resume(); setPaused(false); }
      else { speech.pause(); setPaused(true); }
      return;
    }
    speechPositionRef.current = 0;
    speakFrom(0, speed);
  };
  const stopSpeech = () => {
    const utterance = utteranceRef.current;
    if (utterance) {
      utterance.onboundary = null;
      utterance.onend = null;
      utterance.onerror = null;
    }
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    speechPositionRef.current = 0;
    setSpeaking(false);
    setPaused(false);
    setAudioError('');
  };
  const cycleSpeed = () => {
    const rates = [1, 1.25, 1.5] as const;
    const next = rates[(rates.indexOf(speed) + 1) % rates.length];
    setSpeed(next);
    if (speaking) {
      const wasPaused = paused;
      speakFrom(speechPositionRef.current, next);
      if (wasPaused) { window.speechSynthesis.pause(); setPaused(true); }
    }
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
    <div ref={pageRef} className="post-page">
      <header className="post-header">
        {post.category && <Link className="tag" to={`/category/${post.category.slug}`}>{post.category.name}</Link>}
        <h1>{post.title}</h1>
        <p className="meta">By {post.authorName || post.author?.name || 'Editorial Team'} · <time dateTime={post.publishAt}>{fmt(post.publishAt)}</time>
          <span className="reading-controls"><span>{getReadingTime(post.content || '')} min read</span>
            <span className="audio-player" role="group" aria-label="Listen to article">
              <button type="button" onClick={toggleSpeech} disabled={!speechSupported || !speechText} aria-label={speaking && !paused ? 'Pause article audio' : 'Play article audio'}>{speaking && !paused ? 'Pause' : 'Play'}</button>
              <button type="button" onClick={stopSpeech} disabled={!speechSupported || !speaking}>Stop</button>
              <button type="button" onClick={cycleSpeed} disabled={!speechSupported} aria-label={`Playback speed ${speed}x; change speed`}>{speed}x</button>
            </span>
            <span className="sr" aria-live="polite">{audioError}</span>
          </span>
        </p>
      </header>
      {post.image && <img className="post-cover" src={post.image} alt={post.title} width={1200} height={630} />}

      <div className="article-action-bar" role="group" aria-label="Share and save article">
        <span className="action-bar-label">Enjoying this story?</span>
        <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${u}`} target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <a href={`https://twitter.com/intent/tweet?url=${u}&text=${t}`} target="_blank" rel="noopener noreferrer">Share on X</a>
        <button type="button" onClick={() => navigator.clipboard?.writeText(here)}>Copy link</button>
        <BookmarkButton article={toSavedArticle(post)} />
      </div>

      <div className="post-layout">
        <aside className="post-sidebar">
          <div className="post-sidebar-sticky">
            {body.toc.length > 0 && <nav className="toc" aria-label="In this article">
              <span className="toc-progress" aria-hidden="true"><span style={{ height: `${progress}%` }} /></span>
              <h2>In this article</h2>
              <ul>{body.toc.map(item => <li key={item.id} className={'l' + item.lvl}><a className={activeHeading === item.id ? 'active' : ''} aria-current={activeHeading === item.id ? 'location' : undefined} href={`#${item.id}`}>{item.text}</a></li>)}</ul>
            </nav>}
          </div>
        </aside>

        <article className="post-content">
          <div ref={contentRef} className="article-content prose" dangerouslySetInnerHTML={{ __html: body.html }} />
          <hr />
          <nav className="pn" aria-label="Previous and next articles">
            {data!.prevPost ? <Link to={`/blog/${data!.prevPost.slug}`}><small>Previous article</small><strong>{data!.prevPost.title}</strong></Link> : <span />}
            {data!.nextPost && <Link to={`/blog/${data!.nextPost.slug}`}><small>Next article</small><strong>{data!.nextPost.title}</strong></Link>}
          </nav>
          <ArticleReactions key={post.slug} slug={post.slug} />
          {data!.relatedPosts.length > 0 && <section className="post-related" aria-labelledby="rel">
            <h2 id="rel" className="h">Related articles</h2>
            <div className="post-related-grid">{data!.relatedPosts.map(article => <Card key={article._id} p={article} />)}</div>
          </section>}
        </article>
      </div>
      <section className="newsletter-callout" aria-labelledby="newsletter-title">
        <div><span className="section-kicker">The TechPulse newsletter</span><h2 id="newsletter-title">Subscribe to TechPulse Newsletter</h2>
          <p>Stay close to the ideas, tools, and teams shaping modern engineering. Explore the latest stories from our editorial team.</p></div>
        <Link className="btn" to="/blog">Explore the latest <span aria-hidden="true">→</span></Link>
      </section>
    </div>
  </>;
}
