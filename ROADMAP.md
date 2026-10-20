# Dighead: Roadmap

Step-by-step build plan for the Bandcamp digging extension (MV3, no backend), based on *Bandcamp Digging Extension: Architecture & MVP Spec* (Oct 19, 2026). "Dighead" is a working name taken from the repo folder.

Each phase ends with something you can load unpacked in Chrome and use. Phases 0–6 are the MVP. Phases 7–8 take it to the Web Store. After that comes the backlog.

```
P0 Recon ─► P1 Skeleton ─► P2 Sync me ─► P3 Scanner ─► P4 Also bought ─► P5 Twins ─► P6 For you ─► P7 Harden ─► P8 Ship
                                  └────────────── (P2 and P3 can overlap once P1 is done) ──┘
                                                                         └─► Following tags (after P6, modifies Bandcamp's following tab; not MVP)
```

---

## Phase 0: Recon and decisions (before writing code)

**Goal:** remove the unknowns that could force a schema or architecture change later.

1. [x] **Capture live traffic.** Done with curl and by reading Bandcamp's `tralbum.js`; see `tests/fixtures/README.md`. Still needed from you: `purchase-confirmation.html`, captured logged in. Do this on a public fan page, your own fan page (logged in), an album page and a track page. Save the raw responses to `tests/fixtures/`:
   - `fan-page.html` (the `#pagedata` data-blob with `fan_data` and `item_cache`)
   - `collection_items.json` page 1 and page 2, so the `older_than_token` round trip is covered
   - `wishlist_items.json`
   - `album-page.html` and `track-page.html` (`data-tralbum`, `pagedata`, `<meta>` tags, "supported by" thumbs)
   - the **"more supporters" request**: exact URL, method, body and pagination. This is the biggest open question and "Also bought" depends on it.
2. [x] **Answer the open questions from the spec**, in `docs/decisions.md`. Tracks match their album (via `matchKey`), and fans with hidden collections are ignored. and write the answers down in `docs/decisions.md`:
   - Does `collection_items` need a session for public collections? Test it with cookies and without.
   - How do private or hidden collections respond? Record a fixture of that response too.
   - Tracks vs albums: keep them as separate items (`t456`), or fold each track into its parent album? This changes `itemKey`, so decide now.
   - Private fans in the leaderboard: skip them silently, or show them as "private"?
3. [x] **Cookie spike.** The service worker carries the session. Content-script fetches fail on artist subdomains (CORS), so all fetches go through the worker. Confirm that a `fetch(..., {credentials: 'include'})` from the MV3 service worker, with `https://*.bandcamp.com/*` host permission, sends your Bandcamp session cookies. Test this before building on it. If it doesn't, the fallback is to route your own collection and wishlist fetches through the content script.
4. [x] **Measure rate tolerance.** 50 of 50 requests returned 200 at the default pace.  Fetch around 50 collection pages at the planned 1.5–3 s pace and note any 429s or changed headers. This confirms the default pace and the daily budget.

**Done when:** every row of the spec's "data sources" table has a saved fixture, and every open question has a written answer.

---

## Phase 1: Skeleton and fixtures (Milestone 1)

**Goal:** an empty extension that builds, loads, and has tested parsers.

1. [x] Scaffold: TypeScript, Vite, CRXJS, React, Dexie, Vitest. Add Biome (lint + format), and keep `strict: true`.
2. [x] Manifest: MV3, `host_permissions: ["https://*.bandcamp.com/*"]`, `permissions: ["storage", "alarms"]`, the background service worker, content scripts for `bandcamp.com/*` and `*.bandcamp.com/album/*` and `/track/*`, and the popup.
3. [x] Repo layout:
   ```
   src/
     background/   index.ts, queue.ts, scheduler.ts, router.ts (message handlers)
     bandcamp/     pagedata.ts, fan.ts, collection.ts, release.ts, types.ts   ← all parsing lives here
     db/           schema.ts (Dexie), repo/*.ts (typed read/write helpers)
     scoring/      weights.ts, twins.ts, alsoBought.ts, forYou.ts
     content/      shared/shadowRoot.tsx, release/, profile/
     popup/
     shared/       messages.ts (typed request/response), settings.ts
   tests/fixtures/
   ```
