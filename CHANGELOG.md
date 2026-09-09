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
