# Expenses Tracker

Personal expenses tracker in Indian rupees, built with React (Vite) and Node/Express
on PostgreSQL.

## Features

- Add, inline-edit and delete expenses; sort by any column
- Filter by category and date range, search by description
- Monthly view with total, expense count and month-over-month change
- Category breakdown and a twelve-month trend chart
- Per-category monthly budgets with over-budget warnings
- CSV import and export

All amounts are formatted as INR with Indian digit grouping (`₹1,23,456.00`).

## Structure

```
client/   React + Vite frontend
server/   Express REST API on PostgreSQL
```

## Setup

```bash
npm run install:all
cp server/.env.example server/.env   # then set DATABASE_URL
```

The server creates its tables on boot, so an empty database is enough.

## Development

```bash
npm run dev
```

- API: http://localhost:4000
- App: http://localhost:5173 (proxies `/api` to the server)

## API

| Method | Endpoint                   | Description                                              |
| ------ | -------------------------- | -------------------------------------------------------- |
| GET    | `/api/health`              | Health check                                              |
| GET    | `/api/expenses`            | List (`category`, `from`, `to`, `q`, `sort`, `order`)     |
| POST   | `/api/expenses`            | Create an expense                                         |
| PUT    | `/api/expenses/:id`        | Update an expense (partial)                               |
| DELETE | `/api/expenses/:id`        | Delete an expense                                         |
| GET    | `/api/expenses/categories` | Allowed categories                                        |
| GET    | `/api/expenses/export`     | CSV of the filtered rows                                  |
| POST   | `/api/expenses/import`     | Bulk import from a CSV body                               |
| GET    | `/api/budgets`             | All category budgets                                      |
| PUT    | `/api/budgets/:category`   | Set a monthly limit (`0` clears it)                       |
| GET    | `/api/summary?month=`      | Month totals, category split, daily series, 12-month trend |

CSV columns for import and export: `date,description,category,amount`.

`sample-expenses.csv` in the repo root holds four months of demo data (89 rows,
June–September 2026). Import it from the app's **Import CSV** button to populate an
empty database.

## Hosting

### Client — GitHub Pages

`.github/workflows/deploy-pages.yml` builds `client/` and publishes it to GitHub Pages
on every push to `main`.

1. **Settings → Pages → Source: GitHub Actions**
2. **Settings → Secrets and variables → Actions → Variables** → set `VITE_API_URL` to
   the deployed API base URL including `/api` and no trailing slash, for example
   `https://expenses-tracker-api-k3wz.onrender.com/api`.

Vite's `base` is set to `/<repo-name>/` by the workflow so assets resolve on a
project page. The variable is baked in at build time, so changing it requires a
rebuild (Actions → Deploy client to GitHub Pages → Run workflow).

### API + database — Render

`render.yaml` is a Render Blueprint defining the Express service and a managed
PostgreSQL database. `DATABASE_URL` is wired from the database automatically.

Render dashboard → **New → Blueprint** → connect this repo → **Apply**.

Render's free PostgreSQL plan expires after 30 days and must be recreated; free web
instances also spin down when idle, so the first request after a pause is slow. For
anything long-lived, move both to a paid plan.

## Environment

| Variable        | Purpose                                                     |
| --------------- | ----------------------------------------------------------- |
| `DATABASE_URL`  | PostgreSQL connection string (required)                      |
| `DATABASE_SSL`  | `true` to connect over SSL; anything else disables it        |
| `CLIENT_ORIGIN` | Origin allowed by CORS (defaults to `http://localhost:5173`) |
| `PORT`          | API port (defaults to `4000`)                                |
