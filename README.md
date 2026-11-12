# TechPulse: MERN technology blog

React + TypeScript + Vite (client) and Express + MongoDB/Mongoose (server). Layout inspired by Zoho Blog.

## Run locally
Requires Node 18+ and MongoDB (local, or an Atlas URI).
```bash
npm install                 # root tools
npm run install:all         # server + client deps
cp server/.env.example server/.env     # then set JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
cp client/.env.example client/.env     # optional: Google Analytics / Search Console
npm run seed                # creates admin, 7 categories, 7 sample posts
npm run dev                 # site http://localhost:5173, API :5000, admin /admin
```
Production: `npm run build && npm start` (Express serves `client/dist`). Set `SITE_URL` and `CLIENT_ORIGIN` to your domain.
Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `server/.env` to store uploaded images in Cloudinary. Local development uses disk storage when these are unset; production uploads require Cloudinary credentials.

## What's included
- Public: homepage (featured, latest, trending, categories, search), listing with category/search/pagination, article page (TOC, reading time, share, related, prev/next, code/tables/YouTube).
- Admin (`/admin`): JWT login; create/edit/delete posts, drafts, scheduling (a published post with a future date appears automatically), featured toggle, image uploads, categories, SEO title/description/slug. Roles: `editor` (no deletes) and `admin`.
- SEO: clean URLs, `/sitemap.xml`, `/robots.txt`, Open Graph, BlogPosting JSON-LD, GA4 (`VITE_GA_ID`), Search Console token (`VITE_GSC_TOKEN`).
- Security: bcrypt, JWT (8h), login rate limit, Helmet, input whitelisting, upload type/size limits, DOMPurify on article HTML.

## Customize
Brand name `SITE` in `client/src/lib.ts`; colors/typography in the `:root` variables of `client/src/styles.css`; footer text in `client/src/App.tsx`.

## Known limits
- Meta tags and JSON-LD are set in the browser. Google renders JS, but social-card crawlers (Facebook, LinkedIn) don't, so use server-side rendering or prerendering for rich previews.
- The JWT is kept in localStorage; for higher-risk deployments move it to an httpOnly cookie with CSRF protection.
- Image uploads use Cloudinary when configured; without Cloudinary credentials, local development stores them in `server/uploads`.
- Author accounts can be created via `POST /api/admin/users` (admin only); there is no UI for it yet. Tags are free-form per post.
- No automated tests are included.
