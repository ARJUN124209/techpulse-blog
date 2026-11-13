import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { api, Cat, Paged, Post, SITE, fmt, useFetch } from './lib';
import { ArticleCover, BookmarkButton, Card, readingTime, State, Thumb } from './ui';
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
  const f = useFetch<Post[]>('/posts/featured'), l = useFetch<Paged>('/posts?limit=24'), trending = useFetch<Post[]>('/posts/trending');
  const c = useFetch<Cat[]>('/categories');
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const allPosts = l.data?.items ?? [];
  const featuredPosts = useMemo(() => {
    const unique = new Map<string, Post>();
    [...(f.data ?? []), ...allPosts].forEach(post => unique.set(post.slug, post));
    return [...unique.values()].slice(0, 5);
  }, [f.data, allPosts]);
  const activeFeaturedIndex = featuredPosts.length ? activeIndex % featuredPosts.length : 0;
  const lead = featuredPosts[activeFeaturedIndex];
  const categories = c.data ?? [];
  const articleCount = (category: Cat) => allPosts.filter(post => post.category?.slug === category.slug).length;
  const trendPosts = allPosts.filter(post => /artificial-intelligence|technology-innovation|industry-insights/.test(post.category?.slug ?? '')).slice(0, 3);
  const platformPosts = allPosts.filter(post => /software-development|cybersecurity|cloud-computing|web-and-mobile/.test(post.category?.slug ?? '')).slice(0, 3);
  const categoryLink = (name: string) => categories.find(category => category.name === name);
  const previousFeatured = () => setActiveIndex(index => (index - 1 + featuredPosts.length) % featuredPosts.length);
  const nextFeatured = () => setActiveIndex(index => (index + 1) % featuredPosts.length);

  return <>
    <PageMetadata title={`${SITE} Blog: Insights on growth, software, and engineering`} description="Insights on growth, software, and engineering from the TechPulse editorial team." />
    <div className="home">
      <section className="editorial-hero" aria-labelledby="editorial-title">
        <div className="editorial-hero-content">
          <span className="editorial-eyebrow"><span aria-hidden="true">✦</span> TechPulse engineering journal</span>
          <h1 id="editorial-title">Insights on growth, software, and engineering</h1>
          <p>Independent perspectives and practical guidance for the people building what comes next.</p>
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
      <section className="featured-showcase" aria-labelledby="feat">
        <div className="section-heading"><div><span className="section-kicker">The editor’s selection</span><h2 id="feat" className="h">Featured stories</h2></div>
          {featuredPosts.length > 1 && <div className="carousel-controls" role="group" aria-label="Featured story controls">
            <button type="button" onClick={previousFeatured} aria-label="Previous featured story">←</button>
            <span aria-live="polite">{String(activeFeaturedIndex + 1).padStart(2, '0')} / {String(featuredPosts.length).padStart(2, '0')}</span>
            <button type="button" onClick={nextFeatured} aria-label="Next featured story">→</button>
          </div>}
        </div>
        <State loading={f.loading || l.loading} error={f.error || l.error} empty={!f.loading && !l.loading && !featuredPosts.length ? 'No featured articles yet.' : ''} />
        {lead && <div className="featured-showcase-grid">
          <article className="home-hero">
            <div className="home-hero-copy">
              <div className="feature-meta">
                {lead.category && <Link className="tag" to={`/category/${lead.category.slug}`}>{lead.category.name}</Link>}
                <span className="reading-time"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.2 1.4" /></svg>{lead.readingTime || readingTime(lead.content || lead.excerpt)} Mins Read</span>
              </div>
              <h2><Link to={`/blog/${lead.slug}`}>{lead.title}</Link></h2>
              <p>{lead.excerpt}</p>
              <div className="feature-byline">
                <span className="author-avatar" aria-hidden="true">{(lead.authorName || lead.author?.name || 'Editorial Team').trim().charAt(0).toUpperCase()}</span>
                <span><strong>By {lead.authorName || lead.author?.name || 'Editorial Team'}</strong><small><time dateTime={lead.publishAt}>{fmt(lead.publishAt)}</time></small></span>
              </div>
              <Link className="feature-link" to={`/blog/${lead.slug}`}>Read story <span aria-hidden="true">→</span></Link>
            </div>
            <Link className="home-hero-media" to={`/blog/${lead.slug}`} aria-label={`Read ${lead.title}`}>
              <Thumb p={lead} />
            </Link>
          </article>
          <ol className="featured-story-list" aria-label="Five featured stories">
            {featuredPosts.map((post, index) => <li key={post._id || post.slug} className={index === activeFeaturedIndex ? 'active' : ''}>
              <button type="button" onClick={() => setActiveIndex(index)} aria-pressed={index === activeFeaturedIndex}>
                <span className="feature-list-metadata"><span className="feature-list-meta">{post.category?.name || 'Featured'}</span>
                  <span className="reading-time">{post.readingTime || readingTime(post.content || post.excerpt)} Mins Read</span></span>
                <strong>{post.title}</strong>
                <small>By {post.authorName || post.author?.name || 'Editorial Team'} <span aria-hidden="true">•</span> {fmt(post.publishAt)}</small>
              </button>
              <Link to={`/blog/${post.slug}`} aria-label={`Read ${post.title}`} className="feature-list-link">↗</Link>
            </li>)}
          </ol>
        </div>}
      </section>

      <section className="editorial-promos" aria-label="Explore editorial collections">
        <article className="editorial-promo promo-systems">
          <span className="section-kicker">From architecture to production</span>
          <h2>Perspectives on scalable systems</h2>
          <p>Explore thoughtful writing on the decisions that keep modern systems resilient as they grow.</p>
          <div className="promo-categories">
            {['Software Development', 'Cloud Computing'].map(name => {
              const category = categoryLink(name);
              return category && <Link key={category.slug} to={`/category/${category.slug}`}>{category.name}<span aria-hidden="true">↗</span></Link>;
            })}
          </div>
          {categoryLink('Software Development') && <Link className="promo-read-more" to={`/category/${categoryLink('Software Development')!.slug}`}>Read more <span aria-hidden="true">→</span></Link>}
        </article>
        <article className="editorial-promo promo-ai">
          <span className="section-kicker">Practical guides for builders</span>
          <h2>Hands-on engineering tutorials &amp; AI implementation guides</h2>
          <p>Build your skills with hands-on engineering tutorials and grounded guides to applied AI.</p>
          <div className="promo-categories">
            {['Artificial Intelligence & Machine Learning', 'Web and Mobile App Development'].map(name => {
              const category = categoryLink(name);
              return category && <Link key={category.slug} to={`/category/${category.slug}`}>{category.name}<span aria-hidden="true">↗</span></Link>;
            })}
          </div>
          {categoryLink('Artificial Intelligence & Machine Learning') && <Link className="promo-read-more" to={`/category/${categoryLink('Artificial Intelligence & Machine Learning')!.slug}`}>Read more <span aria-hidden="true">→</span></Link>}
        </article>
      </section>

      <section className="explore-categories" aria-labelledby="explore-heading">
        <div className="section-heading"><div><span className="section-kicker">Find your next read</span><h2 id="explore-heading" className="h">Explore categories</h2></div>
          <Link className="section-link" to="/blog">All stories <span aria-hidden="true">→</span></Link></div>
        <State loading={c.loading} error={c.error} empty={!c.loading && !c.error && !categories.length ? 'No categories yet.' : ''} />
        <div className="category-explore-grid">{categories.map(category => <Link className="category-explore-card" key={category._id} to={`/category/${category.slug}`}>
          <span className="category-glyph" aria-hidden="true"><CategoryGlyph slug={category.slug} /></span>
          <span className="category-explore-copy"><strong>{category.name}</strong><small>{articleCount(category)} {articleCount(category) === 1 ? 'story' : 'stories'}</small></span>
          <span className="category-explore-arrow" aria-hidden="true">↗</span>
        </Link>)}</div>
      </section>

      <div className="home-layout">
        <section className="home-latest" aria-labelledby="latest">
          <div className="section-heading"><div><span className="section-kicker">Fresh perspectives</span><h2 id="latest" className="h">Latest stories</h2></div><Link className="section-link" to="/blog">View all <span aria-hidden="true">→</span></Link></div>
          <State loading={l.loading} error={l.error} empty={!l.loading && !l.error && !l.data?.items.length ? 'No articles published yet.' : ''} />
          <div className="home-latest-grid">{l.data?.items.slice(0, 6).map(post => <Card key={post._id} p={post} />)}</div>
          <p><Link className="btn" to="/blog">Browse all articles</Link></p>
        </section>

        <aside className="home-sidebar">
          <section aria-labelledby="home-popular">
            <h2 id="home-popular" className="h">Popular posts</h2>
            <State loading={trending.loading} error={trending.error} empty={!trending.loading && !trending.error && !trending.data?.length ? 'No popular articles yet.' : ''} />
            <ol className="home-trending-list">{trending.data?.map((post, index) => <li key={post._id || post.slug}>
              <span className="home-trending-rank" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <div className="home-trending-copy"><Link to={`/blog/${post.slug}`}>{post.title}</Link><small>{post.views ?? 0} views</small></div>
            </li>)}</ol>
          </section>
        </aside>
      </div>

      <CuratedSection title="Trends & Insights" kicker="Ideas shaping the next chapter" posts={trendPosts} />
      <CuratedSection title="Platform & Security Updates" kicker="Reliable foundations for modern teams" posts={platformPosts} />
    </div>
  </>;
}

