# Dighead: Roadmap

Step-by-step build plan for the Bandcamp digging extension (MV3, no backend), based on *Bandcamp Digging Extension: Architecture & MVP Spec* (Oct 19, 2026). "Dighead" is a working name taken from the repo folder.

Each phase ends with something you can load unpacked in Chrome and use. Phases 0–6 are the MVP. Phases 7–8 take it to the Web Store. After that comes the backlog.

```
P0 Recon ─► P1 Skeleton ─► P2 Sync me ─► P3 Scanner ─► P4 Also bought ─► P5 Crate mates ─► P6 For you ─► P7 Harden ─► P8 Ship
                                  └────────────── (P2 and P3 can overlap once P1 is done) ──┘
                                                                         └─► Following tags (after P6, modifies Bandcamp's following tab; not MVP)
                                                                               └─► Wishlist tags (same tags, on Bandcamp's wishlist tab)
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
     scoring/      weights.ts, crate mates.ts, alsoBought.ts, forYou.ts
     content/      shared/shadowRoot.tsx, release/, profile/
     popup/
     shared/       messages.ts (typed request/response), settings.ts
   tests/fixtures/
   ```
4. [x] Dexie schema for all 7 stores, plus `items.albumKey` and an indexed `ownership.matchKey` (decisions §3.8), (`items`, `fans`, `ownership`, `releaseSupporters`, `me`, `crateMates`, `queue`) with the indexes from the spec. Version it from day one so later migrations stay clean.
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

**Done when:** `pnpm build` produces a loadable extension, `pnpm test` is green, and a "hello" panel renders in a shadow root on an album page.

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
   - crate mate boost (stubbed as 0 until Phase 5)
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
8. [x] Performance check: seed around 300k `ownership` rows and confirm a re-score stays under about 200 ms. `pnpm perf`: 39 ms at 300k rows, 88 ms at 1M. Uses a precomputed match index (decisions §6).

Also added: schema v3 (labels on items, the `fanMatches` / `matchOwners` match index and the `hidden` store), a "queue paused" notice in the sidebar, and the collapsed state kept across pages.

**Done when:** you use it on real releases for a week and the results look right. Note what feels off, so you can tune it in P7.

---

## Phase 5: Crate mates leaderboard (Milestone 5)

**Goal:** a ranked list of the fans whose collections overlap most with yours, shown on your profile page.

1. [x] `scoring/crateMates.ts`: weighted overlap on `matchKey` divided by `√(|M|·|F|)`, plus raw overlap and Jaccard. Apply the min and max collection-size filters from settings.
2. [x] Label-cluster flag: more than 50% of the overlap comes from one label and F owns more than 60% of that label's catalog. Apply ×0.3 (toggleable). For the MVP, "label" is the selling account (`band_id`), and catalog size is that seller's item count in the local DB (see decisions §3).
3. [x] Recompute crate mates after a sync and after every N new fans scanned, in chunks so the service worker never blocks for long.
4. [x] Wire the crate mate boost into Also bought, and add a *Crate mates who own this* tab to the sidebar. Boost ×(1 + 0.5 × crate mate share), at most ×1.5 (decisions §6).
5. [x] Profile page integration on `bandcamp.com/<you>`:
   - inject a **Crate mates** tab next to Bandcamp's own tabs, styled to match
   - put tab state in the URL hash (`#crate-mates`), and hide Bandcamp's grid while the tab is active
   - leaderboard with avatar, name, overlap, % match, score and flag, plus sort (score / overlap / Jaccard) and filter
   - one tab injector (`src/content/profile/`) that For you (6.3) and Following reuse by adding an entry to `PROFILE_TABS`
6. [x] On other fans' profiles, show a badge such as "your #4 crate mate · 37 in common".
7. [x] "Add release to queue" button, so you can deliberately grow the dataset.

Also added: the scanner seeds itself from your own collection. After each sync, your owned releases' supporters are queued at a third, lowest priority, newest purchase first, with a setting to turn it off and "N / M your releases scanned" in the popup (decisions §5).

**Done when:** the leaderboard loads on reload or a direct `#crate-mates` link, and the top 10 feel like real taste matches, not label subscribers.

