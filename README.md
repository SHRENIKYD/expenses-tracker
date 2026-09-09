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
- Bank statement PDF import, with duplicate detection
- Income as well as expenses, payment methods, receipts and accounts
- Savings goals with contributions, and an accounts view by payment method

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
| GET    | `/api/summary?month=`      | Month totals, category split, weekly cash flow, per-account totals, daily series, 12-month trend |
| GET    | `/api/goals`               | Savings goals                                             |
| POST   | `/api/goals`               | Create a goal (`name`, `target`, `icon`)                  |
| PUT    | `/api/goals/:id`           | Update a goal (partial)                                   |
| POST   | `/api/goals/:id/add`       | Add money to a goal, clamped at the target                |
| DELETE | `/api/goals/:id`           | Delete a goal                                             |

CSV columns for import and export: `date,description,category,amount`.

## Bank statement import

Upload a PDF statement on the Transactions page. The server extracts the text,
identifies the bank, and reads each transaction row. Rows already in your account
are detected and left unticked, so importing the same statement twice adds nothing.

Duplicates are found two ways: an exact match on the bank's reference number
(UTR/RRN/IMPS), which is also enforced by a unique index in the database, and a
near match on amount, direction, a date within three days and a similar narration.

**What it can and cannot read.** Direction is taken from an explicit Dr/Cr marker,
from the narration, or by comparing the running balance; the first row of a
statement also needs an opening balance line, otherwise it is reported rather than
guessed. Layouts differ per bank, so rows that cannot be read with confidence are
listed instead of being imported with a wrong value. Password-protected statements
are supported — you are prompted for the password. Scanned or image-only PDFs
contain no extractable text and cannot be read at all.

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

## Green dashboard

The overview uses the selected month's income, expenses, cash flow, category
breakdown and budget alerts. Transaction searches and CSV exports default to
that month; explicit date filters on Transactions override the month bounds.
The header search opens Transactions with the entered query. Notifications show
budget pressure and unpaid recurring bills from the selected month.

Accounts have a manually entered opening balance and accumulate income minus
expenses assigned to them. Existing transactions remain unassigned until edited.
Payment method (UPI, card, cash, bank transfer) is separate from the account.
Accounts with transactions cannot be deleted until those transactions are
unassigned. These balances are based on recorded data, not bank synchronization.

Savings goals have a target and a contribution history. Recording a contribution
tracks money already set aside; it does not transfer money, change an account
balance, or count as an expense. Each account, goal and contribution belongs to
the signed-in user. The server creates the new tables and account link on startup
using its existing idempotent schema setup. Deploy the server changes before the
client because the dashboard now requests `/api/accounts` and `/api/goals`.

`npm test` includes an in-memory PostgreSQL (PGlite) integration test for schema
initialization, ownership isolation, account balances, goal contributions and
month filters. It does not connect to or modify a deployed database.