function CategoryGlyph({ slug }: { slug: string }) {
  const icon = slug.includes('artificial')
    ? <><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" /><circle cx="12" cy="12" r="4" /></>
    : slug.includes('cyber')
      ? <><path d="M12 3 19 6v5c0 4.5-3 7.7-7 10-4-2.3-7-5.5-7-10V6z" /><path d="m9 12 2 2 4-4" /></>
      : slug.includes('cloud')
        ? <><path d="M6 18h11a4 4 0 0 0 .4-8A6 6 0 0 0 6 9a4.5 4.5 0 0 0 0 9Z" /><path d="m9 13 3-3 3 3m-3-3v7" /></>
        : slug.includes('mobile')
          ? <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M10 6h4m-3 12h2" /></>
          : slug.includes('technology')
            ? <><path d="M12 3v18m-9-9h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" /><circle cx="12" cy="12" r="4" /></>
            : slug.includes('industry')
              ? <><path d="M4 20V8l8-5 8 5v12M8 20v-6h8v6" /><path d="M8 9h.01M12 9h.01M16 9h.01" /></>
              : <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 8h8M8 12h8M8 16h4" /></>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>;
}

function CuratedSection({ title, kicker, posts }: { title: string; kicker: string; posts: Post[] }) {
  if (!posts.length) return null;
  return <section className="curated-section" aria-label={title}>
    <div className="section-heading"><div><span className="section-kicker">{kicker}</span><h2 className="h">{title}</h2></div>
      <Link className="section-link" to="/blog">Explore stories <span aria-hidden="true">→</span></Link></div>
    <div className="curated-grid">{posts.map(post => <Card key={post._id || post.slug} p={post} />)}</div>
  </section>;
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

type DiscussionReply = { id: string; name: string; text: string; createdAt: string };
type DiscussionComment = DiscussionReply & { replies: DiscussionReply[] };
type DiscussionState = { comments: DiscussionComment[]; error: string };

function seedDiscussion(): DiscussionComment[] {
  const now = Date.now();
  return [
    {
      id: 'editorial-reply-1',
      name: 'Maya Chen',
      text: 'The emphasis on making trade-offs explicit really resonates. We started recording the failure mode alongside each architecture decision, and our reviews became much more useful.',
      createdAt: new Date(now - 3 * 86400000).toISOString(),
      replies: []
    },
    {
      id: 'editorial-reply-2',
      name: 'Rohan Iyer',
      text: 'Helpful, practical perspective. I would add that a small operational rehearsal often reveals more than another round of diagrams.',
      createdAt: new Date(now - 86400000).toISOString(),
      replies: []
    }
  ];
}

function isDiscussionReply(value: unknown): value is DiscussionReply {
  if (!value || typeof value !== 'object') return false;
  const reply = value as Record<string, unknown>;
  return typeof reply.id === 'string' && typeof reply.name === 'string' &&
    typeof reply.text === 'string' && typeof reply.createdAt === 'string';
}

function isDiscussionComment(value: unknown): value is DiscussionComment {
  if (!isDiscussionReply(value)) return false;
  const comment = value as DiscussionComment;
  return Array.isArray(comment.replies) && comment.replies.every(isDiscussionReply);
}

function readDiscussion(slug: string): DiscussionState {
  try {
    const raw = localStorage.getItem(`techpulse:discussion:${slug}`);
    if (!raw) return { comments: seedDiscussion(), error: '' };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isDiscussionComment)) {
      return { comments: seedDiscussion(), error: 'Saved discussion could not be read.' };
    }
    return { comments: parsed, error: '' };
  } catch {
    return { comments: seedDiscussion(), error: 'Saved discussion could not be read.' };
  }
}

