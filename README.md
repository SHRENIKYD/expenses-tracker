# Tessera

A tessera is a single tile of a mosaic — in Rome, also the token you carried to
be counted. Every transaction is one: on its own it is a coffee or a bus fare,
and together they are the picture of a year.

Personal expenses tracker in Indian rupees. A React (Vite) client on GitHub
Pages, with Supabase behind it: PostgreSQL, its authentication, and its Storage.
There is no application server, and transaction data is encrypted in the browser
before it is stored.

## Features

- Add, inline-edit and delete transactions; sort by any column
- Filter by category, payment method and date range, search by description
- Any period — a month, a preset, or an explicit `from`–`to` range
- Category breakdown and a twelve-month trend chart
- Per-category monthly budgets with over-budget warnings
- CSV import and export
- Bank and credit-card statement PDF import, parsed in the browser, with
  duplicate detection and remembered categories
- Income as well as expenses, payment methods, accounts and receipts
- Savings goals with contributions
- Installable on a phone: app icon, offline app shell, no store required
- Skeleton placeholders while a period loads, shaped like the page they stand in for

All amounts are formatted as INR with Indian digit grouping (`₹1,23,456.00`).

## Structure

```
client/     React + Vite frontend — the whole application
supabase/   migrations, policies, the summary functions, and their tests
```

## Setup

```bash
npm run install:all
cp client/.env.example client/.env.local   # then fill in the two values
```

Create a Supabase project, run `supabase/migrations/*.sql` in its SQL editor in
order, and put the project URL and the publishable key in `client/.env.local`.
`supabase/README.md` has the detail.

## Development

```bash
npm run dev        # http://localhost:5173
npm test           # client tests, then the Supabase policy and function tests
```

The Supabase tests need a PostgreSQL you can create databases on; they recreate
`auth.users` and `auth.uid()` themselves and run the real migrations.

## Where the work happens

Ownership is not a `WHERE user_id = $1` the client could forget: every table has
row-level security and one policy, so a query for someone else's row returns
nothing. `supabase/test/policies.test.mjs` is the test that matters most.

The client also builds no queries. Every table is behind a function in
`supabase/migrations/0006_functions.sql` — `list_transactions`,
`create_transaction`, `set_budget`, `reset_transactions` — and
`client/src/data/supabase.js` has one place that speaks to the database at all.
The functions are `security invoker`, so the policies still decide; what they
add is that the whole surface is legible in one file.

The dashboard's figures are SQL functions (`supabase/migrations/0002_summary.sql`),
`security invoker`, so they see exactly what the caller sees. `daily_series`
answers with a row per day of the range, gaps filled with zeros and a running
total alongside — a prefix sum computed in SQL. The client builds its own prefix
sums from that series (`client/src/series.js`), which is what lets it bucket the
chart, size the sparklines and answer "how much in these days" without another
request: O(n) once, then O(1) per range. The rolling average and the heaviest-week
callout use a sliding window over the same array, O(n) rather than O(n·7).

Budgets are monthly figures, so they are reported only when the selected period
is exactly one calendar month; a fortnight is not compared against a month's limit.

## Statement import

Upload a PDF on the Transactions page. It is read on your device —
`client/src/pdf.js` extracts the text, `client/src/statement.js` reads the rows —
and only the rows you tick are sent anywhere. The PDF never leaves the browser,
and a password-protected statement is opened locally.

Two layouts are handled. An **account statement** prints the transaction and the
balance it left behind, and direction follows from the change in that balance. A
**card statement** prints one amount and no balance, so direction comes from the
`Cr` marker — and a credit on a card, usually the bill payment, is reported
rather than imported, since importing it would cancel out the spending it paid
for.

Duplicates are found two ways: the bank's reference number (UTR/RRN/IMPS), also
enforced by a partial unique index, and a near match on amount, direction, a date
within three days and a similar narration.

That check is a lookup, not a search. `client/src/duplicates.js` indexes the
recorded rows twice — once on the reference, once on direction, amount and day —
so a candidate costs a constant seven probes, one per day in the window,
whatever the ledger holds. Building the index is O(m) once per import or per
launch; each check is O(1). It used to be a scan per candidate, which made a
statement of n rows against m recorded ones n × m comparisons, and made the
message reader re-scan the ledger for every alert. Rows that cannot be read with
confidence are listed with the reason instead of being imported with a wrong
value, and a statement that yields nothing says whether it had no text at all (a
scan) or text in a layout the parser does not know.

