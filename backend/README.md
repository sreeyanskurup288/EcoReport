# EcoReport API (Express + PostgreSQL)

The API uses PostgreSQL for accounts, reports, status history, and persistent login sessions. Passwords are hashed. The browser talks to this API; it never connects to PostgreSQL directly.

## One-time local setup

1. In pgAdmin, create a database named `ecoreport` if you have not already.
2. Copy `backend/.env.example` to `backend/.env`.
3. Replace `YOUR_POSTGRES_PASSWORD` with the password you chose when installing PostgreSQL. Set `SESSION_SECRET` to a random string of at least 32 characters. Do not send either secret in chat or commit `.env`.
4. In Cursor terminal, run `cd backend`, `npm install`, and `npm run db:init`.
5. Start the API with `npm run dev`. Check `http://localhost:4000/api/health`; it should return `{ "status": "ok", "database": "connected" }`.
6. In a second Cursor terminal at the project root, run `npm run dev`. The root `.env` points the frontend to the API at `http://localhost:4000`.

The API uses a signed, HTTP-only session cookie and allows the local Vite origin configured by `FRONTEND_ORIGIN`. In development, it also allows localhost and 127.0.0.1 origins on alternate ports in case Vite selects a port other than 5173. In deployment, use HTTPS and configure the frontend origin and secure cookie settings for your host.

## Roles

Signup creates regular users. To enable report status controls for a trusted moderator during local development, run this in pgAdmin after registering that user:

```sql
UPDATE users SET role = 'moderator' WHERE email = 'your-test-email@example.com';
```

## Photo storage

During local development, uploaded JPG/PNG/WebP photos (up to 5 MB) are stored in `backend/uploads/`. This local folder is ignored by Git. A deployed app should use durable object storage instead of its temporary filesystem.
