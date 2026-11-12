import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Cat } from './lib';

export type SavedArticle = {
  slug: string;
  title: string;
  excerpt: string;
  publishAt: string;
  image?: string;
  category?: Cat;
  authorName?: string;
};

const STORAGE_KEY = 'techpulse-saved';

function isSavedArticle(value: unknown): value is SavedArticle {
  if (!value || typeof value !== 'object') return false;
  const article = value as Record<string, unknown>;
  const category = article.category;
  const validCategory = category === undefined || (
    !!category && typeof category === 'object' &&
    typeof (category as Record<string, unknown>)._id === 'string' &&
    typeof (category as Record<string, unknown>).name === 'string' &&
    typeof (category as Record<string, unknown>).slug === 'string'
  );
  return typeof article.slug === 'string' && typeof article.title === 'string' &&
    typeof article.excerpt === 'string' && typeof article.publishAt === 'string' &&
    (article.image === undefined || typeof article.image === 'string') &&
    (article.authorName === undefined || typeof article.authorName === 'string') && validCategory;
}

function readSavedArticles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { articles: [] as SavedArticle[], error: '' };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Saved articles must be an array.');
    const articles = parsed.filter(isSavedArticle);
    const error = articles.length === parsed.length ? '' : 'Some saved articles could not be loaded.';
    if (error) console.error(error);
    return { articles, error };
  } catch (error) {
    console.error('Could not read saved articles.', error);
    return { articles: [] as SavedArticle[], error: 'Saved articles could not be loaded from this browser.' };
  }
}

type SavedArticlesValue = {
  articles: SavedArticle[];
  error: string;
  isSaved: (slug: string) => boolean;
  toggleSaved: (article: SavedArticle) => boolean;
};

const SavedArticlesContext = createContext<SavedArticlesValue | null>(null);

export function toSavedArticle(article: SavedArticle): SavedArticle {
  return {
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    publishAt: article.publishAt,
    ...(article.image ? { image: article.image } : {}),
    ...(article.category ? { category: article.category } : {}),
    ...(article.authorName ? { authorName: article.authorName } : {})
  };
}

export function SavedArticlesProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(readSavedArticles);
  const [articles, setArticles] = useState(initial.articles);
  const [error, setError] = useState(initial.error);
  const articlesRef = useRef(articles);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const current = readSavedArticles();
      articlesRef.current = current.articles;
      setArticles(current.articles);
      setError(current.error);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const isSaved = useCallback((slug: string) => articles.some(article => article.slug === slug), [articles]);
  const toggleSaved = useCallback((article: SavedArticle) => {
    const current = articlesRef.current;
    const next = current.some(item => item.slug === article.slug)
      ? current.filter(item => item.slug !== article.slug)
      : [toSavedArticle(article), ...current];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (storageError) {
      console.error('Could not update saved articles.', storageError);
      setError('Could not update the reading list. Check this browser’s storage settings.');
      return false;
    }
    articlesRef.current = next;
    setArticles(next);
    setError('');
    return true;
  }, []);

  const value = useMemo(() => ({ articles, error, isSaved, toggleSaved }), [articles, error, isSaved, toggleSaved]);
  return <SavedArticlesContext.Provider value={value}>{children}</SavedArticlesContext.Provider>;
}

export function useSavedArticles() {
  const value = useContext(SavedArticlesContext);
  if (!value) throw new Error('useSavedArticles must be used within SavedArticlesProvider.');
  return value;
}
