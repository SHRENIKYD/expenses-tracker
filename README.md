# Expenses Tracker

Personal expenses tracker built with React (Vite) and Node/Express.

## Structure

```
client/   React + Vite frontend
server/   Express REST API with JSON-file persistence
```

## Setup

```bash
npm run install:all
cp server/.env.example server/.env
```

## Development

```bash
npm run dev
```

- API: http://localhost:4000
- App: http://localhost:5173 (proxies `/api` to the server)

## Production build

```bash
npm run build   # builds client into client/dist
npm start       # runs the API server
```

## API

| Method | Endpoint                   | Description                                        |
| ------ | -------------------------- | -------------------------------------------------- |
| GET    | `/api/health`              | Health check                                        |
| GET    | `/api/expenses`            | List expenses (`category`, `from`, `to` query args) |
| GET    | `/api/expenses/categories` | Allowed categories                                  |
| POST   | `/api/expenses`            | Create an expense                                   |
| PUT    | `/api/expenses/:id`        | Update an expense (partial)                         |
| DELETE | `/api/expenses/:id`        | Delete an expense                                   |

Expense shape:

```json
{
  "id": "uuid",
  "description": "Groceries",
  "amount": 42.5,
  "category": "food",
  "date": "2026-09-09",
  "createdAt": "2026-09-09T10:00:00.000Z"
}
```

Data is stored in `server/data/expenses.json` (path configurable via `DATA_FILE`).

## Hosting

### Client — GitHub Pages

`.github/workflows/deploy-pages.yml` builds `client/` and publishes it to GitHub Pages
on every push to `main`.

One-time repo setup:

1. **Settings → Pages → Source: GitHub Actions**
2. **Settings → Secrets and variables → Actions → Variables** → add `VITE_API_URL`
   set to your deployed API base URL (for example `https://your-api.example.com/api`).

The workflow sets Vite's `base` to `/<repo-name>/` automatically, so assets resolve
correctly on a project page.

### API — not GitHub Pages

Pages serves static files only, so `server/` must run elsewhere (Render, Fly.io,
Railway, a VPS, etc.). Wherever it runs, set:

- `CLIENT_ORIGIN` to the Pages URL (`https://<user>.github.io`) so CORS allows the client
- `DATA_FILE` to a path on persistent storage — the JSON store is wiped on redeploy otherwise

Until `VITE_API_URL` points at a running API, the deployed page loads but shows a
fetch error, because there is no backend behind it.
