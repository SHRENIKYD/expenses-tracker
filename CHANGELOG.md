# Changelog

Versions follow [semantic versioning](https://semver.org): the middle number
moves when something is added, the last when something is fixed, the first when
the data or the deployment changes shape and needs a step from you.

Releasing is one command once the changelog has a section for the version:

```bash
npm version 1.1.0 --prefix client && npm version 1.1.0 --no-git-tag-version
git commit -am 'Release 1.1.0' && git tag v1.1.0 && git push --follow-tags
```

Or from the Releases page on GitHub: draft a release, give it the tag, publish.
The workflow rewrites its notes from the section below either way.

A build is stamped with the tag when the commit it was built from carries one,
and with `<version>+<short sha>` otherwise. So the published site reads `v1.0.0`
while the released commit is the head of `main`, and `1.0.0+<sha>` after the
next commit — which is the truth: that build is not the release.

The tag is read from the commit rather than from the ref because a tag pushed by
a workflow triggers nothing at all: GitHub suppresses events raised with the
default token so workflows cannot recurse.

The tag builds the client with its own number stamped in, publishes it to
Pages, and opens a GitHub release with the section below. A tag that disagrees
with `client/package.json`, or has no section here, fails rather than ships.

## Unreleased

Work lands here and stays on 1.0.0 until it has been used enough to call
stable. Builds carry `1.0.0+<short sha>`, which names the commit exactly, so
nothing is lost by not renumbering: the version moves when there is a reason to
move it, not on every change.

### Added

- **Bank messages on Android.** Alerts are read on the device and offered as
  transactions to confirm; nothing is recorded automatically, and the message is
  shown beside the reading so a misreading is obvious. Off by default. Two
  sources — SMS, and the notification shade, which Android does not restrict and
  which also sees alerts from bank apps.
- **Release signing**, when the repository has a keystore: every build shares a
  signature and installs over the last instead of demanding an uninstall.

### Changed

- **The phone leads with the figure.** The Overview's header is the remaining
  balance, in the brand's green, with search and the period behind icons — about
  208px of chrome instead of 380.

### Fixed

- **"Forgotten your password?" could not reset a password.** The emailed link
  opened the sign-in page, so the new password was never set. It now opens
  "Set a new password", which for an encrypted account also asks for the
  recovery key — the forgotten password was what opened the data — and rewraps
  the key with the new password, so from then on the new password alone opens
  everything. A wrong key is refused and changes nothing; an expired link says
  so.
- **A rejected new password locked the data.** Changing the password rewrapped
  the data key before the account accepted the new password; when Supabase
  refused it (too weak, reused, breached), the current password still signed in
  but no longer opened anything. The old wrapping is now put back when that
  happens.
- **"Sept 26" read as a date.** Months are now named with the whole year —
  "Sept 2026" — and the twelve-month trend's axis, which is short of room,
  writes "Sept ’26".
- **Imported rows were named after the bank's narration.** Every row from a
  statement read "UPI/402500000040/Pay…", the merchant cut off at the end. The
  name is now read out of the narration — the fields that are never a name
  (references, IFSC and bank codes, UPI handles, masked account numbers, words
  like UPI, NEFT and DR) are set aside and the first one left is kept — for the
  layouts HDFC, ICICI, SBI and Axis print. The full narration is kept as the
  row's note, so a search by reference still finds it. A narration with no name
  left in it is kept as it was.
- **Search by amount found nothing**, though the box offers it. A figure, typed
  with or without ₹ and commas, now matches amounts.
- **On a phone the cash-flow chart hid the end of the month.** It kept a 480px
  minimum so its labels would not collide, and scrolled sideways inside a 320px
  card with nothing to show it could — September appeared to stop on the 18th.
  With a handful of bars it now fits the card, labelled "13–18 / Sept" with
  ticks in K and L; the thirty-bar daily view still scrolls.
- **"Export everything" exported only the period on screen.** It shared the
  Transactions page's export, filters and all. Worse, it was the export offered
  as the safety net before "Delete all", which removes every month — so
  following the app's own advice could lose everything outside the current one.
  Both now export every transaction.
- **"Delete all" understated what it deletes.** It showed the selected period's
  count ("1 in the selected period") while deleting across all dates. It now
  shows the total.
- **The receipts count went stale.** Settings read it once on arrival, so after
  deleting everything it still said "1 file". It is re-read after a delete, says
  "None stored" when there are none, and gives small files in KB rather than
  "0.00 MB".
- **"Add to this month" did nothing for recurring bills** in any month without
  a 31st. It asked for the ledger up to the 31st, which in September is a date
  the database refuses, and the call failed before anything was added.
- **Accounts page**: "1 transactions", a payment method printed as `upi`, and
  its two links drawn in the browser's default blue and underline.
- **Editing a transaction failed** whenever it had no account. The edit row's
  "Unassigned" is an empty string, and the encrypted save sent it to the
  database as the account id, which refused it (*invalid input syntax for type
  uuid*). Nothing could be edited unless it belonged to an account.
- **Undo after a delete dropped the receipt**, and a statement row's bank
  reference with it. The restored row now carries everything the deleted one
  did.
- **The transactions total added income to spending.** A ₹90,000 salary and a
  ₹1,650 bill totalled ₹91,650. The footer is now the net, signed, and its cells
  line up with the six columns above it.
- **"Today" was yesterday until 05:30.** The date it is now was read in UTC, so
  in India every morning before half past five the add form defaulted to the
  day before and would not let today be picked, a bank alert that arrived at
  1 am was filed under the previous day, "Today" and "Yesterday" were
  misapplied, the presets ended a day early, and on the 1st the dashboard opened
  on the month just gone. Now is read from the device's own calendar; the
  arithmetic on stored dates is unchanged.
- **A reload locked the app.** The dashboard was drawn before the tab had asked
  whether the account has a vault, so it fetched the sealed rows with no key in
  memory to open them — the cached key was restored a moment later, too late.
  Every row was reported locked, the add form offered one category and no
  payment methods, and each launch filed a diagnostic per row. The tab now
  waits for the vault's answer, and a new tab asks for the password before any
  row is fetched.
- **Nothing could be saved with encryption off.** Every insert and edit went to
  a database function through PostgREST, which picks the function by the
  argument names it is sent — and the client library drops an argument that is
  undefined. A row the database gives an id to sent no `p_id`, so the call
  failed with *could not find the function public.create_transaction(…) in the
  schema cache* instead of writing anything. Adding a transaction, and importing
  a statement, now send every argument, null included.
- **A statement's rows were being torn apart before the parser saw them.** A PDF
  reports a table as loose cells, each with its own baseline, and the cells of
  one row differ by a point or two. Snapping those baselines to a three-point
  grid split a row in half whenever its cells straddled a boundary — the date on
  one line, its amounts on another — so a 24-page statement produced 1,905 lines
  and not one transaction. Cells are grouped by how close they are instead,
  measured from the top of the row, which has no boundaries to straddle. The
  grouping is its own module now, tested on hand-built cells and on a real PDF
  read by pdf.js.
- **An ICICI statement read as nothing at all.** Its transaction history export
  puts a row number in front of the date, a value date and a transaction date
  side by side, and withdrawal and deposit in columns of their own with `0.00`
  in the one that does not apply — so every row failed the first test the parser
  made, and 1,905 lines yielded no transactions. Rows like that are read now,
  the transaction date is the one kept, and the column the figure sits in says
  which way the money went. The bank named on the statement is also the one it
  is mostly about, read from the letterhead rather than from the whole file —
  which had an ICICI statement labelled first HDFC, then YES Bank, after the
  banks behind its payees' UPI handles outnumbered its own name.
- **A statement import gave up halfway.** Each row was its own request, so a
  252-row statement was 252 round trips from a phone — a minute of them, and any
  one dropping (`TypeError: Failed to fetch`) lost the whole import. Rows now go
  a hundred at a time through `create_transactions`, a dropped connection is
  retried, and the unique index on the bank reference settles a repeat inside
  the database rather than by a failed insert.
- **Receipts outlived the transactions that carried them.** Deleting every
  transaction left the files in storage, still counted and still holding the
  images. They are removed in the same breath.

## 1.0.0 — 2026-09-09

The first version that stands on its own: a static client and a database, with
nothing in between.

### Added

- **End-to-end encryption.** Transactions and receipts are encrypted in the
  browser before they are stored. A random data key, wrapped by the password and
  by a recovery key shown once; changing the password rewraps it and touches no
  row. The database holds ciphertext, a date and an owner.
- **Diagnostics that cannot leak.** Codes, row identifiers and counts, with
  `detail` constrained to numbers and booleans by the database itself. Settings
  runs the checks that need the key in the page that has it.
- **Statement import in the browser.** pdf.js and the parser run on the device;
  only the rows you tick are sent. Account and credit-card layouts, duplicate
  detection by bank reference or by near match, and remembered categories per
  merchant.
- **Receipts in Supabase Storage**, one folder per account, sealed before upload.
- **Accounts on import**, and a way to claim rows that arrived without one.
- **Savings goals, accounts, ranges and presets, skeleton loading, and a
  collapsible sidebar** that remembers itself.
- **Tessera**: the name, the mark, and icons cut from it.
- **An Android app.** The same client wrapped by Capacitor: the same WebCrypto
  vault, the same pdf.js parser, the same rows. A workflow builds a debug APK
  and attaches it to the release. It is signed with a throwaway key, which is
  enough to install and use but not to publish.
- **Two more sidebar themes**, Emerald Marble and Alpine Lake.

### Changed

- **Supabase replaces the Express API.** Row-level security enforces ownership
  in place of a `WHERE user_id = $1` on every query.
- **The dashboard's arithmetic moved into the browser**, because SQL cannot sum
  a column it cannot read. Prefix sums and a sliding window over the decrypted
  rows.
- **CSV carries `kind`.** The old export left it out, which turned income into
  expenses on the way back in.

### Removed

- The Express API, its Render deployment, and the recovery codes that existed
  only because there was no email server.
