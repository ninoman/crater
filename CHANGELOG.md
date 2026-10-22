# Changelog

## [Unreleased]

### Changed

- The fan leaderboard is now called **Crate mates**, everywhere in the extension. Your
  leaderboard, settings and backups carry over.

## [0.1.0] - 2026-10-20

First build: the MVP (ROADMAP phases 0 to 6) plus hardening.

### Added

- Syncs your own collection and wishlist, incrementally, into a local IndexedDB database.
- Polite background scanner for release supporters and fan collections: one request at a
  time, randomised delay, backoff on 429/5xx, daily request budget, survives service-worker
  suspension.
- **Also bought** sidebar on release pages, ranked by weighted co-ownership with a lift cap,
  a small-release fallback (same label and artist), preview, wishlist and hide.
- **Crate mates** tab on your profile: fans whose collections overlap most with yours,
  with a label-cluster penalty, sort and filter, plus a "your #N crate mate" badge on other fans'
  profiles.
- **For you** tab on your profile: recommendations from your top crate mates' collections, with a
  per-artist diversity rule.
- Popup with sync and scan status, queue pause and resume, settings for pace, caps and
  thresholds, and "Clear all data".
- Fixture refresh script to detect Bandcamp format changes (`npm run fixtures:refresh`).