Categories start from a keyword list. Correct one in the preview and it is
remembered against that merchant, so the same shop is categorised that way next
month. The statement's account and payment method are chosen once and applied to
the batch.

`sample-expenses.csv` in the repo root holds four months of demo data (89 rows,
June–September 2026). CSV columns are `date,description,category,amount,kind`;
`kind` is optional and read from the category when it is missing.

## Encryption

Transactions and receipts are encrypted in the browser before they are stored.
The database holds ciphertext, a date, an account id and an owner — enough to
fetch a period, and nothing that says what was bought or for how much. A copy of
the database is unreadable without the key, which never leaves the device.

The shape is envelope encryption. A random data key encrypts every row
(AES-GCM-256, a fresh iv each time, the row's id authenticated alongside so a
blob cannot be moved between rows). That key is stored twice, wrapped by a key
derived from the password (PBKDF2-SHA256, 310,000 iterations) and by one derived
from a recovery key shown once at sign-up. Changing the password rewraps the
data key and touches no row; losing both the password and the recovery key means
the data is unreadable permanently, by anyone, which is what makes the guarantee
worth having.

Two things follow from it:

- **The dashboard's arithmetic moved into the browser.** SQL cannot sum a column
  it cannot read, so the aggregate functions were dropped and
  `client/src/data/aggregate.js` does the work over decrypted rows. Search,
  sorting and category filters run there too.
- **The duplicate check survives as a blind index.** A bank reference is stored
  as an HMAC under the same key, so the unique index still refuses a statement
  imported twice while the digest says nothing about the reference.

The key lives in memory, and in `sessionStorage` so a reload does not ask again.
A fresh tab asks for the password. Nothing is written to `localStorage`.

## Debugging without reading anything

`public.diagnostics` holds codes, row identifiers, key versions and counts.
`detail` is constrained to numbers and booleans — not by length, since a
description can be one word, but by type, which the database can enforce. The
client scrubs the same way before sending.

Settings → Encryption runs the checks that actually need the key, in the page
that has it: how many rows are sealed, how many are still readable, and which
ones will not open. The report it offers for download carries those identifiers
and codes and no content. There is deliberately no mechanism that lets anyone
but the account holder read a transaction — a key held for support would make
the encryption decorative.

## Signing in

Email and password, through Supabase Auth. A forgotten password is reset by a
link emailed to the address on the account — from the sign-in page, or from
Settings while signed in. Changing the password requires the current one.

## Receipts

Attach an image or PDF (2 MB) when adding a transaction. The file goes to a
private Storage bucket under a folder named for your account, and the transaction
keeps its path; the policy reads the owner out of that path. A paperclip appears
beside the row, opens the file in place, and deleting the file leaves the
transaction alone. Settings shows how much Storage receipts are using.

## Installing on a phone

The client ships a web manifest and a service worker, so a phone can add it to
the home screen: it opens without browser chrome, keeps its own icon, and the
app shell loads offline. Nothing from Supabase is cached — account data always
comes from the network — so an offline launch shows the shell and reports the
missing connection rather than stale figures.

## The Android app

The same client, wrapped by Capacitor and served from the device rather than
from Pages. It is a wrapper on purpose: the encryption is WebCrypto and the
statement parser is pdf.js, so a native rewrite would mean a second
implementation of the vault that has to open rows sealed by the first one.

```bash
cd client
npm run build:app     # builds with a relative base and copies it into android/
npm run open:android  # opens Android Studio, if you have it
```

`.github/workflows/android.yml` builds an APK on demand (Actions → Android → Run
workflow) and on every release tag; it lands as an artifact on the run and, for
a tag, as a file on the release.

### Signing

Without a keystore the build is debug-signed. That installs and runs, but
Android regenerates the debug key, so each build has a different signature and
refuses to install over the last one — you have to uninstall first, and on
Android 13+ re-grant restricted permissions each time.

To fix that permanently, make a key once and give it to the repository:

```bash
keytool -genkeypair -v -keystore tessera.jks -alias tessera \
        -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 tessera.jks     # macOS: base64 -i tessera.jks
```