---

## Phase 6: For you (Milestone 6) → MVP complete

**Goal:** recommendations built from what your top crate mates own.

1. [x] `scoring/forYou.ts`: take the top K crate mates (default 30), with `score(i) = Σ score(F) × w(i)`. Apply the same filters as Also bought.
2. [x] Optional diversity rule: at most 2 items per artist in the first 20.
3. [x] **For you** tab on your profile (`#for-you`), with ranked rows, the reason line ("owned by 5 of your top crate mates"), and preview, wishlist and hide buttons.
4. [x] Tests on synthetic data.

**Done when:** all three features work together on your real data.

---

## Following tags (planned, not MVP)

**Goal:** tag the fans, artists and labels you follow with your own tags, then filter your followings by tag, on Bandcamp's own following tab.

It isn't part of the MVP. Design and data source: decisions §8.

1. [x] Capture the following fixtures (pagedata and the `following_bands` / `following_fans` endpoint) and write the findings into decisions §8.
2. [x] Capture the rendered following tab and the band follow/unfollow request, logged in (decisions §8).
3. [x] Find how Bandcamp's follow buttons work, so our cards can reuse its handler instead of sending requests (decisions §8).
4. [x] Parser with fixture tests, plus the fixtures in `pnpm fixtures:refresh`.
5. [x] Schema v5 migration.
6. [x] Following sync inside your own sync (always full, 500 per request).
7. [x] Tags repo, with tests for merge-on-sync, delete-cascade and bulk assign.
8. [x] Message bus and hooks, including batched `getCrateMateStandings`.
9. [x] `Chip`, `Checkbox` and `TagPicker` components, and `--dh-tag-1…8` colour tokens.
10. [x] Render the full list as Bandcamp cards (`followCard.ts`, selectors in `FAN_PAGE_DOM`), with our filter bar, and tag chips, checkbox and crate mate rank inside each card. Bulk tagging, unfollow tracking and all view states.
11. [x] Tags on the account's own page: fan pages, release pages and the band's home page.
12. [x] Tag export/import.

**Done when:** the following tab lists everyone you follow, tags survive a full re-sync, filtering by two tags in AND and OR mode gives the right rows, bulk tagging 10 rows takes one action, follow/unfollow on our cards works through Bandcamp's own handler, and a followed artist's release page shows its tags.

---

## Wishlist tags (not MVP)

**Goal:** tag the releases in your wishlist with the same tags as your follows, then filter your wishlist by tag, on Bandcamp's own wishlist tab.

Design: decisions §14.

1. [x] Schema v9: `itemTags`, keyed by item, so scans and syncs never wipe them. A full wishlist sync drops the tags of items that left it.
2. [x] Repo, messages and hooks: `listWishlist` (now `listItems`, §24), `getItemTags`, `assignItemTag`; deleting a tag takes it off items too.
3. [x] Share the tag filter, editor, filter bar and bulk bar between the following and wishlist tabs.
4. [x] Take over the wishlist tab: every release as a grid card with a playable cover, tags, "+ tag", a select box, the filter bar, bulk tagging and all view states.
5. [x] Tags on a wishlisted release's own page, in the sidebar.
6. [x] Item tags in the tag export/import (file version 2; version 1 files still import).
7. [ ] Try the takeover on the live wishlist tab, with Bandcamp's own JS running.

**Done when:** the wishlist tab lists every wishlisted release, tags survive a full re-sync, filtering by two tags in AND and OR mode gives the right rows, bulk tagging 10 rows takes one action, and a wishlisted release's page shows its tags.

---

## Wishlist and collection tools (not MVP)

**Goal:** sort, annotate and plan purchases from your wishlist, get the same tools on the collection tab, and take your lists into a spreadsheet. Research ideas 3, 6, 8 and 9; design: decisions §24.

