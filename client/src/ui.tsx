import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Post, fmt } from './lib';
import { SavedArticle, useSavedArticles } from './saved';

type CardPost = Pick<Post, 'slug' | 'title' | 'excerpt' | 'publishAt'> & Pick<Post, 'image' | 'category' | 'authorName' | 'author'>;

export function BookmarkButton({ article }: { article: SavedArticle }) {
  const { isSaved, toggleSaved } = useSavedArticles();
  const [error, setError] = useState('');
  const saved = isSaved(article.slug);
  return <span className="bookmark-control">
    <button
      type="button"
      className={`bookmark-toggle${saved ? ' is-saved' : ''}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${article.title} from saved articles` : `Save ${article.title}`}
      onClick={() => setError(toggleSaved(article) ? '' : 'Could not update the reading list.')}
    ><span aria-hidden="true">{saved ? '★' : '☆'}</span> {saved ? 'Saved' : 'Save'}</button>
    {error && <span className="bookmark-error" role="alert">{error}</span>}
  </span>;
}

export function Thumb({ p }: { p: CardPost }) {
  return p.image
    ? <img src={p.image} alt={`Cover image for ${p.title}`} loading="lazy" width={800} height={450} />
    : <div className="ph" role="img" aria-label={`${p.category?.name ?? 'Article'} placeholder`}>{(p.category?.name ?? 'T')[0]}</div>;
}
export function Card({ p }: { p: CardPost }) {
  return (
    <article className="card">
      <Link to={`/blog/${p.slug}`} className="thumb" tabIndex={-1} aria-hidden="true"><Thumb p={p} /></Link>
      <BookmarkButton article={p} />
      {p.category && <Link className="tag" to={`/category/${p.category.slug}`}>{p.category.name}</Link>}
      <h3><Link to={`/blog/${p.slug}`}>{p.title}</Link></h3>
      <p>{p.excerpt}</p>
      <small>{p.authorName || p.author?.name || 'Editorial Team'} · <time dateTime={p.publishAt}>{fmt(p.publishAt)}</time></small>
    </article>
  );
}
export function State({ loading, error, empty }: { loading?: boolean; error?: string; empty?: string }) {
  if (loading) return <p className="state" role="status">Loading…</p>;
  if (error) return <p className="state err" role="alert">{error}. Check that the API is running, then reload.</p>;
  if (empty) return <p className="state">{empty}</p>;
  return null;
}
