import 'dotenv/config';
import express from 'express'; import mongoose from 'mongoose'; import helmet from 'helmet'; import cors from 'cors';
import rateLimit from 'express-rate-limit'; import bcrypt from 'bcryptjs'; import jwt from 'jsonwebtoken';
import path from 'path'; import fs from 'fs'; import { fileURLToPath } from 'url';
import { User, Category, Post, slugify } from './models.js';
import articleRoutes from './routes/articleRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';

const { JWT_SECRET, MONGODB_URI = 'mongodb://127.0.0.1:27017/techblog', PORT = 5000, SITE_URL = 'http://localhost:5173' } = process.env;
if (!JWT_SECRET || JWT_SECRET.length < 32) { console.error('Set JWT_SECRET (32+ chars) in server/.env'); process.exit(1); }
const __dir = path.dirname(fileURLToPath(import.meta.url));
const uploads = path.join(__dir, '../uploads'); const dist = path.join(__dir, '../../client/dist');

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CLIENT_ORIGIN,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploads, { maxAge: '7d' }));
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);
const live = () => ({ status: 'published', publishAt: { $lte: new Date() } }); // scheduled posts appear automatically
const list = q => q.populate('category', 'name slug').populate('author', 'name');
const auth = (...roles) => (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Please sign in' }); }
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission' }); next();
};
app.use('/api/articles', auth('admin', 'editor'), articleRoutes);
app.use('/api/upload', auth('admin', 'editor'), uploadRoutes);