4. [x] Dexie schema for all 7 stores, plus `items.albumKey` and an indexed `ownership.matchKey` (decisions §3.8), (`items`, `fans`, `ownership`, `releaseSupporters`, `me`, `twins`, `queue`) with the indexes from the spec. Version it from day one so later migrations stay clean.
5. [x] Parsers in `bandcamp/`, each returning typed objects and throwing a typed `ParserError` on unexpected shape:
   - `parseFanPage(html)` → fan_id, username, collection count, first items, first token
   - `parseCollectionPage(json)` → items and next token
   - `parseReleasePage(html)` → item metadata and first supporters
   - `parseMoreSupporters(json)` for `/api/tralbumcollectors/2/thumbs` and `/reviews`. Supporters are reviews ∪ thumbs.
   - All API parsers treat HTTP 200 `{"error": true}` as a failure
6. [x] One Vitest test per parser, run against the Phase 0 fixtures.
7. [x] Typed message bus (`chrome.runtime.sendMessage` with a discriminated union) and a `ping` round trip from the content script to the service worker.
8. [x] Shadow DOM mount helper for React, so Bandcamp CSS can't leak in.

Also added: the UI kit in `src/ui/` (tokens, Button, Panel, Tabs (Radix), EmptyState, StatusDot), zod schemas for every Bandcamp shape, and pure request builders in `bandcamp/requests.ts`.

**Done when:** `npm run build` produces a loadable extension, `npm test` is green, and a "hello" panel renders in a shadow root on an album page.

---

## Phase 2: Sync my collection (Milestone 2)

**Goal:** the extension knows who you are and what you own.

1. [x] Detect the logged-in fan from page data on any bandcamp.com page, then store `fan_id` and `username` in `me`. Reads `#pagedata` `identities.fan`; the logged-in shape `{id, username}` is confirmed by `me-fan-page.html`.
2. [x] Write a paginated collection fetcher in `bandcamp/collection.ts`: loop on `older_than_token` and yield pages.
3. [x] Pull your full collection and wishlist (no cap for yourself). Write to `items`, `ownership` (with `source`) and `me` (owned and wishlist key sets). Your owned and wishlisted sets are your `ownership` rows, not copies in `me`.
4. [x] Re-sync triggers: `chrome.runtime.onStartup`, and the purchase confirmation page (record a fixture of it and match on URL or DOM). `onStartup` is done, plus a re-sync on any page view when the last sync is over 24 h old. The purchase page is `bandcamp.com/download` with a `cart_id` param (confirmed by `purchase-confirmation.html`); re-downloads don't match.
5. [x] Incremental re-sync: stop paging once a page contains only items you already have.
6. [x] Popup v0: "N items synced · M wishlisted · last synced X ago", plus a "Re-sync" button.

**Done when:** the popup shows correct counts that match your Bandcamp profile, and closing and reopening the browser keeps the data.

---

## Phase 3: Scanner (Milestone 3)

**Goal:** a polite, persistent background queue that can scan all supporters of one release.

1. [x] Queue repo over the `queue` store: `enqueue(kind, target, priority)` with de-duplication, `nextJob()` ordered by priority then `nextAttemptAt`, and `complete` / `fail`.
2. [x] Scheduler loop: one request at a time, with a random 1.5–3 s delay (from settings).
3. [x] Global backoff: on 429 or 5xx, honour `Retry-After`, otherwise use exponential backoff from 60 s. Pause the whole queue and keep the pause state in storage.
4. [x] Persistence across service-worker suspension: a `chrome.alarms` alarm every minute resumes the loop, and the loop is safe to re-enter (use a lock flag in storage).
5. [x] Job handlers:
   - `release` job: fetch the page, parse it, page supporters up to the per-release cap (500 most recent by default), save `items` and `releaseSupporters`, and enqueue each supporter as a `fan` job at the same priority
   - `fan` job: skip the profile page and start `collection_items` with a synthetic `<now>::a::` token at batch 100, up to 2,000 items (setting), write `fans` and `ownership`, and set `status` (`partial`, `done`, `private` or `error`)
6. [x] Freshness: skip fans scanned within the last 30 days and release supporters within the last 7 days.
7. [x] Priority bump: when a release page opens, its job and its supporters jump to priority 1.
8. [x] Daily request budget (3,000 by default), with a counter that resets at local midnight.
9. [x] Progress events broadcast to listeners: `{releaseKey, scanned, total}`.
10. [x] Unit tests for queue ordering, backoff math and budget, using fake timers and a mocked fetch.

Also added: the popup shows queued fans, today's requests and the pause reason, and the sidebar shows "Scanning supporters: N / M". Opening a release moves earlier releases' jobs back to priority 2, and network failures pause the queue like a 429 (decisions §5).

**Done when:** opening one album page scans every supporter end to end, survives the service worker being killed (test via `chrome://serviceworker-internals`), and stops correctly on a simulated 429.

