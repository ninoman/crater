# Changelog

## [0.3.0] - 2026-10-23

### Added

- Heart a release and the tag picker opens right next to the heart. A follow made on an
  account's page is saved at once, so you can tag it there without waiting for a sync.
- "You follow <name>" before an account's tags; on release pages it names the account
  selling the release (a label shows as the label).

### Changed

- The wishlist and following tabs fill in while your sync runs, instead of after it.
  Followings now sync before your collection.
- Big wishlists and follow lists open much faster: cards load as you scroll, and reloads
  only redraw what changed.

### Fixed

- The select box on wishlist cards no longer sits on a white plate.

## [0.2.0] - 2026-10-23

### Added

- **Following tags**: tag the fans, artists and labels you follow, filter and bulk-tag them
  on the following tab, see tags on their own pages, and export or import your tags.
- Tags on wishlist items, with a tag filter on the wishlist tab.
- **For you** gets *Fresh* (crate mates' recent buys) and *Deep cuts* modes, with a reason
  line on each pick and a boost for artists and labels you follow.
- **Crate mates' latest** feed on your profile, with playable covers of their newest buys.
- Badges next to release links across Bandcamp: owned, wishlisted, or how many crate mates
  own it.
- Previews play in our own player with a seek bar, straight from the cover.
- Also bought shows a skeleton while loading, then early picks as the scan finds them, and
  takes its colours from the artist's page.
- Full database export and import in settings (gzipped, all-or-nothing, resumes if
  interrupted).
- Plain-language settings with an Advanced section.
- The =D logo as the extension icon.

### Changed

- The fan leaderboard is now called **Crate mates**, everywhere in the extension. Your
  leaderboard, settings and backups carry over.
- Smarter scanning: supporters are ranked by known overlap and read in passes, so Also bought
  fills in much faster. The default daily request budget is now 10,000.
- Crate mates scores are out of 100, weighted toward recent buys, and ignore compilations.
- Much smaller database on disk.

### Fixed

- No more recommendations for albums you already own a track of.
- Purchase detection matches the real purchase page only.
- Assorted layout fixes on the profile tabs, following cards and settings.

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