// ---------- Public API ----------
app.get('/api/categories', wrap(async (_, res) => res.json(await Category.find().sort('name'))));
app.get('/api/posts', wrap(async (req, res) => {
  const requestedPage = Number.parseInt(String(req.query.page ?? ''), 10);
  const requestedLimit = Number.parseInt(String(req.query.limit ?? ''), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = Number.isFinite(requestedLimit) ? Math.min(24, Math.max(1, requestedLimit)) : 6;
  const search = typeof req.query.search === 'string' ? req.query.search : typeof req.query.q === 'string' ? req.query.q : '';
  const f = live();
  if (req.query.category) { const c = await Category.findOne({ slug: String(req.query.category) }); f.category = c ? c._id : null; }
  if (search.trim()) { const r = new RegExp(search.trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); f.$or = [{ title: r }, { excerpt: r }, { content: r }, { tags: r }]; }
  const [items, total] = await Promise.all([list(Post.find(f).select('-content').sort('-publishAt').skip((page - 1) * limit).limit(limit)), Post.countDocuments(f)]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}));
app.get('/api/posts/featured', wrap(async (_, res) => res.json(await list(Post.find({ ...live(), featured: true }).select('-content').sort('-publishAt').limit(3)))));
const mostViewedPosts = wrap(async (_, res) => res.json(await list(Post.find(live()).select('-content').sort('-views').limit(5))));
app.get('/api/posts/popular', mostViewedPosts);
app.get('/api/posts/trending', mostViewedPosts);
app.get('/api/posts/:slug', wrap(async (req, res) => {
  const p = await list(Post.findOneAndUpdate({ slug: String(req.params.slug), ...live() }, { $inc: { views: 1 } }, { new: true }));
  if (!p) return res.status(404).json({ error: 'Article not found' });
  const [related, prev, next] = await Promise.all([
    list(Post.find({ ...live(), category: p.category?._id, _id: { $ne: p._id } }).select('-content').limit(2)),
    Post.findOne({ status: 'published', publishAt: { $lt: p.publishAt } }).sort('-publishAt').select('title slug'),
    Post.findOne({ status: 'published', publishAt: { $gt: p.publishAt, $lte: new Date() } }).sort('publishAt').select('title slug')]);
  res.json({ post: p, prevPost: prev, nextPost: next, relatedPosts: related });
}));
app.get('/robots.txt', (_, res) => res.type('text').send(`User-agent: *\nDisallow: /admin\nSitemap: ${SITE_URL}/sitemap.xml\n`));
app.get('/sitemap.xml', wrap(async (_, res) => {
  const [posts, cats] = await Promise.all([Post.find(live()).select('slug updatedAt'), Category.find()]);
  const u = (loc, d) => `<url><loc>${SITE_URL}${loc}</loc>${d ? `<lastmod>${d.toISOString()}</lastmod>` : ''}</url>`;
  res.type('xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${u('/')}${u('/blog')}${cats.map(c => u('/category/' + c.slug)).join('')}${posts.map(p => u('/blog/' + p.slug, p.updatedAt)).join('')}</urlset>`);
}));

// ---------- Auth ----------
app.post('/api/auth/login', rateLimit({ windowMs: 15 * 60e3, max: 10, message: { error: 'Too many attempts. Try again in 15 minutes.' } }), wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const u = typeof email === 'string' && typeof password === 'string' ? await User.findOne({ email: email.toLowerCase() }).select('+passwordHash') : null;
  if (!u || !(await bcrypt.compare(password, u.passwordHash))) return res.status(401).json({ error: 'Incorrect email or password' });
  res.json({ token: jwt.sign({ id: u.id, role: u.role, name: u.name }, JWT_SECRET, { expiresIn: '8h' }), user: { id: u.id, name: u.name, role: u.role } });
}));

// ---------- Admin API (editor + admin) ----------
const admin = express.Router(); admin.use(auth('admin', 'editor')); app.use('/api/admin', admin);
admin.use('/articles', articleRoutes);
admin.use('/upload', uploadRoutes);
const url = v => typeof v === 'string' && (/^\/uploads\/[\w.-]+$/.test(v) || /^https:\/\/\S+$/.test(v));
const pick = b => {
  const o = {}; for (const k of ['title', 'excerpt', 'content', 'seoTitle', 'seoDescription']) if (typeof b[k] === 'string') o[k] = b[k].slice(0, k === 'content' ? 200000 : 400).trim();
  if (typeof b.authorName === 'string') o.authorName = b.authorName.trim().slice(0, 100);
  if (b.image === '' || url(b.image)) o.image = b.image;
  if (mongoose.isValidObjectId(b.category)) o.category = b.category;
  if (Array.isArray(b.tags)) o.tags = b.tags.filter(t => typeof t === 'string').map(t => t.trim().slice(0, 30)).filter(Boolean).slice(0, 10);
  if (['draft', 'published'].includes(b.status)) o.status = b.status;
  if (typeof b.featured === 'boolean') o.featured = b.featured;
  if (b.publishAt && !isNaN(new Date(b.publishAt))) o.publishAt = new Date(b.publishAt);
  if (b.slug || o.title) o.slug = slugify(b.slug || o.title);
  return o;
};
const resolveAuthorId = async (value, user) => {
  if (user.role !== 'admin' || value == null || value === '') return user.id;
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value) || !(await User.exists({ _id: value }))) return null;
  return value;
};
const fail = (e, res) => { if (e.code === 11000) return res.status(409).json({ error: 'That URL slug or name is already used' }); throw e; };
admin.get('/posts', wrap(async (_, res) => res.json(await list(Post.find().select('-content').sort('-updatedAt').limit(200)))));
admin.get('/posts/:id', wrap(async (req, res) => { const p = mongoose.isValidObjectId(req.params.id) && await Post.findById(req.params.id); p ? res.json(p) : res.status(404).json({ error: 'Not found' }); }));
admin.post('/posts', wrap(async (req, res) => {
  const d = pick(req.body); if (!d.title) return res.status(400).json({ error: 'Title is required' });
  const author = await resolveAuthorId(req.body?.author, req.user);
  if (!author) return res.status(400).json({ error: 'Choose a valid author' });
  try { res.status(201).json(await Post.create({ ...d, author, authorName: d.authorName || 'Editorial Team' })); } catch (e) { fail(e, res); }
}));
admin.put('/posts/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  const updates = pick(req.body);
  if (req.user.role === 'admin' && Object.prototype.hasOwnProperty.call(req.body || {}, 'author')) {
    const author = await resolveAuthorId(req.body.author, req.user);
    if (!author) return res.status(400).json({ error: 'Choose a valid author' });
    updates.author = author;
  }
  try { const p = await Post.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }); p ? res.json(p) : res.status(404).json({ error: 'Not found' }); } catch (e) { fail(e, res); }
}));
admin.delete('/posts/:id', auth('admin'), wrap(async (req, res) => { await Post.findByIdAndDelete(req.params.id); res.json({ ok: true }); }));
admin.post('/categories', wrap(async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 60); if (!name) return res.status(400).json({ error: 'Name is required' });
  try { res.status(201).json(await Category.create({ name, slug: slugify(name) })); } catch (e) { fail(e, res); }
}));
admin.put('/categories/:id', wrap(async (req, res) => { const name = String(req.body?.name || '').trim().slice(0, 60); if (!name) return res.status(400).json({ error: 'Name is required' }); try { res.json(await Category.findByIdAndUpdate(req.params.id, { name, slug: slugify(name) }, { new: true })); } catch (e) { fail(e, res); } }));
admin.delete('/categories/:id', auth('admin'), wrap(async (req, res) => {
  if (await Post.exists({ category: req.params.id })) return res.status(409).json({ error: 'Move or delete the posts in this category first' });
  await Category.findByIdAndDelete(req.params.id); res.json({ ok: true });
}));
admin.get('/authors', wrap(async (_, res) => res.json(await User.find().select('name email role'))));
admin.post('/users', auth('admin'), wrap(async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !/^\S+@\S+\.\S+$/.test(email || '') || String(password || '').length < 10) return res.status(400).json({ error: 'Name, valid email and a 10+ character password are required' });
  try { const u = await User.create({ name, email, role: role === 'admin' ? 'admin' : 'editor', passwordHash: await bcrypt.hash(password, 12) }); res.status(201).json({ id: u.id, name: u.name }); } catch (e) { fail(e, res); }
}));
// ---------- Production: serve built client ----------
if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get(/^\/(?!api|uploads).*/, (_, res) => res.sendFile(path.join(dist, 'index.html'))); }
app.use('/api', (_, res) => res.status(404).json({ error: 'Not found' }));
app.use((e, _req, res, _next) => {
  const msg = e.code === 'LIMIT_FILE_SIZE' ? 'Image must be under 5 MB' : e.message?.startsWith('Only') ? e.message : null;
  if (!msg) console.error(e); res.status(msg ? 400 : 500).json({ error: msg || 'Something went wrong' });
});
mongoose.connect(MONGODB_URI).then(() => app.listen(PORT, () => console.log(`API on :${PORT}`))).catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
