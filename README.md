# TechPulse

TechPulse is a full-stack technology blog with a responsive reader experience and an authenticated editorial CMS.

## Live site

- **Frontend:** [techpulse-blog-ashen.vercel.app](https://techpulse-blog-ashen.vercel.app)
- **Backend API and XML sitemap:** [techpulse-blog-f95t.onrender.com/api/sitemap.xml](https://techpulse-blog-f95t.onrender.com/api/sitemap.xml)
- **Admin panel:** open `/admin` on the frontend to sign in.

## Project overview

TechPulse publishes practical articles about software, AI, cloud computing, cybersecurity, and related technology topics. Its editorial layout takes inspiration from the clean, structured reading experience of Zoho Blog while using original TechPulse branding, content, and implementation.

The public site provides article discovery and reading tools; the CMS lets authorized team members manage posts, media, authors, and categories. The frontend is a React single-page application, and the Express API persists content in MongoDB Atlas (or a local MongoDB instance).

## Features

### Reader experience

- Responsive homepage with featured, latest, trending, and category sections.
- Article browsing with category filters, search, and pagination.
- Persistent light/dark theme preference.
- Listen-to-article player using browser speech synthesis, with play/pause, stop, and speed controls.
- Saved-article bookmarks and a local reading list persisted in browser storage.
- Reading progress bar and an auto-generated, scroll-spy table of contents.
- One-click code-block copying.
- Rich article rendering for headings, images, tables, code, and supported YouTube embeds.
- Social sharing, related articles, and previous/next article navigation.
- Estimated reading time.

### CMS admin panel

- JWT-authenticated sign-in with `admin` and `editor` roles.
- Create, read, update, and delete post workflows; deletion is restricted to admins.
- Draft and published posts, with future `publishAt` dates providing scheduled publication.
- Dashboard KPI cards, status/featured filters, and quick post search.
- Live split preview while composing or editing an article.
- Featured post curation.
- Featured and inline image uploads through Cloudinary when configured.
- Category management and admin tools for author accounts.
- SEO slug, title, and description fields.

### Technical SEO

- Dynamic page titles and Open Graph/Twitter metadata for articles.
- `BlogPosting` JSON-LD structured data on article pages.
- `robots.txt` for crawler guidance.
- XML sitemap generation from published content and categories at `/api/sitemap.xml` (also available at `/sitemap.xml` on the backend).
- Public article and sitemap results exclude future-dated posts until their publication time.

## Tech stack

| Area | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Router |
| Rich-text editing and rendering | React Quill, Marked, DOMPurify |
| Backend | Node.js, Express |
| Database | MongoDB Atlas or local MongoDB, accessed with Mongoose |
| Authentication | JSON Web Tokens (JWT), bcrypt |
| Image storage | Cloudinary in production; local disk storage for development |

## Local development

### Prerequisites

- Node.js 18 or newer and npm.
- MongoDB locally, or a MongoDB Atlas connection string.

### Install dependencies

From the repository root:

```bash
npm run install:all
```

### Configure environment

Create local environment files from the checked-in templates.

PowerShell:

```powershell
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
```

macOS/Linux:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Set the required values in `server/.env`:

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Signing key for admin tokens; use a random secret of at least 32 characters. |
| `MONGODB_URI` | MongoDB connection string. The template defaults to local MongoDB. |
| `ADMIN_EMAIL` | Email address for the initial administrator account. |
| `ADMIN_PASSWORD` | Initial administrator password; at least 10 characters. |
| `PORT` | API port; defaults to `5000`. |
| `CLIENT_ORIGIN` | Allowed local frontend origin; defaults to `http://localhost:5173`. |
| `SITE_URL` | Canonical site base URL used when generating sitemap and crawler URLs. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Optional Cloudinary credentials. All three are needed for Cloudinary uploads. |

`client/.env.example` contains optional frontend settings:

- `VITE_API_URL`: leave empty for local development; Vite proxies API requests to `http://localhost:5000`. Set this when building the frontend for a separate API host.
- `VITE_GA_MEASUREMENT_ID` (or the supported legacy `VITE_GA_ID`): optional Google Analytics 4 measurement ID.
- `VITE_GSC_TOKEN`: optional Search Console verification token.

Do not commit `.env` files or production credentials.

### Seed the database and run the app

```bash
npm run seed
npm run dev
```

The seed command runs `server/src/seed.js`. It creates the initial admin account and categories, adds seven sample articles when the database has no posts, and backfills missing cover-image values for those seeded articles. It uses `MONGODB_URI`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` from `server/.env`.

The development frontend is available at [http://localhost:5173](http://localhost:5173), the API at [http://localhost:5000](http://localhost:5000), and the CMS at [http://localhost:5173/admin](http://localhost:5173/admin).

### Production build

```bash
npm run build
npm start
```

The build command creates `client/dist`; when that directory exists, the Express server serves the built frontend. Configure production `SITE_URL`, `CLIENT_ORIGIN`, `MONGODB_URI`, `JWT_SECRET`, admin credentials, and Cloudinary credentials as appropriate for the deployment.

## Repository layout

```text
client/       React application, static assets, and Vite configuration
server/       Express API, MongoDB models, routes, and seed script
README.md     Project documentation
```

## Security and deployment notes

- Admin passwords are hashed with bcrypt; JWTs expire after eight hours, and login attempts are rate-limited.
- Article HTML is sanitized before rendering. Image uploads are type- and size-limited.
- The client stores its JWT in `localStorage`; deployments with higher security requirements should consider an `httpOnly` cookie design with CSRF protection.
- Article SEO metadata is rendered client-side. Some social preview crawlers do not execute JavaScript; server-side rendering or prerendering may be needed for consistent link previews on those platforms.
- Cloudinary is required for production image uploads. Without Cloudinary settings, local development stores uploaded images under `server/uploads`.
