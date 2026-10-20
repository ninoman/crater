# Changelog

## [0.2.0](https://github.com/ninoman/dighead/compare/v0.1.0...v0.2.0) (2026-10-20)


### Features

* add =D logo as the extension icon ([6c0762e](https://github.com/ninoman/dighead/commit/6c0762e9328d3b173d6a87c1ca2ded2d7c22c767))
* release script, changelog and release docs (ROADMAP 8.5) ([5282d23](https://github.com/ninoman/dighead/commit/5282d23a947e6732211ac752b5928ffabee9fc57))
* scanner error notices in every view (ROADMAP 7.2) ([7ed3745](https://github.com/ninoman/dighead/commit/7ed374539f2a97a3f2f4113b61c8242dd2422e22))


### Bug Fixes

* match the purchase page on cart_id, not every /download (ROADMAP 2.4) ([e2b53fd](https://github.com/ninoman/dighead/commit/e2b53fd90b90c6072b4b643c1a9d5d4f19384375))

## [0.1.0] - 2026-10-20

First build: the MVP (ROADMAP phases 0 to 6) plus hardening.

### Added

- Syncs your own collection and wishlist, incrementally, into a local IndexedDB database.
- Polite background scanner for release supporters and fan collections: one request at a
  time, randomised delay, backoff on 429/5xx, daily request budget, survives service-worker
  suspension.
- **Also bought** sidebar on release pages, ranked by weighted co-ownership with a lift cap,
  a small-release fallback (same label and artist), preview, wishlist and hide.
- **Taste twins** tab on your profile: fans whose collections overlap most with yours,
  with a label-cluster penalty, sort and filter, plus a "your #N twin" badge on other fans'
  profiles.
- **For you** tab on your profile: recommendations from your top twins' collections, with a
  per-artist diversity rule.
- Popup with sync and scan status, queue pause and resume, settings for pace, caps and
  thresholds, and "Clear all data".
- Fixture refresh script to detect Bandcamp format changes (`npm run fixtures:refresh`).