Then **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE` | the base64 above |
| `ANDROID_KEYSTORE_PASSWORD` | the store password |
| `ANDROID_KEY_ALIAS` | `tessera` |
| `ANDROID_KEY_PASSWORD` | the key password |

Keep `tessera.jks` somewhere safe and off the repository. Losing it means no
future build can update an installed app — only a reinstall.

Two differences from the web build: the base is relative, since the app serves
itself from the root of a WebView, and the service worker is left out, because
the shell is already on the device and a worker would only add a staler copy of
it. Supabase is reached over the network exactly as it is from the browser, with
the same key and the same policies.

## Bank messages (Android)

Turned on in Settings, and off by default. The app registers for SMS, reads only
senders shaped like a bank, and parses the alerts on the device:
`client/src/sms.js` turns a message into an amount, a direction, a merchant and
a reference, or into nothing at all.

Nothing is recorded automatically. Each reading appears on the Overview beside
the words it came from, and becomes a transaction only when you tap Add — at
which point it is encrypted like any other. Unconfirmed suggestions live in
memory: they are not written to the phone or to the database, and the last three
days can be re-read from the inbox when the app opens.

What it refuses is as important as what it reads: an OTP, a balance alert, a
statement reminder, an advertisement with a number in it, and any message whose
direction is unclear — because a wrong direction is the one mistake a total will
not reveal. `client/test/sms.test.js` holds those cases.

There are two sources, and either is enough:

- **SMS.** `RECEIVE_SMS` and `READ_SMS`, asked for only when the feature is
  switched on. Android treats these as restricted: a sideloaded build has to be
  unlocked through **App info → ⋮ → Allow restricted settings** before the
  permission can even be granted, and Play Protect warns before installing.
  Google Play restricts them to default SMS handlers, so a build using them
  cannot be listed there.
- **Notifications.** A `NotificationListenerService`, granted on Android's own
  screen. Not restricted, so a sideloaded build needs no unlocking, and it also
  catches alerts posted by your bank's app rather than as SMS.

With both on, whichever arrives first becomes the suggestion; the second copy is
recognised and dropped.

## Releases

Versions are semantic and live in `client/package.json`; `CHANGELOG.md` is the
record. Tagging `v<version>` builds the client with that number stamped into it,
deploys it, and opens a GitHub release from the changelog's own section. A tag
that disagrees with `package.json`, or has no section in the changelog, fails
rather than ships.

Every other build carries `<version>+<short sha>`, which is what the diagnostics
report, so a screenshot of a problem names the code that produced it.

The stamp comes from the commit, not from the ref: a build whose commit carries
a release tag is stamped with it, which is also why a tag pushed by the release
workflow needs no deploy of its own. It could not trigger one anyway — GitHub
suppresses events raised with the default token so workflows cannot recurse.

## Continuous integration

`.github/workflows/ci.yml` runs the client tests and build, and the Supabase
policy and function tests against a real PostgreSQL service container, on every
push and pull request. After a Pages deploy, `deploy-pages.yml` smoke-tests the
published page, a deep link and the installability assets, and checks that the
project URL actually reached the bundle.

## Hosting

`.github/workflows/deploy-pages.yml` builds `client/` and publishes it to GitHub
Pages on every push to `main`.

1. **Settings → Pages → Source: GitHub Actions**
2. **Settings → Secrets and variables → Actions → Variables** → set
   `VITE_SUPABASE_URL` to the project URL and `VITE_SUPABASE_ANON_KEY` to the
   publishable key.

The publishable key is meant to reach the browser: row-level security, not
secrecy, keeps one account out of another's rows. The secret key (`sb_secret_…`)
bypasses those policies and belongs in neither the repository nor the client.

Vite's `base` is set to `/<repo-name>/` by the workflow so assets resolve on a
project page. Both values are baked in at build time, so changing one requires a
rebuild (Actions → Deploy client to GitHub Pages → Run workflow).

## Accounts and goals

Accounts have a manually entered opening balance and accumulate income minus
expenses assigned to them. Payment method (UPI, card, cash, bank transfer) is
separate from the account. Rows that arrived without an account are claimed in
one go from the Transactions page. These balances are based on recorded data,
not bank synchronisation.

Savings goals have a target and a contribution history. Recording a contribution
tracks money already set aside; it does not transfer money, change an account
balance, or count as an expense.