---

## Phase 4: Also-bought sidebar (Milestone 4) ★ first daily-use build

**Goal:** useful recommendations in context on every release page.

1. [x] `scoring/weights.ts`: `w(i) = 1 / log2(2 + supporters(i))`, with `supporters(i) = also_collected_count + 1` taken from collection items, falling back to the count of scanned owners.
2. [x] `scoring/alsoBought.ts`, implementing the spec's steps 1–5 (lift uses the local base rate, decisions §6):
   - co-ownership counts read from the `ownership.matchKey` index (no full scans), so a track and its album count as the same release
   - lift with a cap, then `score = co × log(1 + lift)`
   - twin boost (stubbed as 0 until Phase 5)
   - drop owned, wishlisted, the release itself, and anything with `co < 2`
   - reason line: "7 of 48 supporters own this"
3. [x] Small-release fallback (fewer than 8 supporters): blend in the same label's and the same artist's other releases, labeled as such.
4. [x] Scoring runs in the service worker, re-scores every 5 fans scanned and pushes the results to the tab.
5. [x] Sidebar UI: collapsible, docked right, in a shadow root.
   - header with scan progress ("32 / 48 supporters scanned")
   - rows with cover, artist – title, label, reason line, and buttons for preview, wishlist, open and hide. Wishlist opens the release page for now: the logged-in wishlist call isn't captured yet (decisions §6)
   - preview in a Bandcamp `EmbeddedPlayer` iframe
   - "hide" saves a hidden-items set that the scorers respect
6. [x] "Parser broken" state: if a `ParserError` comes up, show a clear message instead of an empty panel.
7. [x] Scoring tests on a small synthetic dataset with known expected rankings.
8. [x] Performance check: seed around 300k `ownership` rows and confirm a re-score stays under about 200 ms. `npm run perf`: 39 ms at 300k rows, 88 ms at 1M. Uses a precomputed match index (decisions §6).

Also added: schema v3 (labels on items, the `fanMatches` / `matchOwners` match index and the `hidden` store), a "queue paused" notice in the sidebar, and the collapsed state kept across pages.

**Done when:** you use it on real releases for a week and the results look right. Note what feels off, so you can tune it in P7.

---

## Phase 5: Twins leaderboard (Milestone 5)

**Goal:** a ranked list of the fans whose collections overlap most with yours, shown on your profile page.

1. [x] `scoring/twins.ts`: weighted overlap on `matchKey` divided by `√(|M|·|F|)`, plus raw overlap and Jaccard. Apply the min and max collection-size filters from settings.
2. [x] Label-cluster flag: more than 50% of the overlap comes from one label and F owns more than 60% of that label's catalog. Apply ×0.3 (toggleable). For the MVP, "label" is the selling account (`band_id`), and catalog size is that seller's item count in the local DB (see decisions §3).
3. [x] Recompute twins after a sync and after every N new fans scanned, in chunks so the service worker never blocks for long.
4. [x] Wire the twin boost into Also bought, and add a *Twins who own this* tab to the sidebar. Boost ×(1 + 0.5 × twin share), at most ×1.5 (decisions §6).
5. [x] Profile page integration on `bandcamp.com/<you>`:
   - inject a **Twins** tab next to Bandcamp's own tabs, styled to match
   - put tab state in the URL hash (`#twins`), and hide Bandcamp's grid while the tab is active
   - leaderboard with avatar, name, overlap, % match, score and flag, plus sort (score / overlap / Jaccard) and filter
   - one tab injector (`src/content/profile/`) that For you (6.3) and Following reuse by adding an entry to `PROFILE_TABS`
6. [x] On other fans' profiles, show a badge such as "your #4 twin · 37 in common".
7. [x] "Add release to queue" button, so you can deliberately grow the dataset.

Also added: the scanner seeds itself from your own collection. After each sync, your owned releases' supporters are queued at a third, lowest priority, newest purchase first, with a setting to turn it off and "N / M your releases scanned" in the popup (decisions §5).

**Done when:** the leaderboard loads on reload or a direct `#twins` link, and the top 10 feel like real taste matches, not label subscribers.

---

## Phase 6: For you (Milestone 6) → MVP complete

**Goal:** recommendations built from what your top twins own.

1. [x] `scoring/forYou.ts`: take the top K twins (default 30), with `score(i) = Σ score(F) × w(i)`. Apply the same filters as Also bought.
2. [x] Optional diversity rule: at most 2 items per artist in the first 20.
3. [x] **For you** tab on your profile (`#for-you`), with ranked rows, the reason line ("owned by 5 of your top twins"), and preview, wishlist and hide buttons.
4. [x] Tests on synthetic data.