function Discussion({ slug }: { slug: string }) {
  const [state, setState] = useState(() => readDiscussion(slug));
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyName, setReplyName] = useState('');

  useEffect(() => {
    try {
      const key = `techpulse:discussion:${slug}`;
      if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(state.comments));
    } catch {
      setState(previous => ({ ...previous, error: 'Could not save the discussion in this browser.' }));
    }
  }, [slug]);

  const persist = (comments: DiscussionComment[]) => {
    try {
      localStorage.setItem(`techpulse:discussion:${slug}`, JSON.stringify(comments));
      setState({ comments, error: '' });
      return true;
    } catch {
      setState(previous => ({ ...previous, error: 'Could not save your comment. Check browser storage and try again.' }));
      return false;
    }
  };

  const submitComment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const author = name.trim();
    const body = text.trim();
    if (!author || !body) return;
    const comment: DiscussionComment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: author,
      text: body,
      createdAt: new Date().toISOString(),
      replies: []
    };
    if (persist([...state.comments, comment])) setText('');
  };

  const submitReply = (event: React.FormEvent<HTMLFormElement>, commentId: string) => {
    event.preventDefault();
    const author = replyName.trim();
    const body = replyText.trim();
    if (!author || !body) return;
    const reply: DiscussionReply = {
      id: `reply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: author,
      text: body,
      createdAt: new Date().toISOString()
    };
    const comments = state.comments.map(comment =>
      comment.id === commentId ? { ...comment, replies: [...comment.replies, reply] } : comment
    );
    if (persist(comments)) {
      setReplyText('');
      setReplyingTo('');
    }
  };

  return <section className="discussion-section" aria-labelledby="discussion-heading">
    <div className="section-heading"><div><span className="section-kicker">Join the conversation</span><h2 id="discussion-heading" className="h">Discussion &amp; Replies</h2></div>
      <span className="discussion-count">{state.comments.length} {state.comments.length === 1 ? 'comment' : 'comments'}</span>
    </div>
    <form className="discussion-form" onSubmit={submitComment}>
      <label>Name<input name="name" autoComplete="name" maxLength={80} required value={name} onChange={event => setName(event.target.value)} placeholder="Your name" /></label>
      <label>Comment<textarea name="comment" rows={4} maxLength={2000} required value={text} onChange={event => setText(event.target.value)} placeholder="Share a thoughtful response…" /></label>
      <button type="submit" className="btn">Post comment</button>
    </form>
    {state.error && <p className="discussion-error" role="alert">{state.error}</p>}
    <ol className="discussion-list">{state.comments.map(comment => <li className="discussion-comment" key={comment.id}>
      <article>
        <div className="discussion-byline"><strong>{comment.name}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time></div>
        <p>{comment.text}</p>
        <button type="button" className="discussion-reply-toggle" onClick={() => setReplyingTo(replyingTo === comment.id ? '' : comment.id)}>
          {replyingTo === comment.id ? 'Cancel reply' : 'Reply'}
        </button>
      </article>
      {comment.replies.length > 0 && <ol className="discussion-replies">{comment.replies.map(reply => <li key={reply.id}>
        <div className="discussion-byline"><strong>{reply.name}</strong><time dateTime={reply.createdAt}>{new Date(reply.createdAt).toLocaleString()}</time></div>
        <p>{reply.text}</p>
      </li>)}</ol>}
      {replyingTo === comment.id && <form className="discussion-reply-form" onSubmit={event => submitReply(event, comment.id)}>
        <label>Name<input autoComplete="name" maxLength={80} required value={replyName} onChange={event => setReplyName(event.target.value)} placeholder="Your name" /></label>
        <label>Reply<textarea rows={3} maxLength={1200} required value={replyText} onChange={event => setReplyText(event.target.value)} placeholder="Write a reply…" /></label>
        <button type="submit">Post reply</button>
      </form>}
    </li>)}</ol>
  </section>;
}

export function PostPage() {
  const { slug } = useParams();
  const { data, error, loading } = useFetch<{ post: Post; relatedPosts: Post[]; prevPost: { title: string; slug: string } | null; nextPost: { title: string; slug: string } | null }>(`/posts/${slug}`);
  const post = data?.post; const body = useMemo(() => renderArticleContent(post?.content || ''), [post]);
  const [progress, setProgress] = useState(0), [activeHeading, setActiveHeading] = useState(''), [speaking, setSpeaking] = useState(false), [paused, setPaused] = useState(false), [audioError, setAudioError] = useState(''), [activeWord, setActiveWord] = useState('');
  const [speed, setSpeed] = useState<1 | 1.25 | 1.5>(1);
  const [copyLinkStatus, setCopyLinkStatus] = useState('');
  const pageRef = useRef<HTMLDivElement>(null), contentRef = useRef<HTMLDivElement>(null), utteranceRef = useRef<SpeechSynthesisUtterance | null>(null), speechBlockRef = useRef(0), speechPositionRef = useRef(0);
  const here = typeof location !== 'undefined' ? location.href : '';
  const getReadableBlocks = () => {
    const container = contentRef.current;
    return container ? Array.from(container.querySelectorAll<HTMLElement>('h2, h3, p, li, blockquote')) : [];
  };
  const clearReadingHighlight = () => {
    contentRef.current?.querySelectorAll('.reading-active-line').forEach(element => element.classList.remove('reading-active-line'));
    setActiveWord('');
  };
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
    setActiveWord('');
    speechPositionRef.current = 0;
    speechBlockRef.current = 0;
    return () => {
      const utterance = utteranceRef.current;
      if (utterance) {
        utterance.onboundary = null;
        utterance.onstart = null;
        utterance.onend = null;
        utterance.onerror = null;
      }
      contentRef.current?.querySelectorAll('.reading-active-line').forEach(element => element.classList.remove('reading-active-line'));
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      utteranceRef.current = null;
    };
  }, [slug]);
  const finishSpeech = () => {
    utteranceRef.current = null;
    speechPositionRef.current = 0;
    speechBlockRef.current = 0;
    clearReadingHighlight();
    setSpeaking(false);
    setPaused(false);
  };
  const speakBlock = (startIndex: number, rate: number, charOffset = 0, cancelCurrent = true) => {
    const blocks = getReadableBlocks();
    let index = startIndex;
    while (index < blocks.length && !(blocks[index].textContent || '').trim()) index++;
    if (index >= blocks.length) {
      finishSpeech();
      return;
    }

    const speech = window.speechSynthesis;
    const previous = utteranceRef.current;
    if (previous) {
      previous.onboundary = null;
      previous.onstart = null;
      previous.onend = null;
      previous.onerror = null;
    }
    if (cancelCurrent) {
      speech.cancel();
      clearReadingHighlight();
    }
    const element = blocks[index];
    const text = (element.textContent || '').trim();
    const utterance = new SpeechSynthesisUtterance(text.slice(charOffset));
    utterance.rate = rate;
    utterance.onstart = () => {
      if (utteranceRef.current !== utterance) return;
      contentRef.current?.querySelectorAll('.reading-active-line').forEach(active => active.classList.remove('reading-active-line'));
      element.classList.add('reading-active-line');
      setActiveWord('');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    utterance.onboundary = event => {
      if (utteranceRef.current !== utterance || event.name !== 'word') return;
      speechBlockRef.current = index;
      speechPositionRef.current = charOffset + event.charIndex;
      const currentText = utterance.text.slice(event.charIndex);
      setActiveWord(event.charLength > 0 ? utterance.text.slice(event.charIndex, event.charIndex + event.charLength).trim() : currentText.match(/^\S+/)?.[0] || '');
    };
    utterance.onend = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      speechBlockRef.current = index + 1;
      speechPositionRef.current = 0;
      speakBlock(index + 1, rate, 0, false);
    };
    utterance.onerror = () => {
      if (utteranceRef.current !== utterance) return;
      finishSpeech();
      setAudioError('Audio playback failed.');
    };
    speechBlockRef.current = index;
    speechPositionRef.current = charOffset;
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
    speakBlock(0, speed);
  };
  const stopSpeech = () => {
    const utterance = utteranceRef.current;
    if (utterance) {
      utterance.onboundary = null;
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
    }
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    speechPositionRef.current = 0;
    speechBlockRef.current = 0;
    clearReadingHighlight();
    setSpeaking(false);
    setPaused(false);
    setAudioError('');
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(here);
      setCopyLinkStatus('Link copied');
    } catch {
      setCopyLinkStatus('Could not copy link');
    }
  };
  const cycleSpeed = () => {
    const rates = [1, 1.25, 1.5] as const;
    const next = rates[(rates.indexOf(speed) + 1) % rates.length];
    setSpeed(next);
    if (speaking) {
      const wasPaused = paused;
      speakBlock(speechBlockRef.current, next, speechPositionRef.current);
      if (wasPaused) { window.speechSynthesis.pause(); setPaused(true); }
    }
  };
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const hasReadableArticle = Boolean(body.html.trim());
  const schemaData = post && {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.seoTitle || post.title, description: post.seoDescription || post.excerpt,
    image: post.image ? [new URL(post.image, location.origin).href] : undefined, datePublished: post.publishAt || post.createdAt,
    author: [{ '@type': 'Person', name: post.authorName || post.author?.name || 'Editorial Team' }],
    publisher: { '@type': 'Organization', name: SITE }, mainEntityOfPage: here
  };
  if (loading || error) return <State loading={loading} error={error} />;
  if (!post) return null;
  const u = encodeURIComponent(here), t = encodeURIComponent(post.title);
  const readMins = post.readingTime || readingTime(post.content || post.excerpt);
  return <>
    <div className="reading-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
    <PageMetadata title={`${post.seoTitle || post.title} | ${SITE}`} description={post.seoDescription || post.excerpt || ''} image={post.image} structuredData={schemaData} />
    <div ref={pageRef} className="post-page">
      <header className="post-header">
        <h1>{post.title}</h1>
        <div className="post-meta-bar">
          {post.category && <Link className="tag" to={`/category/${post.category.slug}`}>{post.category.name}</Link>}
          <span>Published on: <time dateTime={post.publishAt}>{fmt(post.publishAt)}</time></span>
          <span>Last Updated on: <time dateTime={post.updatedAt || post.publishAt}>{fmt(post.updatedAt || post.publishAt)}</time></span>
          <span>{readMins} Mins Read</span>
          <button type="button" className="copy-link-button" onClick={copyLink}>Copy link</button>
          <span className="audio-player" role="group" aria-label="Listen to article">
            <button type="button" onClick={toggleSpeech} disabled={!speechSupported || !hasReadableArticle} aria-label={speaking && !paused ? 'Pause article audio' : 'Play article audio'}>{speaking && !paused ? 'Pause' : 'Listen'}</button>
            <button type="button" onClick={stopSpeech} disabled={!speechSupported || !speaking}>Stop</button>
            <button type="button" onClick={cycleSpeed} disabled={!speechSupported} aria-label={`Playback speed ${speed}x; change speed`}>{speed}x</button>
            {speaking && activeWord && <span className="audio-current-word" aria-label={`Currently reading ${activeWord}`}>{activeWord}</span>}
          </span>
          <span className="sr" aria-live="polite">{audioError || copyLinkStatus}</span>
        </div>
        <p className="meta post-author-line">By {post.authorName || post.author?.name || 'Editorial Team'}</p>
      </header>
      <ArticleCover p={post} className="post-cover" />

      <div className="article-action-bar" role="group" aria-label="Share and save article">
        <span className="action-bar-label">Enjoying this story?</span>
        <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${u}`} target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <a href={`https://twitter.com/intent/tweet?url=${u}&text=${t}`} target="_blank" rel="noopener noreferrer">Share on X</a>
        <button type="button" onClick={copyLink}>Copy link</button>
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
          {body.toc.length > 0 && <details className="mobile-toc">
            <summary>In this article</summary>
            <nav className="toc" aria-label="In this article">
              <ul>{body.toc.map(item => <li key={item.id} className={'l' + item.lvl}><a className={activeHeading === item.id ? 'active' : ''} aria-current={activeHeading === item.id ? 'location' : undefined} href={`#${item.id}`}>{item.text}</a></li>)}</ul>
            </nav>
          </details>}
          <div
            ref={contentRef}
            className={`article-content prose${speaking ? ' is-reading' : ''}`}
            onClick={event => {
              if (!speaking || !(event.target instanceof Element) || event.target.closest('a, button')) return;
              const block = event.target.closest<HTMLElement>('h2, h3, p, li, blockquote');
              if (!block || !contentRef.current?.contains(block)) return;
              const index = getReadableBlocks().indexOf(block);
              if (index >= 0) speakBlock(index, speed);
            }}
            dangerouslySetInnerHTML={{ __html: body.html }}
          />
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
          <Discussion key={`discussion-${post.slug}`} slug={post.slug} />
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
