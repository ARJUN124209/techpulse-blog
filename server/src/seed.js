import 'dotenv/config'; import mongoose from 'mongoose'; import bcrypt from 'bcryptjs';
import { User, Category, Post, slugify } from './models.js';
const { ADMIN_EMAIL, ADMIN_PASSWORD, MONGODB_URI = 'mongodb://127.0.0.1:27017/techblog' } = process.env;
if (!ADMIN_EMAIL || (ADMIN_PASSWORD || '').length < 10) { console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (10+ chars) in server/.env'); process.exit(1); }
await mongoose.connect(MONGODB_URI);
const admin = (await User.findOne({ email: ADMIN_EMAIL.toLowerCase() })) || await User.create({ name: 'Editorial Team', email: ADMIN_EMAIL, role: 'admin', passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12) });
const names = ['Software Development', 'Artificial Intelligence & Machine Learning', 'Web and Mobile App Development', 'Technology & Innovation', 'Cybersecurity', 'Cloud Computing', 'Industry Insights'];
const cats = {}; for (const n of names) cats[n] = await Category.findOneAndUpdate({ slug: slugify(n) }, { name: n, slug: slugify(n) }, { upsert: true, new: true });
const s = [
  ['Getting started with retrieval-augmented generation', names[1], true, '/seed-covers/rag.svg'],
  ['Zero-trust security for small teams', names[4], true, '/seed-covers/zero-trust.svg'],
  ['Choosing a cloud region without regrets', names[5], true, '/seed-covers/cloud-region.svg'],
  ['Clean architecture in a React codebase', names[0], false, '/seed-covers/clean-architecture.svg'],
  ['Shipping a mobile app with one codebase', names[2], false, '/seed-covers/mobile-app.svg'],
  ['What 2026 means for engineering leaders', names[6], false, '/seed-covers/engineering-leadership.svg'],
  ['Edge computing, explained plainly', names[3], false, '/seed-covers/edge-computing.svg']
];
if (!(await Post.countDocuments())) {
  const body = t => `## Why it matters\n\n${t} is changing how teams build and ship software. Here is a practical look.\n\n## Quick example\n\n\`\`\`js\nconst greet = (name) => \`Hello, \${name}!\`;\nconsole.log(greet('world'));\n\`\`\`\n\n## At a glance\n\n| Approach | Effort | Impact |\n|---|---|---|\n| Start small | Low | Medium |\n| Automate | Medium | High |\n\n## Next steps\n\nRead the [MDN docs](https://developer.mozilla.org) and try it on a small project.\n\n### Takeaways\n\n- Start small\n- Measure results\n- Iterate`;
  for (const [i, [title, c, featured, image]] of s.entries()) await Post.create({ title, slug: slugify(title), excerpt: `A practical guide to ${title.toLowerCase()}.`, content: body(title), image, category: cats[c]._id, tags: ['guide'], author: admin._id, status: 'published', featured, publishAt: new Date(Date.now() - i * 864e5), views: 100 - i * 9 });
}
for (const [title, , , image] of s) await Post.updateOne({ slug: slugify(title), $or: [{ image: { $exists: false } }, { image: null }, { image: '' }] }, { $set: { image } });
console.log('Seeded. Sign in at /admin with', ADMIN_EMAIL); await mongoose.disconnect();