1. [x] Schema v16: `itemNotes` (text and a 1–5 rating) and `itemPrices`. The wishlist parser keeps price, currency and whether it can be bought; an incremental sync reads unpriced wishlist items once.
2. [x] `scoring/wishlistCrateMates.ts`: how many top crate mates own each release. Pure, with a synthetic test.
3. [x] `shared/itemSort.ts`: added, artist, label, price, crate mates, buy next. Remembered per tab.
4. [x] Notes and ratings on the card (`NotePopover`, `Rating`), the tags backup file version 3 (older files still import) and the full backup.
5. [x] Generalise the wishlist takeover into `content/itemList/` and take over the collection tab with it (sort by purchase date, artist or label; tags, filter and bulk bar). Tags and notes now survive a purchase.
6. [x] Bandcamp Friday shortlist: purchasable wishlist items in buy next order, with totals per currency. Read-only.
7. [x] CSV export of the wishlist, the collection and a For you list, from the popup (`shared/csv.ts`, `exportCsv.ts`).
8. [ ] Try both tabs on live pages with Bandcamp's own JS running, and a collection of thousands (check the first render and the message size).

**Done when:** each tab sorts by every key it offers and remembers it, a note and rating survive a re-sync and a purchase and come back from a tags backup, the shortlist adds up per currency, and a CSV opens in a spreadsheet with its accents intact.

---

## Lately crate mates (not MVP)

**Goal:** find the fans whose *recent* buying is in step with yours, not just the ones you overlapped with years ago, and see which crate mates are drifting apart or getting closer.

Design: decisions §11.

1. [x] Purchase times in the match index (schema v7), and restoring v5 and v6 backups.
2. [x] `scoring/lately.ts`: time-faded overlap, a co-timing bonus, and the trend against a year ago.
3. [x] A second leaderboard (`latelyCrateMates`) from the same recompute pass.
4. [x] Crate mates tab: *All time / Lately* switch, a "this year" column and a trend column on both boards.
5. [x] For you *Fresh* mode, built from lately crate mates and their recent buys.
6. [x] Lately rank in the profile badge ("your #2 crate mate lately").
7. [x] Re-scan top lately crate mates more often than every 30 days, and a "Crate mates' latest" feed of what they just bought.

**Done when:** on your real data the Lately board puts fans you're buying alongside now at the top, and long-standing crate mates you've drifted from show "apart".

---

## Smarter supporter scanning (not MVP)

**Goal:** opening a release with hundreds of supporters reads the ones likely to share your taste first, so Also bought fills in with relevant rows within the first minute.

Design: decisions §12. The scoring half (confidence bound, omnivore damping, warm-up) is tracked separately.

1. [x] Fan-profile parser for Bandcamp's "N items in common", with a signed-in fixture.
2. [x] Pass 0: rank a release's supporters by what they're known to own of yours, with a `rank` tie-break in the queue (schema v8).
3. [x] Pass 1: one signed-in profile page per supporter, ranked by in-common count over both collection sizes.
4. [x] Pass 2: a quick 100-item read around each fan's purchase, best match first, then full scans in the background. Quick-read fans stay out of crate mates until then.

**Done when:** opening a large release reads high-overlap supporters first, and their full scans still complete in the background.

---

## Deep cuts (not MVP)

**Goal:** a For you mode that surfaces releases few people own but your closest crate mates do, with an honest "only N owners" reason.

Design: [decisions §18](docs/decisions.md), research in [docs/research/deep-cuts.md](docs/research/deep-cuts.md). Score = Σ crate mate scores × t/(t + 2) × n^−0.6, limited to releases with at most N Bandcamp owners, where N is a setting (`deepCutMaxSupporters`, default 50).

1. [x] `scoring/deepCuts.ts` (the cap passed in), plus the constants and `nichePenalty` in `weights.ts`, and the `deepCutMaxSupporters` setting (default 50, 5–1000) in `shared/settings.ts`, with the synthetic test set (niche beats staple, cap, agreement shrink, no-count skip, ceiling safety).
2. [x] `computeDeepCuts` in `background/recommend/`, with K = 100 crate mates and ceiling pruning; `pnpm perf` with a 100-crate-mate board. Add the `items.supporterCount` index only if it's over budget.
3. [x] `getForYou { mode }` on the message bus, and `ForYouRow.supporters` plus the best crate mate's rank.
4. [x] For you tab: a Deep cuts option in the `All time / Fresh` switch, a "Deep cut: at most N owners" field in the popup's settings, the reason line ("Only 4 owners on Bandcamp · 3 are your crate mates"), and the empty state "No deep cuts yet: your crate mates' rare records show up as more of them are scanned".
5. [x] Offline eval script (`tests/eval/`, run with `pnpm eval <backup.json>`, out of `pnpm test`): temporal and random holdout on a local backup, crate mates recomputed without the held-out releases, recall@k, niche recall@k, mean popularity of the list, median owners of the hits, and a grid over β, the shrink constant and the cap.
6. [x] Tune the defaults from the eval on real data, and record the numbers in decisions §18 (first run: defaults kept, re-run after more scanning).
7. [ ] Later: an early-adopter boost, tested first ("do early buyers overlap more with your crate mates?").
8. [ ] Later: β adapted to how mainstream your own collection is.

