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
