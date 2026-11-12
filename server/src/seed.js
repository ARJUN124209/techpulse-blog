import 'dotenv/config'; import mongoose from 'mongoose'; import bcrypt from 'bcryptjs';
import { User, Category, Post, slugify } from './models.js';
const { ADMIN_EMAIL, ADMIN_PASSWORD, MONGODB_URI = 'mongodb://127.0.0.1:27017/techblog' } = process.env;
if (!ADMIN_EMAIL || (ADMIN_PASSWORD || '').length < 10) { console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (10+ chars) in server/.env'); process.exit(1); }
await mongoose.connect(MONGODB_URI);
const admin = (await User.findOne({ email: ADMIN_EMAIL.toLowerCase() })) || await User.create({ name: 'Editorial Team', email: ADMIN_EMAIL, role: 'admin', passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12) });
const names = ['Software Development', 'Artificial Intelligence & Machine Learning', 'Web and Mobile App Development', 'Technology & Innovation', 'Cybersecurity', 'Cloud Computing', 'Industry Insights'];
const cats = {}; for (const n of names) cats[n] = await Category.findOneAndUpdate({ slug: slugify(n) }, { name: n, slug: slugify(n) }, { upsert: true, new: true });
if (!(await Post.countDocuments())) {
  const body = t => `## Why it matters\n\n${t} is changing how teams build and ship software. Here is a practical look.\n\n## Quick example\n\n\`\`\`js\nconst greet = (name) => \`Hello, \${name}!\`;\nconsole.log(greet('world'));\n\`\`\`\n\n## At a glance\n\n| Approach | Effort | Impact |\n|---|---|---|\n| Start small | Low | Medium |\n| Automate | Medium | High |\n\n## Next steps\n\nRead the [MDN docs](https://developer.mozilla.org) and try it on a small project.\n\n### Takeaways\n\n- Start small\n- Measure results\n- Iterate`;
  const s = [['Getting started with retrieval-augmented generation', names[1], true], ['Zero-trust security for small teams', names[4], true], ['Choosing a cloud region without regrets', names[5], true], ['Clean architecture in a React codebase', names[0], false], ['Shipping a mobile app with one codebase', names[2], false], ['What 2026 means for engineering leaders', names[6], false], ['Edge computing, explained plainly', names[3], false]];
  for (const [i, [title, c, featured]] of s.entries()) await Post.create({ title, slug: slugify(title), excerpt: `A practical guide to ${title.toLowerCase()}.`, content: body(title), category: cats[c]._id, tags: ['guide'], author: admin._id, status: 'published', featured, publishAt: new Date(Date.now() - i * 864e5), views: 100 - i * 9 });
}
console.log('Seeded. Sign in at /admin with', ADMIN_EMAIL); await mongoose.disconnect();