**Done when:** on your real data, Deep cuts finds at least 1.5× as many of your held-out rare releases as For you does, and its rows feel like real finds, not noise from one crate mate.

## Ignoring compilations (not MVP)

**Goal:** label samplers and Various Artists comps stop making strangers look like crate mates and stop crowding the picks.

Design: decisions §17.

1. [x] Capture a compilation release page as a fixture (`album-page-compilation.html`).
2. [x] `bandcamp/compilation.ts`: a high-precision detector (various-artists artist line, VA title prefix, and on release pages 3+ other track artists), set on collection and release-page items, with fixture tests.
3. [x] Schema v11: `items.compilation`, flagged on existing items by the upgrade and on older backups by `migrateRows`. A collection page never clears a release page's flag.
4. [x] Crate mates and lately crate mates: compilations you own are left out of the shared releases.
5. [x] Also bought and For you (both modes): compilations down-weighted ×0.5 as picks.
6. [x] `ignoreCompilations` setting (default on), with a popup toggle.
7. [ ] Check on real data: how many of your releases get flagged, and spot-check a sample for false positives.

**Done when:** a fan whose only overlap with you is a comp isn't on either crate mates board, a comp ranks below a normal release with the same evidence in Also bought and For you, and no single-artist album in your collection is flagged.

---

## Page badges (not MVP)

**Goal:** see at a glance, anywhere on bandcamp.com, which linked releases you own, have wishlisted, or your top crate mates own ("owned", "wishlist", "6 crate mates"), without any extra Bandcamp requests.

Design: decisions §15.

1. [x] `bandcamp/pageLinks.ts`: release links and their ids from fan, band and release pages, else a normalised URL, with fixture tests.
2. [x] Schema v10: an index on `items.url`, and `pageBadges` in `db/repo/`: owned, wishlisted and top-crate-mate counts for a whole batch of links in one read.
3. [x] `getPageBadges` on the message bus.
4. [x] Content script: one batched lookup per page, a debounced `MutationObserver` for pages that grow, one badge per release per card, rendered through one React root into small shadow roots.
5. [x] Setting, off by default: *Pages* → "Badges next to release links" in the popup.
6. [ ] Try it on live pages: Discover, the feed, a fan's collection, a band page and a release page's recommendations.

**Done when:** with the setting on, a fan page and Discover show "owned" on your releases and "N crate mates" on releases your crate mates own, with one worker message per batch of links and no Bandcamp requests.

---

## Tag on follow and wishlist (not MVP)

**Goal:** tag a release or an account the moment you heart or follow it on its page, instead of after the next sync.

Design: decisions §21. Uses the tags of *Following tags* and *Wishlist tags*; no new requests.

1. [x] Fixture of Bandcamp's heart and follow controls as its JS renders them, and pure readers for their state in `bandcamp/pageActions.ts`.
2. [x] Repo and messages: `markFollowed`, `markWishlisted`, `markUnwishlisted`; unfollow reuses `setUnfollowed`. Tags survive an undo.
3. [x] `AnchoredTagPicker`, and `useTagPrompt` watching the heart, saving it and opening the picker next to it. Follows are saved (`useRecordFollow`) but open no picker: Bandcamp's mailing-list dialog closes it.
4. [x] On band, release and fan pages, with a setting to turn the picker off.
5. [ ] Try it logged in on live pages.
6. [x] Wishlist and following tabs during a sync and with long lists (followings now sync before the collection, page by page): shows items as they sync, reloads only when the count changes, keeps unchanged cards, renders 120 cards at a time (decisions §14).

