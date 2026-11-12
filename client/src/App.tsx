import { useEffect, useRef, useState, FormEvent } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { Cat, SITE, useFetch } from './lib';
import { Home, Blog, PostPage, SavedPage } from './pages';
import { Admin } from './admin';
import { SavedArticlesProvider, useSavedArticles } from './saved';

const ga = (import.meta.env.VITE_GA_MEASUREMENT_ID || import.meta.env.VITE_GA_ID) as string | undefined;
const gaEnabled = Boolean(ga && /^G-[A-Z0-9]+$/.test(ga));
if (ga && gaEnabled) ReactGA.initialize(ga, { gaOptions: { send_page_view: false } });

function Shell({ children }: { children: React.ReactNode }) {
  const { data: cats } = useFetch<Cat[]>('/categories'); const nav = useNavigate(); const { pathname } = useLocation();
  const { articles: savedArticles } = useSavedArticles();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
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
      <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
      </button>
      <button className="burger" aria-expanded={open} aria-controls="menu" onClick={() => setOpen(!open)}>Menu</button>
      <nav id="menu" aria-label="Main" className={open ? 'open' : ''}>
        <NavLink to="/" end>Home</NavLink><NavLink to="/blog">All articles</NavLink>
        <NavLink to="/saved" className="saved-nav">Saved <span className="saved-count">{savedArticles.length}</span></NavLink>
        <form role="search" onSubmit={search}><label className="sr" htmlFor="q">Search articles</label><input id="q" name="q" type="search" placeholder="Search articles" maxLength={60} /><button>Search</button></form>
      </nav>
    </div>
    <nav className="wrap cats" aria-label="Categories">{cats?.map(c => <NavLink key={c._id} to={`/category/${c.slug}`}>{c.name}</NavLink>)}</nav></header>
    <main id="main" className="wrap">{children}</main>
    <footer><div className="wrap foot">
      <div><strong>{SITE}</strong><p>Practical writing on software, AI, cloud and security from our engineering team.</p><p>© {new Date().getFullYear()} {SITE} Technologies. 12 Example Street, Chennai, India.</p></div>
      <div><strong>Useful links</strong><Link to="/blog">All articles</Link><a href="/sitemap.xml">Sitemap</a><Link to="/admin">Team sign in</Link></div>
      <div><strong>Follow us</strong><a href="https://x.com" rel="noopener noreferrer">X</a><a href="https://www.linkedin.com" rel="noopener noreferrer">LinkedIn</a><a href="https://github.com" rel="noopener noreferrer">GitHub</a></div>
    </div></footer></>);
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
