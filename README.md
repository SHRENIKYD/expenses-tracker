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

### API — Render

`render.yaml` is a Render Blueprint for the Express server.

1. Render dashboard → **New → Blueprint** → connect this repo. Render reads
   `render.yaml` and creates the `expenses-tracker-api` web service.
2. Copy the service URL Render assigns (for example
   `https://expenses-tracker-api.onrender.com`).
3. In GitHub → **Settings → Secrets and variables → Actions → Variables**, add
   `VITE_API_URL` = that URL with `/api` appended, then re-run the Pages workflow
   so the client is rebuilt against it.

The blueprint already sets `CLIENT_ORIGIN` to `https://shrenikyd.github.io`, so CORS
admits the Pages origin, and `healthCheckPath` to `/api/health`.

**Free-plan caveats.** Free Render instances have no persistent disk and spin down
after inactivity, so `server/data/expenses.json` resets whenever the service
restarts or redeploys. For durable storage, move to a paid instance type and add a
disk to `render.yaml`:

```yaml
    plan: starter
    disk:
      name: expenses-data
      mountPath: /var/data
      sizeGB: 1
```

then change `DATA_FILE` to `/var/data/expenses.json`.