**Done when:** hearting a release or following an account on its page opens the tag picker by the button, the tag shows on the page and on the wishlist or following tab without a sync, and undoing it keeps the tags for a re-add.

---

## Following as a signal (not MVP)

**Goal:** what you follow on Bandcamp nudges recommendations and scanning, without drowning out what collections say.

Design: decisions §16. Uses the following sync from *Following tags*; no new requests.

1. [x] `scoring/following.ts`: which releases come from a followed artist or label, a flat ×1.25 boost (below the crate mate boost's ×1.5), and followed-first ordering, with synthetic tests.
2. [x] Repo reads: followed bands with their local releases (seller or label), followed fans.
3. [x] For you (both modes) and Also bought's co-owned rows: the boost, with pruning ceilings scaled so no boosted release is cut early. Setting `followingBoost` (default on) in the popup.
4. [x] Reason text: "… · you follow Warp" on boosted rows.
5. [x] Supporters you follow are read first: front of pass 0, and their collection reads ahead in pass 1.
6. [x] "you follow" badge on both crate mates boards; scores untouched.
7. [ ] Later, if followed fans turn out to be good crate mates: queue their collections at seed priority (≤ 20 requests each, once).
8. [ ] Try it on real data: do followed releases feel like a nudge, or like noise you already know?

**Done when:** on your real data a release from an artist you follow moves up a few places in For you and says why, and turning the setting off puts it back.

---

## Hide, heard and play-through (not MVP)

**Goal:** take whole artists and labels out of recommendations and undo it, see and filter what you've already listened to, and play a list through. Research ideas #4, #2 and #7 (`docs/research/bandcamp-user-needs.md`).

Design: decisions §22. Schema v14; no new requests.

1. [x] Schema v14: `hidden` becomes `hides`, keyed by `[kind+key]` (release, band, label), old rows migrated as releases by the Dexie upgrade and by backup import. New `heard` store (matchKey, time, source).
2. [x] `scoring/exclusions.ts`: hidden releases as ids, hidden artists and labels as a per-item check, and an optional heard set, with synthetic tests. Every recommender uses it: Also bought (co-owned and fallback), For you (All time, Fresh, Deep cuts) and Crate mates' latest, which now fills its list past hidden rows.
3. [x] Messages `hide` / `unhide` / `listHidden` (target: `release` / `band` / `label`) replace `hideRelease`; `markHeard` / `unmarkHeard`; `hideHeard` on `getForYou`, `getAlsoBought`, `getCrateMatesLatest`.
4. [x] Rows: "Hide from recommendations" menu (Radix dropdown in `src/ui/Menu`, portalled into the shadow root) with this release / everything by the artist / everything on the label, offered only where the account is known. Heard button, `HeardBadge` and a dimmed cover.
5. [x] Heard marks from our preview player and from Bandcamp's own player on release pages (`useBandcampPlays`), after 30 s of listening.
6. [x] "Hide heard" switch on For you, Also bought and Crate mates' latest, filtered in the worker before the list is cut, with an empty state that turns it off.
7. [x] Play through a list: one player per list (`useListPlayer`) over the pure queue in `shared/playQueue.ts`. Play all, auto-advance, previous / next / stop, and K / N / P / Esc while playing.
8. [x] Popup *Hidden* tab: what you hid, newest first, with Unhide.
9. [x] Wire `HeardBadge` and dimmed covers into the wishlist and collection grids (decisions §24, *Heard on cards*).
10. [ ] Try it live: does Bandcamp's player put its `<audio>` in the page, so `useBandcampPlays` hears it? Does the queue keep playing in a background tab?

**Done when:** hiding an artist from a row takes their releases out of every list, including ones scanned later, and Unhide in the popup brings them back; a release played for 30 s shows as heard in every list, and "Hide heard" leaves it out with a full list; Play all plays For you top to bottom.
## New from your follows (not MVP)

**Goal:** see what the artists and labels you follow released lately, in one list, with your own mutes, and optionally a notification when there's something new. Research #1 and #10.

Design: decisions §23.

1. [x] Recon: the mobile API's `band_details` (discography with release dates) and `tralbum_details` (URL), chosen over `/music` (no dates, custom-domain redirects) and the logged-in feed. Fixtures and refresh specs.
2. [x] Parser `bandcamp/discography.ts` with fixture tests and `ParserError` / `BandcampApiError`.
3. [x] Schema v15: `bandReleases`, `bandReads`, `followMutes`. In backups and Clear all data.
4. [x] Job kind `followReleases`: weekly reads at priority 2.75, inside the daily budget; opening the tab moves them up.
5. [x] `scoring/followsDigest.ts`: news time, window, exclusions, newest day first with crate-mate interest. Synthetic tests.
6. [x] Profile tab `#follows`: rows with preview, "New since your last visit", follow tags as filters, per-account mute, every view state.
7. [x] Notifications: optional `notifications` permission, popup setting (off by default), one grouped notification per round, click opens the tab.
8. [ ] Try it live: the tab, a first round on a few hundred follows, a notification and its click.
9. [x] After the merge with *Heard it*: rows use the shared row controls (heard mark, the "Hide from recommendations" menu, play through) and the tab has its own *Hide heard* switch (decisions §23, "With hide and heard").

**Done when:** a week after following a few active labels, the tab lists their new releases newest first, muting one hides it, and the notification (when on) arrives once.

## List filters (not MVP)

**Goal:** narrow For you, Also bought and Crate mates' latest by genre, location, name your price, physical edition and release year, so a fan can dig locally or by format.

Design: decisions §25. Research: feature #5 in `docs/research/bandcamp-user-needs.md`. No new requests.

1. [x] Genre table from `bandcamp.com/discover` (fixture), and `bandcamp/facts.ts`: genre, location, name your price, physical and year read from collection rows and release pages, with fixture tests.
2. [x] Schema v17: facts on `items` and `bands` (nothing to rewrite), `fillBandLocations` from the following list, `migrateRows` for older backups. Storage cost measured against the real backup.
3. [x] `scoring/listFilters.ts` (pure `judge` and `locationMatches`) with synthetic tests; unknown facts hide the release and are counted.
4. [x] `filters` on `getForYou`, `getAlsoBought` and `getCrateMatesLatest`, applied in the worker before each list is cut, with a search limit; Also bought keeps its filters through its own re-scores.
5. [x] "Your place" setting for Near me (text match, no geocoding).
6. [x] `ListFilterBar` in `src/ui/`, remembered per list, with the "N hidden by filters" line and the empty state.
7. [x] `pnpm perf`: filters stay within budget (decisions §25).
8. [ ] Try it on real data: do the filters leave enough on a database that hasn't been rescanned? If not, re-read the top crate mates' collections once (decisions §25, *Older rows*).
9. [ ] Check `band_location` on collection rows logged in.

**Done when:** on fixtures and synthetic data each filter narrows each list, a filter few releases pass still returns what matches, and the bar says how many it hid and how many it couldn't judge.

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

Also added: full database export and import on the popup's Settings tab (backup, or moving to a new machine). Import replaces everything and keeps settings, pause and budget (decisions §10).

---

## Post-MVP backlog (roughly by value)

- Export picks as M3U-style text for DJ library tools (CSV is done: *Wishlist and collection tools*)
- Firefox port (MV3 in Firefox, with `browser.*` polyfill)

---

## Risk checkpoints

| When | Check | If it fails |
| --- | --- | --- |
| End of P0 | Supporters endpoint captured and paginates | Fall back to first-page supporters only, and show "partial" in the UI |
| End of P0 | Service-worker fetch carries cookies | Move your own collection and wishlist fetches into the content script |
| End of P3 | No 429s at the default pace over an hour of scanning | Lower the defaults and the daily budget |
| End of P4 | Re-score under ~200 ms at 300k rows | Precompute per-item owner counts and move scoring to an offscreen document. **Precomputing was enough: 39 ms (decisions §6).** |
| End of P5 | Top crate mates aren't dominated by label subscribers | Tighten the label-cluster thresholds or the down-weight |
