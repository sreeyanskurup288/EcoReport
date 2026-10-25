# EcoReport

EcoReport is a responsive React + TypeScript frontend for the Team EcoWatch environmental issue reporting project. It includes a clearly labeled preview mode and an API client designed for a Node.js/Express backend with PostgreSQL.

## Run in Cursor

1. Install Node.js (Vite currently requires Node.js 20.19+ or 22.12+).
2. Open this folder in Cursor and open its terminal.
3. Run `npm install` and then `npm run dev`.
4. Open the local URL printed in the terminal.

The interface starts with sample data in preview mode. Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to your Express server URL when the backend is ready. The frontend sends cookies with requests; configure the API and CORS to support credentialed requests. Never put a database password or privileged server key in a `VITE_` variable.

## API contract

- `GET /api/auth/me` → `{ user }`
- `POST /api/auth/signup` body `{ name, email, password }` → `{ user }`
- `POST /api/auth/login` body `{ email, password }` → `{ user }`
- `POST /api/auth/logout` → `204 No Content`
- `GET /api/reports` → `{ reports: Report[] }`
- `GET /api/reports/:id` → `{ report: Report }`
- `POST /api/reports` multipart fields: `type`, `description`, `location`, `severity`, `date`, optional `latitude`, `longitude`, `photo` → `{ report }`
- `PATCH /api/reports/:id/status` body `{ status, note }` → `{ report }` (moderator/admin only)
- `GET /api/analytics/summary` → `{ summary }`

The `Report` shape is defined in `src/types.ts`. The backend must enforce authentication, validation, ownership, and moderator permissions. The browser never connects directly to PostgreSQL. With no backend configured, sample reports are shown with a preview label; authentication and submissions require a working API. The community map opens to an India-wide view using OpenStreetMap tiles, so an internet connection is required for map imagery. Reports appear as map pins only when they include valid latitude and longitude coordinates.

## Deploy the frontend to GitHub Pages

Only a built site can be served by Pages. The single workflow in [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) installs dependencies, runs `npm run build` and publishes `dist/`.

1. In the repository, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**. With the source left on "Deploy from a branch", the deploy step fails with `Get Pages site failed`.
2. Push to `main` (or `master`) — or run the workflow from the **Actions** tab. The site is published at `https://<user>.github.io/<repo>/`.
3. Do not add GitHub's "Static HTML" starter workflow next to this one. It uploads the repository source, whose `index.html` points at `/src/main.tsx`, so it replaces the built site with a blank page.

The asset base path is derived from the repository name at build time, so the project URL works if the repo is renamed or forked. Set `VITE_BASE` (for example `/` for a custom domain) to override it.

Pages hosts static files only, so the Express/PostgreSQL API is not deployed there. The published site runs in preview mode with sample reports; to connect the real API, build with `VITE_API_BASE_URL` pointing at a publicly hosted backend and allow the Pages origin in the backend CORS configuration.

## Local backend setup

The Express/PostgreSQL backend is in [`backend/README.md`](backend/README.md). After creating the `ecoreport` database in pgAdmin and setting `backend/.env`, start its API in one Cursor terminal and the frontend in another. The root `.env` points the frontend to `http://localhost:4000`.
