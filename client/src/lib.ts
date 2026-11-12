import { useEffect, useState } from 'react';
export type Cat = { _id: string; name: string; slug: string };
export type Post = { _id: string; title: string; slug: string; excerpt: string; content?: string; image?: string; category?: Cat; tags: string[]; author?: { name: string }; authorName?: string; status: string; publishAt: string; createdAt?: string; featured: boolean; views: number; seoTitle?: string; seoDescription?: string };
export type Paged = { items: Post[]; total: number; pages: number; page: number };
export const SITE = 'TechPulse';
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const h: Record<string, string> = {};
  if (!(opts.body instanceof FormData)) h['Content-Type'] = 'application/json';
  const t = localStorage.getItem('tok'); if (t) h.Authorization = 'Bearer ' + t;
  const r = await fetch(API_BASE + '/api' + path, { ...opts, headers: h });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 401 && t) { localStorage.clear(); } throw new Error(d.error || 'Request failed'); }
  return d as T;
}
export function useFetch<T>(path: string) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => {
    let on = true; setLoading(true); setError('');
    api<T>(path).then(d => on && setData(d)).catch(e => on && setError(e.message)).finally(() => on && setLoading(false));
    return () => { on = false; };
  }, [path]);
  return { data, error, loading };
}
export const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
export function useSeo(title: string, desc = '', image = '', ld?: object) {
  const key = JSON.stringify(ld || null);
  useEffect(() => {
    document.title = title;
    const set = (sel: string, attr: string, name: string, val: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(sel);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.content = val;
    };
    set('meta[name="description"]', 'name', 'description', desc);
    set('meta[property="og:title"]', 'property', 'og:title', title);
    set('meta[property="og:description"]', 'property', 'og:description', desc);
    set('meta[property="og:type"]', 'property', 'og:type', ld ? 'article' : 'website');
    set('meta[property="og:url"]', 'property', 'og:url', location.href);
    set('meta[property="og:image"]', 'property', 'og:image', image ? new URL(image, location.origin).href : '');
    set('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    let s = document.getElementById('ld-json');
    if (!ld) { s?.remove(); return; }
    if (!s) { s = document.createElement('script'); s.id = 'ld-json'; (s as HTMLScriptElement).type = 'application/ld+json'; document.head.appendChild(s); }
    s.textContent = key;
  }, [title, desc, image, key]);
}
