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
