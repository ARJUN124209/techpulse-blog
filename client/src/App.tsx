import { useCallback, useEffect, useRef, useState, FormEvent } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { Cat, SITE, useFetch } from './lib';
import { Home, Blog, PostPage, SavedPage, SpotlightSearch } from './pages';
import { Admin } from './admin';
import { SavedArticlesProvider, useSavedArticles } from './saved';

const ga = (import.meta.env.VITE_GA_MEASUREMENT_ID || import.meta.env.VITE_GA_ID) as string | undefined;
const gaEnabled = Boolean(ga && /^G-[A-Z0-9]+$/.test(ga));
if (ga && gaEnabled) ReactGA.initialize(ga, { gaOptions: { send_page_view: false } });

function ShieldIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="M10 2.5 16 4.7v4.6c0 3.8-2.3 6.7-6 8.7-3.7-2-6-4.9-6-8.7V4.7z" />
    <path d="m7.5 9.8 1.7 1.7 3.4-3.7" />
  </svg>;
}

function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      localStorage.setItem('techpulse:newsletter-email', email.trim());
      setStatus('Saved on this device. Newsletter delivery is not configured yet.');
      setError('');
      setEmail('');
    } catch {
      setError('Could not save your email in this browser.');
      setStatus('');
    }
  };
  return <section className="footer-newsletter" aria-labelledby="footer-newsletter-title">
    <strong id="footer-newsletter-title">Newsletter</strong>
    <p>Thoughtful engineering stories, occasionally.</p>
    <form className="footer-newsletter-form" onSubmit={submit}>
      <label className="sr" htmlFor="footer-newsletter-email">Your email address</label>
      <input id="footer-newsletter-email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} />
      <button type="submit">Join</button>
    </form>
    <small className="newsletter-status" role={error ? 'alert' : 'status'}>{error || status || 'Email is saved locally; delivery is not connected.'}</small>
  </section>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const { data: cats } = useFetch<Cat[]>('/categories'); const nav = useNavigate(); const { pathname } = useLocation();
  const { articles: savedArticles } = useSavedArticles();
  const [open, setOpen] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const [hasAdminToken] = useState(() => Boolean(localStorage.getItem('tok')));
  const openSpotlight = useCallback(() => setSpotlightOpen(true), []);
  const closeSpotlight = useCallback(() => setSpotlightOpen(false), []);
  useEffect(() => { setOpen(false); setSpotlightOpen(false); window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSpotlight();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [openSpotlight]);
  const search = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const q = String(new FormData(e.currentTarget).get('q') || '').trim(); if (q) nav(`/blog?q=${encodeURIComponent(q)}`); };
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
    setTheme(next);
  };
  return (<>
    <a className="skip" href="#main">Skip to content</a>
    <header className="top"><div className="wrap bar">
      <Link to="/" className="logo" aria-label={`${SITE} home`}><span aria-hidden="true">▲</span> {SITE}</Link>
      <div className="header-actions">
        <button className="mobile-search-trigger" type="button" onClick={openSpotlight} aria-label="Search articles (Ctrl+K)">
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
          <span>Ctrl+K</span>
        </button>
        <Link to="/admin" className="team-sign-in header-team-sign-in"><ShieldIcon />{hasAdminToken ? 'Dashboard' : 'Team sign in'}</Link>
        <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          <span className="theme-icon" aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          <span className="theme-toggle-label">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
        <button className="burger" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="menu" onClick={() => setOpen(!open)}><span aria-hidden="true">☰</span></button>
      </div>
      <nav id="menu" aria-label="Main" className={open ? 'open' : ''}>
        <NavLink to="/" end>Home</NavLink><NavLink to="/blog">All articles</NavLink>
        <details className="saved-drawer">
          <summary className="saved-nav">Saved <span className="saved-count">{savedArticles.length}</span></summary>
          <div className="saved-drawer-panel">
            <strong>Reading list</strong>
            {savedArticles.length
              ? <ul>{savedArticles.slice(0, 5).map(article => <li key={article.slug}>
                <Link to={`/blog/${article.slug}`} onClick={event => event.currentTarget.closest('details')?.removeAttribute('open')}>{article.title}</Link>
              </li>)}</ul>
              : <p>No saved stories yet. Bookmark an article to keep it here.</p>}
            <Link className="saved-drawer-all" to="/saved" onClick={event => event.currentTarget.closest('details')?.removeAttribute('open')}>View all saved stories <span aria-hidden="true">&rarr;</span></Link>
          </div>
        </details>
        <form role="search" onSubmit={search}><label className="sr" htmlFor="q">Search articles</label><input id="q" name="q" type="search" placeholder="Search articles" maxLength={60} /><button>Search</button><button type="button" className="search-shortcut" onClick={openSpotlight} aria-label="Open spotlight search">Ctrl K</button></form>
        <Link to="/admin" className="team-sign-in mobile-team-sign-in"><ShieldIcon />{hasAdminToken ? 'Dashboard' : 'Team sign in'}</Link>
      </nav>
    </div>
    <nav className="wrap cats" aria-label="Categories">{cats?.map(c => <NavLink key={c._id} to={`/category/${c.slug}`}>{c.name}</NavLink>)}</nav></header>
    <main id="main" className="wrap">{children}</main>
    <footer><div className="wrap foot">
      <div><strong>{SITE}</strong><p>Practical writing on software, AI, cloud and security from our engineering team.</p><p>© {new Date().getFullYear()} {SITE} Technologies.<br />TIDEL Park, Rajiv Gandhi Salai, Taramani, Chennai, Tamil Nadu 600113</p></div>
      <div><strong>Useful links</strong><Link to="/blog">All articles</Link><a href="/sitemap.xml">Sitemap</a><Link className="team-sign-in footer-team-sign-in" to="/admin"><ShieldIcon />Team sign in</Link></div>
      <div><strong>Follow us</strong><a href="https://x.com" rel="noopener noreferrer">X</a><a href="https://www.linkedin.com" rel="noopener noreferrer">LinkedIn</a><a href="https://github.com" rel="noopener noreferrer">GitHub</a></div>
      <NewsletterForm />
    </div></footer>
    {spotlightOpen && <SpotlightSearch onClose={closeSpotlight} />}
  </>);
}
export default function App() {
  const location = useLocation();
  const lastTrackedPage = useRef<string | null>(null);
  useEffect(() => {
    if (!gaEnabled) return;
    const page = `${location.pathname}${location.search}`;
    if (lastTrackedPage.current === page) return;
    lastTrackedPage.current = page;
    ReactGA.send({ hitType: 'pageview', page });
  }, [location.pathname, location.search]);

  return <SavedArticlesProvider><Routes>
    <Route path="/admin" element={<Admin />} />
    <Route path="*" element={<Shell><Routes>
      <Route path="/" element={<Home />} /><Route path="/blog" element={<Blog />} /><Route path="/category/:slug" element={<Blog />} />
      <Route path="/blog/:slug" element={<PostPage />} /><Route path="/saved" element={<SavedPage />} />
      <Route path="*" element={<p className="state">Page not found. <Link to="/">Go to the homepage</Link>.</p>} />
    </Routes></Shell>} />
  </Routes></SavedArticlesProvider>;
}