**Done when:** all three features work together on your real data.

---

## Following tags (planned, not MVP)

**Goal:** tag the fans, artists and labels you follow with your own tags, then filter your followings by tag, on Bandcamp's own following tab.

It isn't part of the MVP. Design and data source: decisions §8.

1. [x] Capture the following fixtures (pagedata and the `following_bands` / `following_fans` endpoint) and write the findings into decisions §8.
2. [x] Capture the rendered following tab and the band follow/unfollow request, logged in (decisions §8).
3. [x] Find how Bandcamp's follow buttons work, so our cards can reuse its handler instead of sending requests (decisions §8).
4. [x] Parser with fixture tests, plus the fixtures in `npm run fixtures:refresh`.
5. [x] Schema v5 migration.
6. [x] Following sync inside your own sync (always full, 500 per request).
7. [x] Tags repo, with tests for merge-on-sync, delete-cascade and bulk assign.
8. [x] Message bus and hooks, including batched `getTwinStandings`.
9. [x] `Chip`, `Checkbox` and `TagPicker` components, and `--dh-tag-1…8` colour tokens.
10. [x] Render the full list as Bandcamp cards (`followCard.ts`, selectors in `FAN_PAGE_DOM`), with our filter bar, and tag chips, checkbox and twin rank inside each card. Bulk tagging, unfollow tracking and all view states.
11. [ ] Tags on the account's own page: fan pages, release pages and the band's home page.
12. [x] Tag export/import.

**Done when:** the following tab lists everyone you follow, tags survive a full re-sync, filtering by two tags in AND and OR mode gives the right rows, bulk tagging 10 rows takes one action, follow/unfollow on our cards works through Bandcamp's own handler, and a followed artist's release page shows its tags.

---

## Phase 7: Hardening and dogfooding

1. [x] Popup v1: queue progress, pause and resume, budget counter, and settings for pace, caps and thresholds. Add "Clear all data".
2. [x] Error states throughout: offline, budget reached, queue paused for backoff, parser broken. One `NoticeStack` in `src/ui/`, fed by `scannerNotices()` (pure, tested) over `getScannerStatus`, shows them above the sidebar, both profile tabs and the popup. The worker now tells offline apart from Bandcamp's back-off (`pause.reason = 'offline'`, plus `online` from `navigator.onLine`).
3. [ ] Tune weights and thresholds from real use (lift cap, label-cluster limits, K).
4. [x] Fixture refresh script: re-capture fixtures and diff them against the saved ones, so you can quickly check whether Bandcamp changed something.
5. [x] Storage check: estimate DB size for a heavy user and add a cleanup for fans not seen in more than 180 days.
6. [ ] Run 2–4 weeks of daily use, ideally with a few friends who dig (load unpacked).

---

## Phase 8: Chrome Web Store release

1. [ ] Pick the final name (open question in the spec), make an icon, and take store screenshots.
2. [x] Write a privacy policy page: all data stays local, there is no server and no analytics.
3. [x] Write a short justification for each permission (host permission for bandcamp.com only, plus `alarms` and `storage`).
4. [ ] Build, zip and submit, then handle review feedback.
5. [x] Add a version bump and changelog process, plus a quick-patch path for parser breakage. release-please opens the release PR and CI submits to the store; see `docs/releasing.md`.

---

## Post-MVP backlog (roughly by value)

- Page badges ("6 twins" / "owned") next to release links anywhere on bandcamp.com, behind a setting
- Export picks as CSV or M3U-style text for DJ library tools
- Database export and import (backup, or moving to a new machine)
- Followers / following as an extra signal. The following sync from *Following tags* would provide its data.
- Firefox port (MV3 in Firefox, with `browser.*` polyfill)
- Better scoring: recency weighting, ignoring compilations

---

## Risk checkpoints

| When | Check | If it fails |
| --- | --- | --- |
| End of P0 | Supporters endpoint captured and paginates | Fall back to first-page supporters only, and show "partial" in the UI |
| End of P0 | Service-worker fetch carries cookies | Move your own collection and wishlist fetches into the content script |
| End of P3 | No 429s at the default pace over an hour of scanning | Lower the defaults and the daily budget |
| End of P4 | Re-score under ~200 ms at 300k rows | Precompute per-item owner counts and move scoring to an offscreen document. **Precomputing was enough: 39 ms (decisions §6).** |
| End of P5 | Top twins aren't dominated by label subscribers | Tighten the label-cluster thresholds or the down-weight |
