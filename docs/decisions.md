# Phase 0 findings and decisions

Recon done on 2026-10-19, logged out, with curl against live bandcamp.com. Raw responses are in `tests/fixtures/` (see its README). This file replaces the "to verify" notes in the spec.

## 1. Confirmed data sources

### Release supporters (the spec's biggest open question): solved

- **First page** is in the HTML, in `<div id="collectors-data" data-blob="…">`:
  - `thumbs`: up to 80 supporters, each with `fan_id`, `username`, `name`, `image_id` and `token`
  - `reviews`: up to 6 supporters who wrote a "why" blurb
  - `more_thumbs_available` and `more_reviews_available` flags
- **More pages** (found in Bandcamp's `tralbum.js`, then tested):
  ```
  POST https://bandcamp.com/api/tralbumcollectors/2/thumbs
  Content-Type: application/json
  {"tralbum_type": "a" | "t", "tralbum_id": 3149089081, "token": "<last token seen>", "count": 100}
  → {"results": [...], "more_available": true}
  ```
  `/api/tralbumcollectors/2/reviews` takes the same body and paginates reviewers.
- **Reviews and thumbs are disjoint**, so `supporters = reviews ∪ thumbs`. Page both.
- **Token format:** `1:<purchase unix ts>:<fan_id>:<is_review 0|1>:1:0`. The purchase time comes for free.
- Rows from page 2 onward also include `url`, `item_type` (`a` = digital, `p` = physical package) and `mod_date`.
- **No total count** is returned. Use `also_collected_count` (below) instead of paging to the end.
- No session needed.

### Fan collection and wishlist: work logged out

- `POST /api/fancollection/1/collection_items` and `/wishlist_items` with `{fan_id, older_than_token, count}` → `{items, more_available, last_token, tracklists, ...}`.
- Page tokens look like `<purchase unix ts>:<tralbum_id>:<a|t>::`.
- **`last_token` always points at the 20th item, whatever `count` is** (found 2026-10-20: at batch 100, each page overlapped the next by 80 items). Every item carries its own `token`, so page on from the **last item's** `token`, not `last_token`.
- **A synthetic first token works:** `"<now unix ts>::a::"`. Supporter rows already give `fan_id`, so a fan scan **doesn't need to fetch the fan's profile page**, which saves one request per fan.
- **`count` is accepted up to at least 500.** One request returned 500 items in 1.2 MB and 3.6 s. The site itself uses 20.
- Every collection item carries:
  - `tralbum_type` + `tralbum_id`: the release key
  - `item_type` (`album`, `track` or `package`). Packages point to their album's `tralbum_id`, so physical purchases fold into the album automatically.
  - `band_id`, `band_name`, `url_hints.subdomain`, `item_url`, `item_art_id`
  - `purchased` (date string)
  - **`also_collected_count`: how many other fans own this release.** This is the rarity weight input, and it comes with every collection item, so you never fetch it separately.
  - `label` and `label_id`, **but only on about half the items** (correction, 2026-10-20: the original recon missed them). They're set when a release is on a label and sold from the artist's own account. When a label sells from its own account, `band_id` is the label and `label` is empty. See §3.3.

### Release metadata

- `data-tralbum`: `id`, `item_type`, `artist`, `art_id`, `url`, `current.band_id`, `trackinfo[]`, and for tracks, `album_url` and `current.album_id`.
- ld+json gives `publisher` (the selling account, with `band_id`), `keywords` (tags), `datePublished` and `numTracks`.
- `<meta name="bc-page-properties">` has `item_type` and `item_id`. `og:image` gives the cover. `twitter:player` gives the EmbeddedPlayer URL, ready to use for previews.

### Fan profile page (`#pagedata`)

- `fan_data`: `fan_id`, `username`, `name`, `followers_count`, `is_own_page`, …
- Following lists (`following_bands_data`, `following_fans_data`) and their endpoint: see §8.
- `collection_data`: `item_count`, `hidden_items_count`, `last_token`, `batch_size`
- `wishlist_data`: `item_count`, `hidden` (whole wishlist hidden), `last_token`
- `identities.fan`: `null` when logged out. This is how the logged-in user is detected.
- `item_cache.collection`: the first 20 items, in the same shape as the API.

### Error shapes

| Case | Response |
| --- | --- |
| Unknown `fan_id` | HTTP 200, `items: []`, `last_token: null` |
| Malformed token | HTTP 200, `{"error": true}` |
| Hidden wishlist | HTTP 200, `{"error": true}` (identical) |
| Unknown username page | HTTP 404 |
| Logged-out `/settings` | HTTP 303 → `/login` |

Parsers must check for `error: true` on 200 responses, not just the HTTP status.

## 2. Answers to the spec's open questions

| Question | Answer | Status |
| --- | --- | --- |
| Does `collection_items` need a session for public collections? | **No.** Collections, wishlists and supporters all work logged out. A session only matters for your own hidden items: logged in, your own page has `hidden_data` and the synced collection count is above the logged-out one (see "Confirmed with a real account" below). | Answered |
| Private or hidden collections? | No fully private collections turned up in 50 sampled supporters. Bandcamp hides at the item level (`hidden_items_count`) and the whole-wishlist level (`wishlist_data.hidden`). Of the 50, **0 had hidden collection items** and **9 (18%) had hidden wishlists**. A hidden wishlist makes `wishlist_items` return HTTP 200 `{"error":true}`, **the same response as a malformed token**, so the scanner can only tell them apart with the first-page synthetic token. Impact is low: the MVP only reads *your own* wishlist. A fan is marked `private` only if `collection_items` errors on the first page (see "Private fans" below). | Answered |
| Tracks vs albums | **Decided (2026-10-20): owning a track counts as a match with owning its album.** Track-from-album buys are common in underground scenes. The link is cheap: a collection item's `album_id` matched the track page's `album_id` in 10 of 10 sampled tracks, so no extra requests are needed. Standalone singles have `album_id: null` and stay their own item. How this works is in §3.8. | Decided |
| Private fans | **Decided (2026-10-20): ignore them.** If a fan's collection can't be read (`collection_items` errors on the first page), set `status = private`. Leave them out of crate mates, scoring and the fan count `N`, and show nothing in the UI. | Decided |
| Name | **Decided (2026-10-27): Crater.** It replaces the working name "Dighead". The IndexedDB keeps the name `dighead` so existing local databases stay readable. | Decided |

## 3. Changes to the spec's design

1. **Item key = `tralbum_type + tralbum_id`**, never `item_id`, so packages map onto their album.
2. **`supporters(i)` = `also_collected_count + 1`**, read from any collection page that contains the item. Fall back to the count of scanned owners only if it's missing. `items.supporterCount` gets filled for almost every item.
3. **Label = `label_id` when a collection item has one, otherwise the selling account** (`band_id` / `url_hints.subdomain`). `items` keeps `label` and `labelId` from collection pages; release pages only show the label's name (ld+json `recordLabel`), not its id, so a release-page save keeps whatever collection pages said. A label that sells from its own account shows up only as the selling account. For the label-cluster flag, measure "share of that seller's catalog" against the seller's items in the local DB for the MVP. A real catalog count would need one fetch of `<subdomain>.bandcamp.com/music` per seller, which can come later.
4. **Fan scans skip the profile page.** Start `collection_items` with a synthetic token, and take `username`, `name` and `image_id` from the supporter row. `fans.collectionSize` stays unknown until the last page, or until you open that fan's profile.
5. **Batch size 100 for collections**, paging on from the last item's `token` (see §1). That's up to 20 requests to hit the 2,000-item cap, instead of 100 at batch 20. 500 works too, but responses get big and slow. 100 is a polite middle ground.
6. **New cap: supporters per release.** Promises has about 18,400 supporters, which would be 184 supporter pages before scanning a single fan. Default to the **most recent 500 supporters** (first page plus about 5 requests), and make it a setting.
7. **`ownership.purchasedAt`** comes from the item's `purchased` field, or from the supporter token's timestamp.
8. **Matching uses a `matchKey`, not the raw item key.**
   - Each item still keeps its own `itemKey` (`a123` or `t456`), so the UI can show exactly what someone bought.
   - `items.albumKey` holds `a<album_id>` for a track that belongs to an album, and is null otherwise.
   - `matchKey = albumKey ?? itemKey`. It is copied onto every `ownership` row and indexed, so all overlap and co-ownership queries stay index reads.
   - Effects:
     - You own album A and a crate mate owns one track from A: **match.**
     - Two people own different tracks from A: a match for co-ownership and recommendations (Also bought, For you), since it's the same release group. **Not a match for crate mate overlap** (changed 2026-10-21, §7).
     - Rarity weight uses the album's `also_collected_count` when it's known, otherwise the track's.
     - Recommendations are ranked per `matchKey` and point at the album, with a reason such as "2 crate mates own tracks from this".
     - If you own a track of A, A is left out of recommendations, as if you owned A (changed 2026-10-22: buying a track almost always means you've heard the album; before, A stayed in, tagged "you own 1 track"). Wishlisting a track of A keeps A in.
   - Track-only buyers don't appear in the album's supporter list. For your own releases, seeding lists each track you own as well as the album (§ seeding, 2026-10-29). For a page you open, it's still open: pulling them would cost one supporters request per track.

## 4. Syncing your own collection (Phase 2)

- **Who you are** comes from `#pagedata` → `identities.fan` (`id`, `username`), which is on fan, album and track pages. The content script sends only that element to `parseViewer`, not the whole page. It reports it to the worker on every Bandcamp page view (`pageSeen`).
- **Your owned and wishlisted items are your `ownership` rows** (`source` = `collection` or `wishlist`). `me` only holds who you are and `syncedAt`. Item metadata goes into `items` with the same mapper as fan scans, keeping any tags from release pages.
- **Two sync modes:**
  - *full*: page everything, then delete your rows that weren't seen, so removed wishlist items go away. It runs on first detection, when the logged-in fan changes, after a sync that never finished, and from the popup's Re-sync button.
  - *incremental*: stop at the first page whose items are all known, so it usually costs 1–2 requests per list. It runs on browser startup, on the purchase page, and on any page view when the last sync is over 24 h old. It can't see removals.
- **Wishlist first, then collection**, so an item you bought since wishlisting ends up as `collection` (same `[fanId+itemKey]` row).
- **Hidden wishlist:** if your wishlist errors on its first page, the sync keeps going with the collection.
- **Pace:** your own sync waits the scanner's pace (1–2 s by default, scaled by the adaptive factor, §5) between pages but doesn't count against the daily budget. Each wait re-reads settings from `chrome.storage`. Because that's an extension API call, it keeps the service worker alive through a long sync. If the worker is killed anyway, `syncedAt` stays unset and the next trigger runs a full sync again.
- **Purchase page (confirmed 2026-10-20, `purchase-confirmation.html`):** checkout (`/cart/checkout?…`) 303s to `https://bandcamp.com/download?cart_id=…&sig=…&from=checkout`. The page drops `from` from the address bar after load, so content scripts match on `/download` with a `cart_id` param. Re-downloads from your collection use `/download?from=collection&payment_id=…&sig=…&sitem_id=…` with no `cart_id`, so they don't trigger a sync.
- **Confirmed with a real account (2026-10-20):** the worker's session cookies reach the API. A wishlist that is hidden publicly synced in full (137 items), and the collection count was slightly above the logged-out profile's (1,131 vs 1,127).

## 5. Network and the scanner (Phase 3)

Code: `src/background/scanner/`, with the queue repo in `src/db/repo/queue.ts`. Decided 2026-10-20.

- **All network goes through the service worker.** Content-script fetches fail CORS on artist subdomains, so content scripts only send messages.
- **One request per job run.** A `release` job and a `fan` job each send exactly one request per run and save a `cursor` (the next token) in their `queue` row. Effects:
  - A killed worker loses at most one request. The job resumes from its cursor rather than starting over.
  - A release page opened mid-scan gets the very next request, instead of waiting for a 2,000-item fan to finish.
  - The budget counts each request **before** it's sent, so a request cut off by a kill still counts.
- **Priority bump = foreground release.** Opening a release page moves its job and its supporters' jobs to priority 1, and moves any other priority-1 jobs back to 2. **This changes the spec**: if nothing moved back, every release you'd ever opened would sit at 1, and "jump to priority 1" would no longer put the new one first. Within a priority, jobs run by `nextAttemptAt`, then `rank`, then insertion order (changed 2026-10-21: `rank` orders a release's supporters by expected overlap, §12; before it, supporters were scanned in page order).
- **Seeding from your own collection** (`scanner/seed.ts`). Without it, the crate mates pool only held supporters of pages you happened to open. After each successful sync of your own collection, a `release` job is queued for each release you own:
  - Collection only, not the wishlist. When you own the album, one job for the album. When you own only tracks of it, one job per track you own plus one for the album (changed 2026-10-29: before, only your newest track was listed, which missed both the album's buyers and the buyers of your other tracks). The album's URL is only on a track page, so the first seed track job queues the album job (`releaseJob.ts`, SEED priority only, so opening a track page doesn't).
  - Releases whose supporter list is fresh (7 days) are skipped. A full sync seeds every release you own. An incremental sync seeds only the releases holding items it added, so the daily resync doesn't re-list your whole collection each week.
  - **Three priorities:** 1 = the open release, 2 = releases opened earlier, 3 = seed (its fans at 3.25, below). A page you open always goes first, and supporters of pages you opened aren't starved by a 1,000-release backlog. `focusRelease` only moves priority-1 jobs back to 2, so seed jobs stay at 3 unless you open that release. `enqueue` never lowers a priority, so seeding never demotes a release that's already queued higher.
  - **Order within seed:** a seed job's `nextAttemptAt` is its purchase time negated, so newer purchases run first, even when a later incremental sync adds them behind an older backlog. Negative times are always due. The newest purchase in a matchKey group counts; unknown dates go last.
  - **Pages you open go vertical, the seed backlog horizontal** (changed 2026-10-29; before, seed went vertical too).
    - *Priorities 1–2:* fans inherit their release job's priority and place in line (its `nextAttemptAt`). A release's supporters are scanned before the next release at that priority starts, so the release you're reading fills in fully and its Also bought is complete soon.
    - *Seed:* a seed list's fans wait at priority 3.25 (`SEED_FANS`), due now, behind every seed list. So every supporter list of your releases is read first (~1–6 requests each), and only then their fans. Why: seeding feeds crate mates and For you, which reward overlap across your releases, not depth on one. Depth first spent the budget on one-off buyers of your newest release while your closest crate mate sat behind your 200th.
    - *The order across releases* (`seedFanOrder`, `scanner/seedFans.ts`) comes from what's already stored, so it's free: a supporter list writes an ownership row per fan ("Supporters are owners" below), so an unscanned fan's `fanMatches` holds the lists of yours they're on, once per matchKey (album and track lists count once). Fans on two or more of your releases go first, then by Σ w(i) over the releases they share with you (w(i) = 1 / log2(2 + supporters), `weights.ts`), so two rare releases beat two hits. Fans you follow go first (§16). Ties keep queue order. No seller bonus: it's a per-release signal.
    - *When it ranks:* as a seed list finishes and no other seed list is due, after a seed list fails (dropped or retrying, so it doesn't hold the backlog up), and after a sync that leaves no seed list due. A seed list landing later, from an incremental sync or a retry, ranks the waiting fans again. Ranking reads every waiting seed fan, so it runs once per backlog, not once per list. Scans that have started keep their place.
    - The v20 upgrade (and importing an older backup) moves seed fan jobs from 3 to 3.25, due now. They're ranked at the next point above.
  - **Budget:** seed jobs share the daily budget (30,000 by default) and simply take what's left after priorities 1 and 2. A large collection won't finish in a day (one release can mean ~6 supporter pages plus up to 500 fan scans), which is why the order matters. Your own sync stays outside the budget (§4).
  - The popup shows "N / M your releases scanned": matchKeys whose every list above exists (any age), out of the matchKeys you own.
  - The `seedFromCollection` setting (default on) turns it off. Turning it off stops new seeding only: already-queued seed jobs keep running until they're done, you pause the scanner, or you clear the data.
- **Failures come in three kinds** (`scanner/outcome.ts`):
  - *throttled*: HTTP 429, 5xx, **or no response at all** (offline, DNS, 30 s timeout). The whole queue pauses and the job stays as it is, with no attempt counted. Network errors are in this group because being offline is never one job's fault. Counting them per job would burn every job's retries in seconds.
  - *permanent*: another 4xx, a `ParserError`, or a `{"error": true}` other than a fan's first page. The job is dropped, and a dropped fan gets `status = error`.
  - *transient*: anything else, which is probably our own bug (e.g. a DB error). The job is retried after 60 s, then 120 s, then dropped.
- **Offline vs. Bandcamp pushing back:** both use the same back-off, but a back-off started by a request with no answer is flagged `offline` in the scanner state, and `getScannerStatus` reports it as `pause.reason = 'offline'`, plus `online` from `navigator.onLine`. The UI says "You're offline" only when the browser agrees. While `navigator.onLine` is true it says "Requests aren't getting through", since a run of unanswered requests can have other causes (2026-10-30: real-world false alarm while online). Neither says "Bandcamp asked Crater to slow down". The flag clears on the next successful request. **Try again:** the "Requests aren't getting through" banner has a button that retries at once, and so does Pause then Resume. Both clear a no-answer back-off but keep the failure count, so a failed try pauses again after one request (with a fresh 60 s wait) instead of five, and costs no job a retry attempt. A back-off Bandcamp asked for stays, because resuming must not skip `Retry-After`.
- **Back-off:** honour `Retry-After` (seconds or an HTTP date). Without it, wait 60 s and double the wait after each consecutive throttled request, up to 1 h. The first successful request resets it. The pause lives in `chrome.storage.local` (`scanner` key), so it survives a killed worker and a browser restart.
- **Adaptive pace (2026-10-28):** the pace setting is the starting range, and a factor in the scanner state multiplies it. Every 100 requests sent without a throttle shrink the factor by 10 %, down to 0.5 (twice as fast). Each throttled request (429 or 5xx, not offline) doubles it, up to 4, and restarts the count. The wait never drops below 0.5 s, half the 1 s settings floor: you can't type a wait under 1 s, but a long calm stretch (at least 700 requests) can earn one, and one throttle doubles it again. With the Fast defaults that tops out at 0.5–1 s. The factor persists with the rest of the scanner state, so a slow-down Bandcamp asked for isn't forgotten on restart. Your own sync uses the same factor but doesn't move it. Why: 50 of 50 requests at the default pace came back fine, so the default was likely too cautious, but we don't know Bandcamp's real limit; this finds it per user instead of guessing. **Fast is the default, and Gentle is gone (2026-10-28):** showing results quickly matters more than extra caution we have no evidence for. The defaults are now the Fast preset, 1–2 s and 30,000 requests a day (was 1.5–3 s and 10,000). Normal stays as the slower choice, at 1.5–3 s and 15,000. If users report many blocks, lower the defaults again.
- **Lock:** `chrome.storage.local` holds the lock as `{owner, heartbeatAt}`, with the heartbeat refreshed before every request. A lock older than 45 s is treated as left behind by a dead worker. Only one worker instance exists at a time, so in practice this only matters after a kill: the queue resumes on the first 1-minute alarm after those 45 s, usually within 1–2 minutes.
- **Supporter paging:** the first page (up to 80 thumbs and 6 reviews) comes free with the release page. After that, **thumbs come first, then reviews**, 100 per request (fewer for the last one), until the cap. Thumbs are the most recent buyers, which is what the cap means ("500 most recent").
- **Supporters are owners.** Each supporter gets an `ownership` row for the release (`source = collection`, `addedAt` from the token, as in §3.7). That way a fan counts as an owner even when the release falls outside their newest 2,000 items. An existing row is never overwritten.
- **Fan status** after a scan:
  - `quick` (added 2026-10-21, §12): only the quick read is in and the full scan is still queued. Also bought counts them, crate mates don't.
  - `done`: the whole collection was read, so `collectionSize` is known.
  - `partial`: only the newest N items were read, because the cap was hit or the API errored after the first page.
  - `private`: `collection_items` errored on the first page (§2).
  - `error`: the job was dropped.

  `done`, `partial` and `private` set `collectionFetchedAt`, so those fans aren't fetched again for 30 days. `error` doesn't set it, so the fan is queued again the next time a release lists them.
- **Freshness windows are constants, not settings:** 30 days for fans, 7 days for a release's supporter list. If the list is fresh, opening the page sends no request for the release itself. It only re-prioritises the release's fans.
- **Release pages are fetched logged out** (`credentials: 'omit'`), to match the fixtures. Nothing on them is personal.
- **Your own sync and the scanner take turns.** The scanner waits while your own sync runs, so only one request is in flight. Your own sync still doesn't count against the budget (§4).
- **Progress:** progress is sent only for **releases open in a tab** (the last 20 opened, kept in `chrome.storage.session`) and only when a fan finishes, to keep the per-fan cost low. It goes to Bandcamp tabs with `chrome.tabs.query({url})` (host permission, no `tabs` permission needed) and `chrome.tabs.sendMessage`.
  - `scanned` counts every supporter with a final status, including `private` and `error`.
  - Known buyers count too (2026-10-31): fans not on the supporter list whose scan has ended and who own the release, found through other scans (same fans as Also bought, `releaseBuyers`), are added to both `scanned` and `total`, without duplicates. Why: the list holds only the newest buyers, so a row could say "26 supporters" under "11 / 80 scanned". Off-list fans still queued stay out: they may wait at seed priority, and the bar has to be able to finish when the listed fans are done.
  - The event carries one field more than the spec, `listed`, so the UI can tell "not fetched yet" (0 / 0, false) from "no supporters" (0 / 0, true).
- **Known limitation:** a re-scan after 30 days adds new items but doesn't remove items a fan no longer has. That's rare, and harmless for scoring at this scale.

### Add release to queue (Phase 5.7)

A "scan supporters" button on each Also bought row sends `queueRelease { itemKey, url }`, which queues that release's job at BACKGROUND priority (never above the page you're reading). Fresh supporter lists (7 days) are reported as "scanned recently" and not re-queued; a job already waiting isn't duplicated, though it moves up from SEED. We chose the row button over a popup URL field because the rows are where you already spot interesting releases, and they carry the item key and url, so there is no URL parsing to get wrong. *Crate mates who own this* rows list fans, not releases, so they get no button.

## 6. Also bought (Phase 4)

Code: `src/scoring/alsoBought.ts` (pure), `src/db/repo/alsoBought.ts` (gathering), `src/background/recommend/` (running it). Decided 2026-10-20.

### Match index: the risk-checkpoint fallback, applied up front

- **Measured first.** Reading the raw `ownership` rows of 300 supporters (300k rows) took about 1 s in fake-indexeddb, so plain index reads miss the 200 ms target before scoring even starts. The ROADMAP's P4 fallback ("precompute per-item owner counts") is therefore built in from the start, as schema v3:
  - `fanMatches`: each fan's distinct collection matchKeys, one record per fan.
  - `matchOwners`: per matchKey, how many fans' collections hold it.
- **They're derived from `ownership` and never drift from it.** Every ownership write (`putOwnership`, `removeOwnershipExcept`, `addSupporterOwnership`) recomputes the touched fans' lists from their rows in the same transaction (`refreshFanMatches`). Wishlists don't count as owning. The v3 upgrade builds both tables from existing rows.
- **Each record also holds `trackIds`** (the album tracks the fan owns) **and `partialIds`** (the matchIds they hold only through tracks). Only crate mate overlap reads them (§7). Both are empty for a fan who buys whole albums. Added in schema v6, whose upgrade rebuilds every record from `ownership`.
- **Keys are stored as numbers.** `keyToNumber` maps albums to `+id` and tracks to `−id`, and each fan's list is a sorted `Float64Array`. Strings cost about twice as much to read and count, and made garbage collection the bottleneck in a big heap.
- **The roadmap's "move scoring to an offscreen document" wasn't needed.** A re-score takes 39 ms at 300k rows and 88 ms at the caps (500 supporters × 2,000 items, about 1M rows), both in fake-indexeddb, which is slower than Chrome's IndexedDB. Check: `pnpm perf` (`tests/perf/`, kept out of `pnpm test` because it seeds for ~10 s). An earlier string-based version measured ~580 ms at full size; part of that gap was the test seeding everything in one huge transaction, which fake-indexeddb handles badly.

### Scoring

- **Supporters N** = fans other than you who own the release's matchKey (from the `ownership.matchKey` index, so track buyers and album buyers alike) **and whose collection has been read** (`done` or `partial`). Queued, private and failed fans don't count, so "7 of 32 supporters" always means 7 of the 32 we can actually see.
- **co(i)** = how many of those N lists contain i. Each list holds distinct matchKeys, so a fan with two tracks of an album counts once. Drop co < 2.
- **Lift uses the local base rate:** `lift = (co / N) / (owners(i) / population)`, where `owners(i)` comes from `matchOwners` and `population` is every fan with a known collection apart from you. This overrides the spec's unstated base rate. Bandcamp-wide counts would need the total number of Bandcamp fans, which we don't know, and they'd rank your own scene's staples high everywhere. Local lift answers "more common among this release's buyers than among everyone you've dug through". With only one release scanned, lift is about 1 for everything and the ranking falls back to plain co.
- **Lift is capped at 10**, then `score = co × ln(1 + lift) × (1 + 0.5 × crateMateShare(i))`. The crate mate boost is below.
- **Pruning:** candidates come in falling co order, and owner counts are fetched 200 at a time. No candidate can score more than `co × ln(1 + 10) × (1 + 0.5 × s)`, where s is the highest crate mate share among the candidates, so the loop stops as soon as the next candidate's ceiling is below the 30th-best score. Inside a chunk, candidates whose own ceiling can't reach the list are skipped. In the perf data that means 200 lookups out of ~46k candidates.

### Crate mate boost (Phase 5)

Code: `crateMateBoosts` in `src/scoring/alsoBought.ts`; `gatherAlsoBought` reads the crate mate scores. Decided 2026-10-20.

- **Only crate mates among the release's scanned supporters count.** They are the fans whose collections the co-counts come from, so the boost says "some of these co-owners are people whose taste matches yours". A crate mate who doesn't own the release says nothing about its buyers, and leaving them out means no extra reads.
- **crateMateShare(i) = min(1, Σ score(F) / score(best crate mate))** over the crate mate supporters F who own i, using every crate mate on the stored leaderboard (top 200, §7). Your closest crate mate alone, or two crate mates half as close, gives the full share. Dividing by your best crate mate's score keeps the boost independent of how big crate mate scores happen to be, which varies with collection sizes.
- **Multiplier `1 + 0.5 × crateMateShare`, so at most ×1.5** (`CRATE_MATE_BOOST_MAX`). It's multiplicative so it scales with the evidence: at the same lift, a release your crate mates own can pass one with up to 1.5 times as many co-owners, never more. Bounded, so crate mates re-order close calls without drowning out what the supporters as a whole bought. Crate mates flagged as label clusters already carry ×0.3 in their score, so they barely move anything.
- **The reason line says so:** "7 supporters have this so far, 2 are your crate mates". It leaves out how many supporters were scanned: "so far" says the count can grow without the technical detail.
- **Cost:** none measurable. `pnpm perf` now also seeds a full 200-crate-mate leaderboard with 50 crate mates among the 300 supporters, and medians were the same with and without it (~70 ms on a loaded machine).
- **Filters:** the release itself, hidden releases, releases you own or wishlisted *as a whole*, and albums you own a track of (§3.8). Wishlisting a single track keeps the album in.
- **Display:** rows point at the album. If no scanned collection holds the album itself, only tracks of it, the row shows one of those tracks (title and link) until the album turns up. The reason line doesn't say whether owners bought the album or only tracks.
- **`weights.ts`** implements `w(i)` and `supporters(i)` (album count, then track count, then owners we've seen). Phase 4 only uses `supporters(i)`, to order fallback picks. `w(i)` is for crate mates and For you.

### Whose buys count (changed 2026-10-25)

Before, every page scored the whole matchKey (§3.8), so every track of an album showed the album's list. On a compilation that list is what fans of all its other artists bought. Now `releaseBuyers` (pure, `scoring/releaseBuyers.ts`) picks the owners, each with a vote weight:

| Page | Album / EP | Compilation (§17) |
| --- | --- | --- |
| Album page | Album buyers + buyers of any of its tracks | Buyers of the whole comp only |
| Track page | Album buyers + this track's buyers | This track's buyers ×1, comp buyers ×`COMP_BUYER_WEIGHT` (0.5) |

- "This track's buyers" are collection rows for the track plus the track page's listed supporters. Buyers of the album's other tracks drop out of a track page.
- On a single-artist album a single-track buyer is the same audience as an album buyer, so the album page keeps them. A comp's track buyers came for one artist, so the comp page leaves them out.
- At full weight a comp's buyers, the same fans on every track, would usually outnumber the track's own and the lists would converge again. A fan who bought both counts fully.
- The weight multiplies `voteWeight`, and N in the lift is Σ weights, so a half-weight fan is half a trial as well as half a vote. Weights are ≤ 1, so votes stay ≤ co and pruning stays valid. Crate mate boosts and the warm-up's "supporters read" count fans unweighted.
- The release's matchKey is still what's excluded from the picks, so a track page never recommends its own album.

### Small-release fallback

- A release counts as **small when fewer than 8 fans other than you are known to own it**, scanned or not.
- Small releases get **same-artist and same-label picks** from the local `items` table: other releases with the same selling account or the same `labelId`. Same seller and same artist name means "More from this artist". Same seller with a different artist name means the account is a label's, so "From the same label". A matching `labelId` reads "Also on <label>".
- Album tracks are skipped. Order: same artist first, then by `supporters(i)`, highest first. These picks come after the co-owned ones, up to 30 rows in all.

### Re-scoring and the message bus

- The worker scores on request (`getAlsoBought`, when the sidebar opens or after a hide). It also re-scores **watched releases** (the ones open in tabs, §5) after every 5 supporters scanned, after the last supporter, and when the supporter list is complete. Results go out as the `alsoBought` event. The 5-fan counter lives in memory, so a killed worker restarts it from zero.
- `releaseOpened` now carries the page's parsed `ReleasePageItem`, and the worker saves it. Scoring and the fallback therefore know the release before its scan job runs, even while the queue is paused.
- **Hidden releases** live in the `hidden` store, keyed by matchKey (so hiding an album hides its tracks too). Every scorer must respect them. There's no "unhide" yet; that's Phase 7 (popup). *Changed 2026-10-24: artists and labels can be hidden too, and the popup can unhide (§22).*
- **Parser broken:** the scanner records the last `ParserError` as `parserError` in its state. It's cleared when a job of the same kind succeeds, so one odd page doesn't look like a broken parser for good. The sidebar shows "Parser broken" in place of an empty list, or as a notice above existing rows. The popup shows it too.

### Gaps

- **Wishlist from the sidebar isn't wired up.** Adding to a wishlist needs a logged-in Bandcamp API call that we haven't captured, so rows have no wishlist button; *Open in a new tab* gets you to Bandcamp's own. To add one, capture the request Bandcamp sends when you click Wishlist on a release page (logged in) and save it as a fixture.
- **Track-only buyers of an album aren't listed as its supporters** (§3.8). This is still unmeasured: watch for albums whose supporter list looks small next to their `also_collected_count`.
- **Preview plays in our own `<audio>`, not Bandcamp's EmbeddedPlayer** (changed 2026-10-21). The embed is a cross-origin iframe, so we couldn't start it from the Preview click or give it a seek bar. Now the worker fetches the release page (`getPreview`) and reads each track's `file["mp3-128"]` from `data-tralbum`. Those URLs are signed and expire, so they're fetched when a preview opens, never stored. Playback starts at `featured_track_id` and moves on to the next track at the end. Media loads aren't subject to CORS, so the content script plays the bcbits.com stream directly.

## 7. Crate mates (Phase 5)

Code: `src/scoring/crateMates.ts` (pure), `src/db/repo/crateMates.ts` (gathering and storing), `src/background/recommend/crateMates.ts` (running it). Decided 2026-10-20.

- **Score** = Σ w(i) over the shared releases / √(|M|·|F|), where |M| and |F| are the two `fanMatches` lists (collection only, tracks folded into albums). w(i) uses the album's `supporterCount` first, then a track's, then `matchOwners`. Raw overlap and Jaccard are stored alongside.
- **Shared releases** (`sharedReleases`, changed 2026-10-21): a matchKey you both hold counts when you share the exact item, or one of you owns the album and the other a track of it. **Two different tracks of one album don't count.** Before this, they did (§3.8), and a fan who mostly buys single tracks showed far more in common than Bandcamp's own "in common": for one real fan, 60 against Bandcamp's 21, where 39 of the 60 were albums each side only had different tracks of. With this rule the same pair comes out at 30. The rest of the difference is deliberate: we still count an album against one of its tracks (10 here), and count two shared tracks of one album once. It's computed from the `trackIds` and `partialIds` lists (§6): drop the matchKeys that are in both partial lists unless the two `trackIds` lists share a track of that album.
- **|F| is what we've scanned**, so a collection capped at 2,000 items is compared on its newest 2,000. The size filter uses `collectionSize` once known (a `done` scan), otherwise `scannedItems`. A capped fan's real size is unknown, so `maxCollectionSize` can't catch them yet.
- **Candidates** are fans whose collection was read (`done` or `partial`), as for Also bought. Private, queued and failed fans are left out.
- **Label** = `labelId ?? bandId` (§3.3). A label's catalog is its distinct matchKeys in the local `items` table. Only the labels of releases you own are looked up, since only they can carry an overlap.
- **Label-cluster flag:** more than 50% of the overlap from one label, the fan owns more than 60% of that label's local catalog, **and at least 3 shared releases come from that label**. The last rule is new: local catalogs start tiny (often one release), so one shared release would otherwise flag everyone who owns it. Flagged crate mates are multiplied by 0.3 when `labelClusterDownweight` is on, and the flag is stored either way.
- **The leaderboard keeps the top 200**, replaced in full on each recompute. Fans are scored 500 at a time with a yield between pages.
- **Recompute triggers:** after each finished sync of your own collection, once 15 more fans are read than at the last recompute (was 25 until 2026-10-28), when the Crate mates tab opens and fans were read since, and on install or update. The fans-read count at the last recompute is kept in `chrome.storage.local` (changed 2026-10-29: it was an in-memory counter, and the MV3 worker dies when idle, so during slow scanning it rarely reached 15 and the tab showed a list hours older than its fans count). Only one runs at a time; a trigger during a run queues one more pass.
- **"Crate mates who own this" (sidebar tab):** leaderboard crate mates with the release in their collection, by its matchKey, so track buyers count and wishlists don't. Any owner counts, not just listed supporters, since owners come from every scanned collection. Rows show the crate mate's leaderboard rank, name, overlap and profile link. The list is pushed with each Also-bought re-score (`releaseCrateMates` event), so it doesn't refresh on its own after a crate mates recompute until the next scan step or page load.

### Profile tabs (Phase 5.5)

Code: `src/content/profile/`. Decided 2026-10-20, tried against `me-fan-page.html` with Bandcamp's real CSS and a stand-in for its tab script. Not yet tried on the live page with Bandcamp's own JS.

- **Your own page** is told apart by `fan_data.is_own_page` in `#pagedata` (`isOwnFanPage`), not by comparing usernames.
- **The tab handle is light DOM**, an `<li class="crater-tab"><a class="tab-title" href="#crate-mates">` appended to Bandcamp's `#grid-tabs`, so Bandcamp's CSS styles it exactly like its own tabs. It's the one exception to "injected UI lives in a shadow root". It has no `data-tab`, and clicks on it stop at the `<li>` (`stopImmediatePropagation`) so Bandcamp's tab switcher never sees them. The tab content renders in a shadow root in a slot right after `.grid-tabs-anchor`, kept at the tab list's width by a ResizeObserver because Bandcamp's grid width steps with the viewport.
- **The hash is the state.** The link sets `#crate-mates` itself (a history entry, so Back works), `hashchange` opens and closes our tabs, and a direct `#crate-mates` link opens it on load. Clicking one of Bandcamp's tabs drops the hash with `replaceState` and hands the `active` class back to the tab that had it, in the capture phase, before Bandcamp's handler runs.
- **While ours is open**, a class on `#grids` hides every `.grid` and `.owner-controls` through one injected `<style>`. Bandcamp's selectors live in `bandcamp/fanPageDom.ts`.
- **% match is Jaccard**, shown as a percentage. The roadmap's columns (overlap, % match, score) and sorts (overlap, Jaccard, score) are the same three numbers. Sorting is one-way, best first; ties keep leaderboard order.
- **A new tab** (For you) is one entry in `PROFILE_TABS` in `ProfileApp.tsx`: an id, a lowercase label and a view component. Views mount when their tab opens, so each opening fetches fresh data.
- **Two tabs, with sub-tabs (changed 2026-10-24).** Four tabs of ours (crate mates, for you, mates' latest, new from follows) wrapped Bandcamp's bar onto two lines and ran into its "not seeing a purchase?" link. Now Bandcamp's bar holds *crate mates* and *for you*; For you holds three sub-tabs, **Picks**, **Crate mates' latest** and **New from follows** (`ForYouHub.tsx`). The sub-tabs are our own small `Tabs` (text size sm, accent underline, left-aligned), so they read as a level below Bandcamp's big centred titles, and Picks' All time / Fresh / Deep cuts stays a boxed `Segmented` switch below them.
- **Each sub-tab keeps its hash:** `#for-you`, `#latest`, `#follows`. A tab spec lists the extra hashes it owns (`routes`); the store tracks the open route and marks the tab that owns it. Old links and the follows notification still land on the right view, and Back steps through sub-tabs.
- **Gap:** the leaderboard doesn't update live while open. Reopen the tab or reload after a recompute.
- **Latest buys (added 2026-10-22):** each crate mate row shows their 6 newest purchases as covers, from `fanMatches.matchTimes` (releases with no known time are skipped, as are ones with no item record). They ride along in `getCrateMates` rather than a separate message: about 400 rows × 6 items, read in one `bulkGet`. Clicking a cover opens one shared player pinned to the bottom of the board (`NowPlaying`); a second click on the same cover, or its stop button, closes it.

### For you (Phase 6)

Code: `src/scoring/forYou.ts` (pure), `src/db/repo/forYou.ts` (gathering), `src/background/recommend/forYou.ts` (running it), `src/content/profile/forYou/` (the `#for-you` tab). Decided 2026-10-20.

- **Crate mates** are the top `settings.topCrateMatesK` (default 30) of the stored leaderboard, ties on fanId. Their `fanMatches` lists are what's counted, so tracks fold into albums and wishlists don't count, as everywhere else. Label-cluster crate mates carry their ×0.3 in their score.
- **Filters** are `scoring/exclusions.ts`, as for Also bought: hidden releases, releases you own or wishlisted as a whole, and albums you own a track of (§3.8).
- **w(i)** uses the shown record's `supporterCount` (the album's, or a track's when only tracks of the album have turned up), else `matchOwners`. It doesn't look for a track's count when the album record exists without one.
- **Pruning:** w(i) ≤ 1, so a candidate's summed crate mate score is its ceiling. Candidates come in falling crate-mate-score order, 200 at a time, and the loop stops once the next ceiling is below the 60th-best score. 60 (twice the 30 shown) leaves room for the diversity rule to move an artist's extras down without leaving rows empty. Candidates with no item record are dropped before ranking, since they can't be shown.
- **Rows** show their place in the list, cover, artist · label, "owned by N of your top crate mates", and the same preview / wishlist / open / hide buttons as Also bought (one shared `ReleaseRow` in `src/ui/`). Wishlist still opens the release page (§6, Gaps). Hide drops the row at once and re-fetches, so the next pick moves up.
- **Empty states** reuse the crate mates basis (`no-viewer`, `unsynced`), then "no crate mates yet" (no leaderboard) and "nothing new from your crate mates", both linking to `#crate-mates`. A scanner `ParserError` shows as a notice above the rows, or in place of them when there are none.
- **Scored on request**, each time the tab opens. Nothing pushes updates while it's open, as with the Crate mates tab.

### Crate mate badge on other fans' profiles (Phase 5.6)

Code: `src/content/fan/`, `getCrateMateStanding` in `background/recommend/crateMateStanding.ts`. Decided 2026-10-20, checked against the fixtures' markup; not yet tried on the live page.

- **Mount:** page kind `fan` (anyone but you). The badge goes at the end of the header's `.name` block, under the `<h1>` (`FAN_PAGE_DOM.name`, which skips the hidden edit-mode copy of the bio), in a shadow root.
- **Whose page:** `parseViewedFanId` reads `fan_data.fan_id` from the `#pagedata` element only, so the tab doesn't parse the whole collection.
- **Lookup:** `getCrateMateStanding { fanId }` finds the fan in the stored board and answers `{ rank, overlap, matchPct }`, or null. The tab never receives the board. `rank` is the position in `getCrateMates`, as everywhere else; `matchPct` is Jaccard × 100.
- **Text:** "your #4 crate mate · 37 in common". The tooltip (a real `<button>` is the trigger, so it takes keyboard focus) gives the rank, the overlap and the % match with its definition.
- **Not on the board shows nothing**, rather than "not in your crate mates yet". The board holds only the top 200, so "not a crate mate" would be wrong for a fan we've scanned who ranks 201st, and a note on every stranger's page is noise. Loading and errors also render nothing (no layout jump); errors are `console.warn`ed.
- **Gap:** the badge looks up once on load. A crate mates recompute while the page is open isn't pushed to it.

## 8. Following tags (planned)

Planned 2026-10-20; data source verified the same day. Roadmap: *Following tags*.

You create your own tags and assign them to the fans, artists and labels you follow. Then you filter your followings by tag. **Tags apply only to followings** (and, since §14, to releases in your wishlist), not to crate mates, supporters or other fans you don't follow.

### Data source (verified 2026-10-20)

- §1 missed it: a fan page's `#pagedata` has `following_bands_data` and `following_fans_data` (`item_count`, `last_token`, `batch_size: 20`), with the first rows in `item_cache.following_bands` / `item_cache.following_fans`. `following_genres_data` exists too; genres are out of scope.
- **The rest pages like the collection:** `POST https://bandcamp.com/api/fancollection/1/following_bands` (or `following_fans`) with `{"fan_id", "older_than_token", "count"}`. The response is `{followeers: [...], more_available, last_token}` (Bandcamp's spelling). Fixtures: `following_bands-p1.json`, `-p2.json`, `following_fans.json`, `following_fans-unknown-fan.json`.
- **Works logged out**, newest follow first. `"9999999999:"` as the token starts from the top. `count: 500` returns 500 rows in one request, so a full list is `ceil(n / 500)` requests.
- **Two lists, two kinds.** Band rows: `band_id`, `name`, `url_hints.subdomain` / `custom_domain`, `image_id` (avatar), `art_id`, `location`, `date_followed`, `token`. Fan rows: `fan_id`, `name`, `trackpipe_url` (the profile URL; username is its path), `image_id`, `location`, `date_followed`, `token`.
- **Nothing marks a label.** Artists and labels are both band accounts, which is how Bandcamp's own sub-tab ("artists & labels") lists them. No `isLabel`.
- `is_following` is from the viewer's side (false logged out). Ignore it.
- An unknown `fan_id` gives `{followeers: [], more_available: false, last_token: null}`, not an error.

### Bandcamp's following tab (captured 2026-10-20)

Fixture: `me-following-tab.html`, the rendered `#following-grid` with artists & labels open after "view all".

- **Routes are paths, not hashes:** `/<username>/following/artists_and_labels` and `/<username>/following/fans`. Bandcamp switches them with `history.pushState`, which a content script can't hook, so we watch the DOM instead.
- **Active state:** `#following-grid` gets `active` when the following tab is open. In `ol#following-tabs`, the open sub-tab's `li[data-tab="following-bands" | "following-fans"]` has `active`, and so does its container (`#following-bands-container` / `#following-fans-container`, `class="grid active"`). A `MutationObserver` on those class attributes tells us which list to show.
- **What we hide:** in each container, `ol.followeer-grid` and `.expand-container` (the "view all N" button and spinner).
- **A card** is `li.followeer` with `.fan-image` (avatar link + `img`), `.fan-username` (link and name) and `.fan-location`, then `button.follow-unfollow` with `data-band-id` + `data-band-name` (bands) or `data-fan-id` + `data-view="following_fans"` (fans). Our cards copy this layout, so they look native.

### Follow and unfollow: Bandcamp's own handler

We never send follow or unfollow requests. Bandcamp's fan-page script (read 2026-10-20) binds one delegated handler, `$("#fan-container").on("click", ".followeer .follow-unfollow", …)`. It reads the button's data attributes and does the request, crumb and retry itself:

- **Bands:** `button#follow-unfollow-band_<band_id>[data-band-id][data-band-name]`. Its handler finds the button **by that id**, then toggles `following` on it.
- **Fans:** `button#follow-unfollow_<fan_id>[data-fan-id][data-view="following_fans"]`. Its handler toggles `following` on the clicked button.
- So any card in this markup, anywhere inside `#fan-container`, gets a working follow button. Clicks go through Bandcamp's code exactly as on its own cards, including the mailing-list prompt after a band follow.
- **Duplicate ids:** Bandcamp's hidden list may hold a button with the same id, and `$("#…")` returns the first in document order. So our list goes **before** Bandcamp's `ol.followeer-grid`.
- **Keeping the DB in step:** a `MutationObserver` on our buttons' `class` sees `following` come and go. An unfollow marks the row `unfollowed` (dimmed, tags kept) so a quick re-follow loses nothing. The next full sync deletes rows still unfollowed, with their tags. A follow clears the mark.
- For the record, the endpoints behind it: `POST /fan_follow_band_cb` (`fan_id`, `band_id`, `action`, `crumb`) and `POST /fan_follow_cb` (`fan_id`, `follow_id`, `action`, `crumb`). An expired crumb returns `{error: "invalid_crumb", crumb}` and the script retries.

### Sync

- Followings are part of your own sync (§4): paced and off the budget. Since 2026-10-23 they run between the wishlist and the collection, so the tab fills in within seconds of a first sync, and each page is saved as it arrives (`putFollowing`, which keeps tags). Only the final `replaceFollowing` deletes, so a list that fails part-way can add followings but never delete any.
- **Always full.** With 500-row batches, even 600 follows is two requests per list, so there's no incremental mode. A full sync is the only way to notice an unfollow made elsewhere, and it deletes those rows.

### Data

- **Kinds:** `'fan' | 'band'`.
- **Schema v5 (additive; `itemKey` and `matchKey` untouched; v4 went to `fans.lastSeenAt`, §9):**
  ```
  following: '[kind+id], kind, *tagIds'
  tags:      '++id, &nameKey'
  ```
  `nameKey` = the trimmed, lowercased name.
  - Tags are stored on the following row. A join table isn't needed, because only followings can be tagged.
  - A row unfollowed on the tab keeps its tags until the next full sync deletes it (see *Follow and unfollow*).
- **Sync must not wipe tags:** `putFollowing` merges by key and keeps the existing `tagIds`. This needs its own test.
- **Deleting a tag:** one transaction deletes the `tags` row and removes its id from every following row, found through the `tagIds` index.
- **Bulk assign:** one message takes many keys and a tag id, and adds or removes it in one transaction.

### Filter

- Default mode is `all` (AND); `any` (OR) is an option.
- OR uses `where('tagIds').anyOf(...)`. AND queries by the first tag, then filters in memory with a pure `matchesTags(assigned, selected, mode)`.
- Kind isn't a filter of ours: Bandcamp's own sub-tabs (artists & labels / fans) pick it.
- A name search sits next to the tag filter.
- Follow lists are small (hundreds of rows), so filtering in memory is fine.

### Planned layout

- `bandcamp/following.ts` (`parseFollowingPage` + zod schema + fixture tests), the pagedata part in the fan page parser, and a request builder in `bandcamp/requests.ts`
- `bandcamp/followCard.ts`: builds a card in Bandcamp's markup from a following row. Like `FAN_PAGE_DOM`, it's the one place that knows that HTML, tested against `me-following-tab.html`.
- `db/repo/tags.ts` and `db/repo/following.ts`
- messages, named like the rest of `shared/messages.ts`: `listTags`, `createTag`, `renameTag`, `deleteTag`, `assignTag` (many keys, add or remove), `listFollowing`, `getFollowTags { kind, id }`, `exportTags`, `importTags`, and `getCrateMateStandings { fanIds }`, a batched `getCrateMateStanding`, so a list of fans is one message
- hooks `useFollowing(tagIds, mode)`, `useTags()`, `useFollowTags(kind, id)`

### UI: Bandcamp's following tab, modified

We change Bandcamp's own **following** tab on your profile instead of adding a tab of ours, and reuse its cards.

- **Why not decorate only Bandcamp's loaded rows:** it renders them 20 at a time, behind "view all N" and scrolling. A tag filter over whatever happens to be loaded would be wrong, and making Bandcamp load all of it is slow and fragile.
- **So we render the whole list in Bandcamp's markup:** inside `#following-grid`, Bandcamp's sub-tab bar (artists & labels / fans / genres) stays. In the artists & labels and fans containers, we hide Bandcamp's `ol.followeer-grid` and `.expand-container` (so its paging never runs), and insert our own `ol.followeer-grid` before them. It holds every following row from the DB as a light-DOM `li.followeer` built by `followCard.ts`. Bandcamp's CSS styles the cards, and its handler runs their follow buttons. The genres sub-tab is untouched. Selectors live in `FAN_PAGE_DOM`.
- **Card details:** the avatar is `https://f4.bcbits.com/img/<image_id, 10 digits>_41.jpg` for fans and bands alike. The link is `trackpipe_url` for fans and the band's subdomain or custom domain for bands.
- **Our additions sit in shadow roots:** the filter bar sits above our list. Each card gets one small host element holding its checkbox, tag chips, "+ tag" and, on fan cards, crate mate rank ("#4 crate mate"). The card itself must stay light DOM, because events from inside a shadow root don't match Bandcamp's `.followeer .follow-unfollow` selector. That's the one exception to "all injected UI in a shadow root". One React root renders into every card's host through portals, not one root per card.
- **Filtering** ~~hides non-matching cards (`hidden`)~~ (changed 2026-10-23) builds cards for the first 120 rows passing the filter, with "Show more" below the list (in its own shadow root) for the next 120. 600 follows meant 1,200 shadow roots up front: 2.1 s → 0.4 s in jsdom. Cards that stay are reused, so focus and button state survive; a card the filter drops is removed and rebuilt from the DB later. The one loss: an unfollow click whose request is still running when you filter its card away isn't marked until the next sync.
- **During a sync** the list reloads when `followed` changes and says "Still syncing your follows" while the sync is on that step (as the wishlist, §14).
- **Bulk tagging:** each card has a checkbox. With any checked, a bar shows "N selected · Tag… · Clear".
- **Tag colours** come from a fixed set of design tokens (`--dh-tag-1` … `--dh-tag-8`), picked by tag id, so a rename keeps the colour. No colour picker.
- New `src/ui/` components: `Chip`, `Checkbox`, and `TagPicker` (a wrapped Radix Popover with a combobox, where Enter creates a tag). Its portal goes to the shadow-root container.
- States:
  - loading, including "syncing follows"
  - empty: you follow no one
  - empty: no tags yet
  - empty: the filter matches nothing, with "Clear filters"
  - error (reuse `parserError`)
  - results

### Following tab as built (roadmap step 10)

Code: `src/content/following/`, mounted by `mountProfile`. Built 2026-10-21 and tested on the fixtures (jsdom); not yet tried on the live page with Bandcamp's own JS.

- **Lazy takeover:** a sub-tab's list is taken over the first time it opens, then stays taken over and mounted, so filters and selection survive switching sub-tabs. A `MutationObserver` watches only `#following-grid` and the sub-tab `<li>`s, not the cards.
- **Bandcamp's list comes back** while ours can't stand in for it: the worker is unreachable, or our list is empty and the sync hasn't finished, has failed, or hasn't seen you log in. It's hidden by a class on the sub-tab container and one injected `<style>`, not inline styles.
- **Cards are reused** across refetches and only moved when the order changes, so focus inside a card and Bandcamp's button state survive a tag change. A row unfollowed since the last sync is built without `following` on its button, so it offers "Follow".
- **Unfollow tracking** compares each button's class before its first change in a mutation batch with its class now, so a burst of class edits reports once.
- **Filtering** is in memory over the whole list (`followingFilter.ts`), since `listFollowing` with no tags answers every row. **Bulk actions** act on the checked cards still shown; hidden ones stay checked. The bulk bar floats at the bottom of the window, so it's in reach on a long list.
- **The tag editor** (`TagEditor` and `followTagHandlers` in `src/content/shared/`, renamed from `FollowTagEditor` when §14 shared it) is presentational: callers pass your tags, the account's tag ids and `useTags()`'s mutations. Step 11 reuses it on fan, release and band pages.
- **Parser errors** show as the scanner notices (`NoticeStack`) above the open list. A failed sync shows its message in the empty state.
- DOM tests run under jsdom (`// @vitest-environment jsdom`), on the fan page with its following grid swapped for the rendered one (`tests/followingTabDom.ts`).

### Tags on the account's own page

- On a fan page you follow, next to the crate mate badge, and on an artist's or label's pages (release pages via the publisher's `band_id`, §3.3, and the band's home page), show your tags as chips with "+ tag".
- Shown only when you follow the account, since only followings can be tagged. Not following shows nothing.

### Backup

- **Tags are hand-made and a re-sync can't rebuild them**, so a JSON export/import of tags is part of the feature. The file holds tag names and `[kind, id]` assignments. Import merges by `nameKey` and skips assignments to accounts you no longer follow.

## 9. Popup controls and storage (Phase 7)

Code: `src/popup/`, `src/shared/settings.ts`, `src/background/maintenance.ts`, `scripts/estimate-storage.ts`. Decided 2026-10-20.

### Popup v1

- **Two tabs:** *Status* (your sync, queue progress, today's budget, pause/resume) and *Settings* (pace, caps, crate mates thresholds, Clear all data).
- **Queue progress** is `fansScanned / (fansScanned + fans queued)`, where `fansScanned` counts every fan with a final status. A bar over "everything ever queued" is honest about the backlog and never jumps backwards when a release adds supporters.
- **Pause is yours and sticks:** `paused` in the scanner state (`chrome.storage.local`), so it survives a restart. It wins over back-off and budget in `pauseFor`, since it's the reason that won't clear on its own. The request in flight still finishes. Your own sync isn't paused by it: it's a handful of requests and off the budget (§4).
- **Settings are validated** against `SETTING_LIMITS`, plus `paceMin ≤ paceMax` and `minCollection ≤ maxCollection`. The floor on pace (1 s) and the batch ceiling (500, the largest page seen in §1) aren't negotiable from the UI. `loadSettings` sanitizes what's stored: a missing, mistyped or out-of-range value falls back to its default, and if that leaves a pair out of order, everything resets. Reset removes the stored key. The popup writes `chrome.storage` directly; the worker re-reads settings before every request, so no message is needed.
- **Clear all data** empties every IndexedDB table and the watched-release list, and clears the scanner's errors. It keeps settings, your pause and today's budget: those are about how politely to scan, not what was scanned. `me` goes too, so your collection re-syncs (full) on the next Bandcamp page.
- **Dialog:** `ConfirmDialog` wraps Radix Dialog and portals into the `PortalContainerProvider` container. The popup provides `#root`, so the dialog stays inside `.dh-root`'s base styles; in a shadow root it would be the shadow container.

### Storage estimate

`pnpm storage:estimate` sizes records from real fixtures through the real mappers, serialized as V8 structured clones (Chrome's IndexedDB value format), and adds one entry per index (index key + primary key + ~16 B LevelDB overhead). Compression is ignored, so it leans high.

| Scenario (5k own items, 20k fans) | Ownership rows | Items | Total |
| --- | --- | --- | --- |
| Every fan at the 2,000-item cap | 40M | 4M | **~15 GB** |
| 500 items per fan on average | 10M | 1.5M | **~4 GB** |

- **`ownership` is ~89% of it**, at ~360 B per row: the value (~100 B) plus four entries (primary key and three indexes), each carrying the `[fanId+itemKey]` primary key.
- **Cheapest win, not done yet:** the `ownership.itemKey` index is never queried outside tests, and `ownership.fanId` duplicates the primary key's prefix (`where('[fanId+itemKey]').between([id, Dexie.minKey], [id, Dexie.maxKey])`). Dropping both cuts about 40% of ownership. That's a schema version of its own, measured with `pnpm perf` first.
- No quota problem at these sizes: Chrome lets an origin use a large share of free disk. If the Web Store build ever needs a guarantee, that's the `unlimitedStorage` permission (Phase 8).
- A real-browser check is still worth doing in dogfooding: `navigator.storage.estimate()` from the worker console after a few weeks of use.

### Forgetting long-unseen fans

- **Schema v4** adds `fans.lastSeenAt` (indexed). It's set whenever a supporter list lists the fan (`upsertSupporterFans`) and whenever a scan of theirs ends (`finishFanScan`). The upgrade fills it from `collectionFetchedAt`, or the upgrade time for fans never scanned.
- **Daily cleanup** (`maintenance` alarm, every 24 h): fans with `lastSeenAt` over 180 days ago (`FAN_FORGET_MS`) are deleted with their `ownership` rows, their match-index entries (`refreshFanMatches` drops the list and lowers `matchOwners`), their crate mate rows and any queued fan job. You are never forgotten, even if you were once listed as a supporter. It runs 100 fans per transaction, and recomputes crate mates when anything went.
- **Left alone:** `items` (cheap, and still describe releases others own) and old `releaseSupporters` lists that still name forgotten fans. Such a list is over 7 days old, so opening its release re-fetches and replaces it; until then its progress counts those fans as not scanned.


## 10. Full database backup

Code: `src/db/backup.ts`, `src/shared/backupFile.ts`, `src/shared/backupStaging.ts`, `src/background/backupHandlers.ts`, `src/popup/DatabaseBackup.tsx`. Decided 2026-10-21.

- **Why a library:** `pnpm storage:estimate` puts a heavy user at ~4 GB (§9), far too much for one JSON string in the worker. `dexie-export-import` 4.4.1 (published 2026-09-10) streams rows into a Blob, which Chrome keeps on disk. The file is its format: `formatName`, `formatVersion`, `databaseVersion`, every table's rows (typed arrays such as `fanMatches` included). It has no export time; the date is in the filename.
- **Validation:** `backupMetaSchema` (zod) checks the header. Then the file is read end to end without writing anything, counting rows per table against the header, because the library doesn't notice a file cut short. A corrupt or foreign file changes nothing. A backup from a newer schema version is refused with an "update the extension" message. Older ones back to `OLDEST_RESTORABLE_VERSION` (v5) are imported, then their rows are migrated as Dexie's upgrades would have done (`migrateRows` in `db/backup.ts`: before v7 it rebuilds the `fanMatches` lists, which brings both v6's track lists and v7's purchase times, and blanks the lately fields on stored crate mates), inside the write phase so a failure rolls back to the snapshot. Tables added since the file's version (`TABLES_ADDED` in `schema.ts`, e.g. v7's `latelyCrateMates`) may be missing from it. Anything older is refused. A schema bump that changes row shapes must add its step to `migrateRows`.
- **All or nothing by snapshot, not one transaction:** the library only keeps an IndexedDB transaction open across file reads with `FileReaderSync`, which service workers don't have (so `db/backup.ts` also shims `FileReader` with `Blob.arrayBuffer()`). Import therefore runs: read-through (above), then export the current data to `backup-snapshot.json` in OPFS, then clear and write, and on any failure write the snapshot back and delete it. If the snapshot can't be saved (disk full), nothing was touched. If the restore itself fails, the snapshot is kept and the error says the old data couldn't be restored automatically. Chosen over an offscreen document with a dedicated worker, which would add a manifest permission, a second runtime and a Blob-less handoff, for the same guarantee.
- **Disk cost:** at the ~4 GB heavy-user size an import briefly holds the staged file, the snapshot and the new database: roughly 3x the database size free, on top of what the old data uses. Short of that, the snapshot step fails cleanly.
- **Scanner pause:** import sets `importing` in the scanner state (reason `import` in `pauseFor`, so your own `paused` flag is never touched), waits for the loop's lock to be released so the request in flight finishes, and for your own sync to settle, then lifts it afterwards however the import ended. The scheduler re-checks the pause after its pace wait. A sync that starts during the import isn't blocked.
- **Handing the file over:** runtime messages are JSON, so a Blob can't travel in one. The popup and worker share the origin-private file system: export stages `backup-export.json` and the popup saves it through a blob URL; import stages `backup-import.json` from the chosen file and the worker reads it. Both are deleted afterwards. Since §19 the exported file (and the snapshot) is gzipped; the staged names keep `.json`, since reading sniffs the content, not the name.
- **What's replaced:** every table, `me` included, exactly as exported. Settings, pause and today's budget stay. After an import the watched-release list and scanner errors are cleared and crate mates are recomputed.
- **Crash recovery:** the import records its phase in `chrome.storage.local` (`import` key): `snapshotting` → `writing` → `cleanup` → cleared. On worker start, before the scanner or any sync runs (the import flag a dead worker left behind holds them off), `recoverInterruptedImport` acts on it: `writing` restores the snapshot and deletes it; `snapshotting` deletes the partial snapshot (old data was never touched); `cleanup` deletes the snapshot (the import had succeeded). No phase but a snapshot present, which is a restore that failed earlier, is only reported, so startup can't loop on it. A failed restore keeps the snapshot. Every branch lifts the import flag, and the outcome shows once in the popup's Full backup row until dismissed.
- **Sync during an import:** `runSync` returns at once while the import flag is set. Skipped, not queued: every trigger (startup, page view, purchase page, Re-sync) goes through `startSync`, and the next one syncs as usual.

## 11. Lately crate mates

Code: `src/scoring/lately.ts` (pure), lately parts of `src/scoring/crateMates.ts`, `src/background/recommend/crateMates.ts` (both boards in one pass), `src/content/profile/crateMates/` (the switch). Decided 2026-10-21.

- **Why:** two fans can share 100 releases they both bought four years ago and little since. The all-time score can't tell that apart from being in step now, because it ignores when anything was bought.
- **Purchase times** come from `ownership.addedAt` (collection pages' `purchased`, or the supporter token's timestamp, §3.7). **Schema v7** stores them in `fanMatches.matchTimes`, parallel to `matchIds`: the newest purchase under each matchKey (buying the album after a track means it's on your mind now), 0 when no row is dated. The upgrade rebuilds `fanMatches` from `ownership` (`rebuildFanMatchLists`, shared with v6). Undated purchases count as old.
- **Fade:** each purchase counts 2^(−age / half-life), with the half-life `latelyHalfLifeMonths` (default 6, a setting). Four years at 6 months is 2⁻⁸.
- **Score** = Σ w(i) × fade(yours) × fade(theirs) × coTiming over shared releases (the same `sharedReleases` as the all-time score, so two different tracks of one album don't count, §7), divided by √(Dₘₑ · D_them), where D is a collection's faded size (Σ fade). It's the all-time score with every purchase weighed by age, so old overlap and an old back catalogue both drop out. The label-cluster factor applies as for `score`.
- **Co-timing:** a release you both bought within 60 days of each other counts up to ×1.5 (same day), falling linearly to ×1 at 60 days. Buying the same thing at the same time is the strongest "same mood" signal. Hype releases everyone buys on day one are already damped by w(i).
- **Too little to go on:** a fan whose faded size is under `latelyMinPurchases` (default 5, a setting) gets no lately score (`null`). Without it, a fan with one recent purchase that you also own would top the board, and a near-zero D would blow up the score. Your own D only needs to be above 0; it's the same for every fan, so it doesn't change the order.
- **Trend:** the same score taken a year ago (`yearAgo`), with only purchases made by then, faded to then. `converging` above ×1.25 of it, `drifting` below 1/1.25, else `steady`; `new` when they had no score a year ago, `quiet` when they have none now. Shown as "↑ closer", "→ steady", "↓ apart", "new", "quiet" on both boards.
- **This year** (`latelyOverlap`): shared releases you both bought within the last 365 days. It's also the bar for the Lately board: a fan needs a lately score **and** at least one such release. Old overlap alone still scores a sliver above 0, which would fill the bottom of the board with noise.
- **A second table, `latelyCrateMates`,** holds the top 200 by lately score from the same recompute pass (one intersect per fan feeds both). The all-time `crateMates` table and everything that reads it (For you, Also bought's crate mate boost, crate mates who own this, profile badges) are unchanged; its rows just carry the lately fields too, for the trend column.
- **Limits:** fans are re-read every 30 days (§5), so a fan's last month of purchases may be missing; the 6-month half-life keeps that from mattering much. The top lately crate mates are re-read weekly (below). Bandcamp Friday sprees aren't capped.
- **For you, Fresh** (`src/scoring/fresh.ts`, decided 2026-10-22): an *All time / Fresh* switch on the For you tab. Fresh takes the top `topCrateMatesK` of `latelyCrateMates` (crate mates with no lately score left out), and each of their purchases from the last 365 days adds lately score × fade(purchase), with the same `fade` and `latelyHalfLifeMonths` as the lately score. Older and undated purchases don't count at all, so Fresh never fills up with back catalogue. Fade ≤ 1, so the summed value is still the ceiling, and scoring, w(i), exclusions (§7's For you filters), pruning and the diversity rule are All time's unchanged. Rows say "bought by N of your lately crate mates · latest 3 days ago" (the newest of those purchases). Empty with no lately crate mates says so and points to All time. No co-timing bonus: it's about you and a crate mate buying the same thing, and Fresh picks are things you haven't bought.

### Re-reading top lately crate mates, and Crate mates' latest

Code: `src/background/scanner/latelyRescan.ts` (selection, pure), `fanLatestStep.ts`, `src/scoring/crateMatesLatest.ts` (feed, pure), `src/background/recommend/crateMatesLatest.ts`, `src/content/profile/latest/`. Decided 2026-10-22.

- **Who and how often:** the top `latelyRescanCrateMates` of the Lately board (default 25, 0 turns it off) are re-read when their last read is `latelyRescanDays` old (default 7). Both are settings with popup controls. Everyone else keeps the 30-day re-scan (§5). The daily maintenance pass (§9) queues what's due, so in practice a crate mate is re-read every 7 to 8 days. A crate mate with any scan already queued is skipped (that scan reads their newest purchases anyway), and so is one without a full read on file (`done` or `partial`).
- **A latest read, not a full re-scan:** a fan job whose cursor starts at the new `latest` stage reads the collection from the top, `collectionBatchSize` items a request, and stops at the first page holding a purchase from before the last read (less a day of overlap, for purchases Bandcamp lists late), or at the end, or at the collection cap. A crate mate who bought fewer than 100 things that week costs one request instead of up to 20. It counts as a fresh read (`collectionFetchedAt`), keeps the fan's status, and adds the purchases it hadn't seen to `scannedItems` and `collectionSize`. No schema bump: the cursor is data, not an index.
- **Failures:** a `{"error": true}` page ends the read and keeps the collection on file, rather than marking a long-read crate mate `private` over one refused page. A dropped latest read leaves the fan as it was, not `error`, so they stay on the boards and the next round tries again.
- **Queue place:** priority `LATELY_RESCAN = 2.5`, between releases you opened (2) and the seed backlog (3): it never delays a page you're looking at, and isn't held up for days behind a large seed backlog. A fraction, so SEED's stored value needn't migrate. Jobs are due from when they were queued, ranked by board place, so the closest crate mate goes first. They go through the same loop as every job, so pace, back-off and the daily budget apply unchanged. Cost: about 25 to 50 requests a week at the defaults, well under 1% of one day's budget.
- **Crate mates' latest** is a fourth profile tab (`#latest`), next to Crate mates and For you. It lists releases bought in the last 60 days (`LATEST_WINDOW_DAYS`) by your top `topCrateMatesK` lately crate mates, then the top `topCrateMatesK` all-time crate mates not already in, newest purchase first (a tie goes to the release more crate mates bought), at most 50. Each row names who bought it, lately board first, and when the newest of them did. It reads `fanMatches.matchTimes` (the newest purchase under each matchKey, §11 above), so no new index: owned, wishlisted and hidden releases are left out as in For you (`exclusions`), albums you own a track of are left out (§3.8), and undated purchases never show. While any of those crate mates has a scan waiting, the tab says it's checking them.

## 12. Smarter supporter scanning

Findings checked 2026-10-21 against live bandcamp.com. The scanning half (passes 0–2 below) was built the same day and replaces "scan supporters in page order, each collection in full" (§5) for releases you open. The scoring half ("Scoring and the wait") is tracked separately.

### Why

Opening a release with hundreds of supporters showed unrelated Also-bought rows for minutes:

- Supporters are scanned in page order (newest buyers), not by how much they tell us.
- Each fan is read to the end before the next starts: up to 20 requests (about 45 s at our pace) for a 2,000-item collection. The first handful read are often the biggest omnivores.
- With N = 8 supporters read, an item 2 or 3 of them own easily reaches the lift cap (§6). Nothing in the score says how little it has seen.
- Whole collections count, so someone who bought the release in 2019 adds what they bought in 2026.

### Findings

- **Bandcamp's own "in common" count is on the fan profile page, for a signed-in viewer only.** The server renders it into the header: `<ol class="info-items">` → `<li class="genre-wrapper">Electronic, 8 items in common</li>` (favourite genre, then the count), next to the location `<li>`. It is text only, not in `#pagedata`. Bandcamp's template leaves it out when the count is 0, and it isn't there logged out, so "no line" means 0 only when `identities.fan` is set. Checked on `bandcamp.com/otfx`, a supporter of one of the viewer's releases (fixture `fan-page-in-common.html`).
- **The genre and location are also in `#pagedata`** (`fan_data.fav_genre`, `fan_data.location`), so the parser reads those from JSON and only the count from the header. Logged out, the genre line holds the genre alone ("Alternative" in `fan-page-medium.html`).
- **Bandcamp computes it over both full collections**, which our local overlap can't. It counts differently from our crate mate overlap (one real fan: Bandcamp 21, ours 30, §7), which is fine for ranking.
- **Supporter rows don't carry it, signed in or not.** Signed-in `tralbumcollectors/2/initial` rows have the same fields as logged out. The only client-side `num_items_in_common` in Bandcamp's scripts is on suggested-fan and follower/following cards.
- **A fan page is one request of about 400 KB.** Besides the count it gives `collection_data.item_count` (collection size, unknown to scans until their last page, §3.4), the favourite genre, the location and the 20 newest items (`item_cache.collection`).
- **A date-anchored collection token works.** `collection_items` with `older_than_token: "<unix ts>::a::"` returns purchases made before that time, so one request can read the 100 items around when a fan bought a given release.
- **Collection items carry `genre_id`** (Bandcamp's top-level genre), on every item and for free. We don't store it yet. Fine tags exist only for releases whose page was fetched (§1, `items.tags`).

### As built: rank first, then read

Code: `src/bandcamp/fanProfile.ts`, `src/scoring/supporterRank.ts` (pure), `src/db/repo/supporterRank.ts`, `src/background/scanner/passZero.ts`, `fanJob.ts`, `fanProfileStep.ts`, `fanCollectionStep.ts`, ranks in `priority.ts`.

- **Queue order (schema v8):** jobs carry a `rank`, and the queue runs by `[priority+nextAttemptAt+rank]`, then insertion order. Rank breaks ties *within one place in line*, so a release's fans still run before the next release at that priority (§5); within a release, a lower rank goes first. Release jobs are rank 0, so the whole supporter list is in before any of its fans run. The upgrade (and `migrateRows` for a v7 backup) gives every job rank 0, which keeps the old order exactly. Fan jobs also gain `via` (the release whose list queued them) and a staged cursor.
- **Pass 0:** supporters are queued in page order (rank 1, 2, …). When the release job reads its last supporter page, and whenever you reopen a release whose list is fresh, `rankSupporters` re-ranks its fans that haven't started: Σ w(i) over releases they're known to share with you (their `fanMatches`, which supporter lists of your seeded releases fill before any collection is read), plus **half weight** for other releases from the release's seller or label (`bandId` or `labelId`) that you don't own. The release itself doesn't count. Ties, including "nothing known", keep page order. Fans read in the last 30 days aren't queued at all, so they skip passes 1 and 2 and Also bought uses what we have.
- **Pass 1, one fan page per supporter** (`fanProfileRequest`, `credentials: 'include'`, from the worker only), in pass-0 order. The count, `item_count` and genre are parsed by `parseFanProfile`; `itemCount` and `inCommon` are stored on the fan. Similarity = count / √(yours · theirs), where *yours* is your number of collection matchKeys. **Deviation, how the read is interleaved:** reading all 500 profiles before any collection would take ~19 minutes, so each fan's collection read is placed as soon as their profile is in. It goes **ahead of the profiles still waiting** when its similarity is at least half the best so far among that release's profiled supporters (`readsAhead`), else **behind all of them**; best similarity first either way (`profiledRank`). The first profile with any overlap is therefore read right away, and fans with nothing in common wait until every profile is done.
  - Logged out (no `me`) there's no profile step. A page that comes back logged out keeps the fan's pass-0 rank.
  - A 404 (renamed fan) skips to the collection. A header we can't read throws `ParserError` in the parser, never 0, but the scanner **doesn't drop the fan** for it: the profile only ranks. It records `parserError` with kind `profile` (so "Parser broken" shows) and carries on; the next profile that parses clears it.
  - **Seed scans skip passes 1 and 2** (deviation): seed fans fill crate mates, not a page you're looking at, so they go straight to the full scan and spend no extra requests. They still get pass-0 order. If you open the release, `focusRelease` lifts their jobs, but a seed job that has started its full scan carries on as it is.
- **Pass 2, quick read:** one `collection_items` request for 100 items with `older_than_token = "<purchase + 90 days>::a::"`, the purchase being the supporter token's time on their row for the `via` release. The fan gets the new status **`quick`**: Also bought and release progress count them (`collectionRead`), crate mates don't (`collectionFullyRead`, also behind the Crate mates tab's "fans read" count), and `collectionFetchedAt` stays unset, so a fan whose job is lost is queued again later.
  - Read from the top instead when the anchor would be now or later (a purchase in the last 90 days), when there's no known purchase, or when the profile says the whole collection fits (`item_count ≤ 100`). A top read that reaches the end is the full read (`done`); one that doesn't hands its next token to the full scan, so nothing is read twice.
  - The step reports `read`, which re-scores watched releases and sends progress like a finished fan, but doesn't count toward the crate mates recompute.
- **Full scans follow in the same job** (one job per fan, `&[kind+target]`): after the quick read it moves to `max(priority, BACKGROUND)` with rank `FULL_SCAN_RANK + its rank`, so it runs after every quick read and profile of releases at that priority, best match first, and crate mates and For you get the whole collection in the end. An anchored quick read means the full scan re-reads those items from the top: one extra request per fan, against up to 20 saved before the first useful rows.
- **Steps report what changed** (`StepResult`: `continued`, `read`, `finished`), so the scheduler stays one request per run.

Measured by tests, not yet on the live site: `supporterPasses.test.ts` runs passes 1–2 end to end on a fake bandcamp.com, and `releaseJob.test.ts` checks pass 0 puts a fan who owns one of your releases first.

### Original plan

1. **Pass 0, free.** When the supporter list is in (the release job already reads all of it before any fan, §5), rank every supporter by what we already know they own of yours: supporter lists of your seeded releases put rows in their `fanMatches` before their collection is read. Weight by w(i). Bonus for owning other releases from this release's seller or label. Fans read recently skip pass 1 and get their overlap from our own data. With nothing known (logged out, nothing seeded), keep page order. The queue needs a `rank` tie-break within priority, since `nextAttemptAt` is the order today.
2. **Pass 1, one fan page per supporter**, in pass-0 order, signed in (`credentials: 'include'`, unlike release pages, §5). Rank by Bandcamp's count scaled by both collection sizes (count / √(yours · theirs)). Logged out, fall back to pass 0's ranking.
3. **Pass 2, collections, best match first.** The quick read is 100 items anchored a few months after the fan's purchase of this release. Full scans follow at background priority for crate mates and For you. Low-overlap fans can stop at the quick read, which saves most of today's up-to-20-requests-per-fan cost. A quick-read-only fan needs a new status, and crate mates must leave them out until their full scan.

Doing pass 1 for all 500 supporters before showing anything would take about 19 minutes and 500 requests. Pass 0 decides which fan pages go first, and results show early.

### Scoring and the wait

Built 2026-10-21. Code: `src/scoring/alsoBought.ts` (`wilsonLower`, `voteWeight`, `coOwnerVotes`, `isConfident`, `warmup`), `gatherAlsoBought`, `computeAlsoBought`, and `WarmupProgress` in the sidebar.

- **Confidence:** lift's share among supporters is now the Wilson lower bound on votes / N (`CONFIDENCE_Z = 1.645`, one-sided 95%), not the raw share. 3 of 8 (0.375) comes out at 0.16, 30 of 80 at 0.29, 300 of 800 at 0.35. The lift cap (10) and `score = votes × ln(1 + lift) × crateMate boost` are otherwise as in §6. A side effect: in the §6 test data, a staple 8 of 10 supporters own now ranks above a release 4 of them own, since more owners means less shrinkage.
- **Omnivores:** each co-owner's vote is `voteWeight(size) = min(1, √(FULL_VOTE_ITEMS / size))` with `FULL_VOTE_ITEMS = 250`: 1,000 items count 0.5, 2,000 items 0.35, 4,000 items 0.25. Votes replace co in both the share and the score; the reason line still shows the plain owner count. √ rather than 1/size because owning a release by chance grows with collection size, but 1/size would discard most of what a big collector says; it's also the damping the crate mate score and the planned fan-page ranking use. Capped at 1 so votes never exceed co, which keeps co-based pruning valid (`scoreCeiling` is unchanged). Size is `max(fanMatches length, collectionSize ?? scannedItems)` for now; once the scan side stores `item_count` from fan pages, use that.
- **Votes are counted only for candidates being scored**, by binary search in each supporter's sorted list, chunk by chunk. `pnpm perf` median: ~59 ms (with the supporter list stored, so it measures shown co-owned rows).
- **Warm-up:** co-owned rows are held back until `WARMUP_SUPPORTERS = 20` supporters are read (or every listed one, if fewer) **and** `WARMUP_ROWS = 5` of the top rows pass the confidence bar, which is a cautious lift of at least `CONFIDENT_LIFT = 2` (`isConfident`). It also ends once every listed supporter's scan has ended, read or not, so private fans can't hold it forever. "Read" is N, the supporters whose collection has been read; "listed" is the release's stored supporter list, so the warm-up waits for that list before it knows its target.
- **During the warm-up**, `AlsoBoughtResult.warmup` holds `{ read, readTarget, confident, confidentTarget }` and `rows` holds early picks: the co-owned rows scored so far (any release at least 2 read supporters share), then same-artist and same-label picks behind them, for any release.
- **The sidebar's first 10 seconds** (`EARLY_PICKS_AFTER_MS`, changed 2026-10-23): it shows only a loader, "Reading supporters before picking" with one bar over both targets and "12 of 20 supporters read · 3 of 5 strong picks", over shimmering placeholder rows (`SkeletonRows`, still when the scanner is stopped). Before the supporter list is in, it shows "queued" or "scanner stopped" instead of a bar. After 10 seconds, or at once if the scanner is stopped (nothing would arrive during the wait, and "No recommendations yet" over stored picks is false), it shows the early picks under an "Early picks" heading and the same bar, and they update live until the warm-up ends and trusted rows replace them. With no picks yet, the loader stays. Final answers ("no public supporters", "nothing in common") use a plain empty state. After the warm-up, small releases still get fallback picks after the co-owned ones (§6).
- **Re-scores come after every supporter** while fewer than `WARMUP_SUPPORTERS` are scanned, since early picks change most then, and every 5 after that (`rescoreDue`). A re-score takes ~59 ms, so this costs little.
- **Why 10 seconds:** at the default pace that's only 4–6 requests, so early picks are noisy. That's why they're labelled, sit under the progress bar and keep updating, instead of being held back for minutes.
- **To tune:** all five constants. A first scan with a near-empty database has a population close to N, so lift sits near 1 and no row is confident: the warm-up then lasts until every supporter is scanned. Progress updates arrive with re-scores.

### Tags (later)

- Re-rank only, never a candidate source: tag matches alone mean "sounds similar", not "fans also bought".
- First store `genre_id` and apply a mild penalty when it differs from the release's.
- Then fetch release pages for the ~30 shown candidates at low priority and keep their tags. Compare with the release's tags weighted by rarity across local items, so broad genres and place names barely count. Apply as a capped boost like the crate mate boost (about ×1.3) and name the shared tags in the reason line. Cost: about 30 requests per newly opened release, falling as tags accumulate.

### Done before building

- Saved a signed-in fan page as a fixture with personal data scrubbed (`fan-page-in-common.html`) and parsed the count from it. Text with a number in it that isn't the English pattern, or that mentions "common" without a count, throws `ParserError` rather than reading 0.
- **Still unchecked live:** how the line reads for a fan with no favourite genre. The parser accepts "8 items in common" without the genre, and "1 item in common", both covered by synthetic tests; capture a real one when it turns up.

## 13. Release sidebar follows the page design

- **Source:** album, track and band pages carry the artist's colours as JSON in `#custom-design-rules-style`'s `data-design` (`bandcamp/pageDesign.ts`): `body_color`, `text_color`, `secondary_text_color`, `link_color`, plus `bg_color` and others we don't use. Hex without `#`. We theme from `body_color`, the content column the release sits on; `bg_color` is the page around it and can be a tiled image.
- **Mapping** (`ui/theme.ts`, pure): background, text, muted and accent come straight from the design. Borders, hovers and subtle fills are mixes of text into background, so one rule works on light and dark pages. Tag, tooltip and status colours keep `tokens.css`. The tokens go on the shadow host as inline custom properties.
- **Readability guards:** text under 4.5:1 on the background means no theme (default look). Secondary text under 4.5:1 falls back to a text/background mix, and a link under 3:1 to the text colour. A missing or broken `data-design` also means the default look, not a `ParserError`: it's cosmetic.
- **Scope:** the release sidebar only for now. Band-page UI could take the same theme.

## 14. Wishlist tags

Decided and built 2026-10-22. Roadmap: *Wishlist tags*. Code (renamed and generalised by §22): `src/content/itemList/`, `db/repo/itemLists.ts`, `background/itemListHandlers.ts`, `src/content/release/WishlistItemTags.tsx`. Tested on the fixtures (jsdom); not yet tried on the live wishlist tab.

The same tags as §8, on the releases in your wishlist, with the same filter (all / any, plus a search over artist and title), bulk tagging and backup.

### Data

- **One tag pool.** Followings and wishlist items share the `tags` table, so "dub" on an artist and on a release is one tag, with one colour. Deleting a tag takes it off both, in one transaction.
- **Schema v9 (additive):** `itemTags: 'itemKey, *tagIds'`, one `{ itemKey, tagIds }` row per tagged item. Not on `items`, which every scan rewrites, and not on `ownership`, whose wishlist row is overwritten when you buy the item. `TABLES_ADDED` lists it at 9, so a v8 full backup still restores.
- **What's in your wishlist** is your `ownership` rows with `source: 'wishlist'` (§4). `listOwnedItems` (was `listWishlist`) joins them with `items` for the release and `itemTags` for the tags, newest wishlisted first. `getItemTags` answers null for an item that isn't in your wishlist, so a release page you haven't wishlisted shows nothing.
- **Sync keeps tags.** A sync rewriting an item or its ownership row leaves `itemTags` alone. A **full** wishlist sync deletes the tags of items that left the wishlist, removed or bought, like unfollowed accounts losing theirs (§8). A hidden wishlist answers an error and returns early, so it keeps them. Until the next full sync, a bought item's tags just sit unused.
- **Backup:** the tags file is version 2, with an `items` list next to `assignments` in every tag. Version 1 files still import (no items). Import skips items not in your wishlist, as it skips accounts you no longer follow.

### UI: Bandcamp's wishlist tab, modified

- **Why take it over:** like the following tab, Bandcamp renders the wishlist 20 items at a time behind "view all", so a filter over what's loaded would be wrong.
- **Markup:** on your own page, `#wishlist-grid` holds `#wishlist-items` with an empty `ol.collection-grid` and `.expand-container` ("view all N items"); Bandcamp's JS fills the list when the tab opens. `#wishlist-grid` gets `active` while open, like every grid (me-fan-page.html). Selectors live in `FAN_PAGE_DOM`.
- **All ours, in one shadow root.** Following cards had to stay light DOM for Bandcamp's follow handler (§8). Wishlist rows don't need any Bandcamp handler, so the whole list is our own `Card`s in a grid, inside one shadow root placed before Bandcamp's hidden list. No Bandcamp markup is copied, so its delegated handlers on collection items can't misfire on ours. The cost: no heart button to un-wishlist from the list; do that on the release page.
- **Lazy takeover:** the list is taken over the first time the tab opens, then stays mounted, filters and selection included. Bandcamp's own list comes back while ours can't stand in (worker unreachable, or empty and the sync hasn't finished, has failed, or hasn't seen you log in). The same rules as §8, from the shared `syncEmpty.ts`.
- **Grid, like Bandcamp's own:** `CardGrid` of `Card`s, `auto-fill` columns of at least 180px. We first built rows; a grid keeps the wishlist looking like the rest of Bandcamp's fan page.
- **Each card:** big playable cover (our own preview player, one open at a time) with a select box top-left and "open in a new tab" top-right on hover, then the title linking to the release, artist and "added 3 Oct 2026", then the tags and "+ tag". An open preview plays in a player docked at the bottom of the window, like Bandcamp's own list player, with the bulk bar stacked above it in one `Dock`. Filtering re-renders the list rather than hiding cards, since no Bandcamp state lives in them.
- **Shared with the following tab:** `TagEditor`, `FilterControls`, `BulkBar`, the tag-bar CSS, `tagActions.ts` (`followTagHandlers`, `itemTagHandlers`) and the pure `tagFilter.ts`, which works over any rows through key, tags and text accessors.
- **Release pages:** when the release is in your wishlist, the sidebar shows "In your wishlist" with its tags and "+ tag", under the artist's tags (§8). Only the exact item: wishlisting an album doesn't tag its track pages.
- **Gap:** Bandcamp's own wishlist search box (`#wishlist-controls`) is left as it is and searches Bandcamp's list, not ours.
- **During a sync** (changed 2026-10-23): the wishlist is fetched first and saved page by page, so the tab shows what's in as soon as it has anything, with "Still syncing your wishlist: N releases so far" while the sync is on that step. The sync status says which list it's fetching (`activity.step`: wishlist, then following, then collection). While the tab is open it polls the sync status every second and reloads the list only when `wishlisted` changes (`useSyncReload`), so a 2,000-item wishlist reloads about 20 times, once per page. Before, it waited for the whole sync, collection included, which on a big collection took minutes.
- **Big wishlists** (2026-10-23): cards render 120 at a time; "Show more" fires by itself 800px before it scrolls into view and stays as a button for keyboards. Filters and search still run over the whole list. A reload keeps the objects of unchanged items (`reuseUnchanged`), so the memoised cards that didn't change skip rendering. Measured in jsdom with 2,000 items: first render 2.4 s → 0.4 s (58k → 3.5k elements), a reload 0.75 s → 0.07 s.

## 15. Page badges

Decided and built 2026-10-22. Roadmap: *Page badges*. Code: `bandcamp/pageLinks.ts` (+ `pageLinksDom.ts`), `db/repo/pageBadges.ts`, `content/badges/`. Tested on the fixtures (jsdom); not yet tried on live pages, and not at all on Discover or the feed, which have no fixtures (both render in JS, and the feed needs a login).

A quiet pill after release links anywhere on bandcamp.com: **owned**, **wishlist**, **3 crate mates**. Off by default; a toggle under *Pages* in the popup's settings. It's read when a page loads, so turning it on or off applies from the next page.

### Which links

- **A release link** is an `<a href>` whose path is `/album/<slug>` or `/track/<slug>`, on any host: artist subdomains, `bandcamp.com` itself, and custom domains linked from bandcamp.com. A link to a non-Bandcamp site with that path finds nothing in the DB, so it gets no badge.
- **Normalised URL:** `https://<host lowercased>/<album|track>/<slug>`, without query, hash or trailing slash, with relative links resolved against the page. That's the shape of `items.url`, which comes from collection `item_url` and the release page's `data-tralbum.url`.
- **Ids from the page when it has them, so no URL guessing there:** a fan page's `li.collection-item-container` (`data-tralbumtype` + `data-tralbumid`), a band page's `li.music-grid-item` (`data-item-id="album-123"`), and a release page's footer `li.recommended-album` (`data-albumid`). Otherwise the URL is the key.
- **Skipped:** links with no text (cover images: the title link next to them gets the badge), Bandcamp's action links (`?action=buy`, "go to album"), the release's own tracklist (`#track_table`) and any link back to the page you're on. One badge per release per card: a second link to the same release in the same `<li>` is skipped.
- **Not on your own profile.** Every item in your collection would say "owned".
- All of this is in `bandcamp/pageLinks.ts`, with selectors in `pageLinksDom.ts`; fixture tests cover fan, band, album and track pages.

### Lookup

- **One message per batch:** `getPageBadges { links: { url, itemKey }[] }` answers one badge (or null) per link, in order. The content script collects links, de-dupes them, and sends them together; there's never a request per link, and **no Bandcamp request at all**: only the local DB is read.
- **URL → item** was an index read on `items.url` (schema v10). Since v12 (§19) a link's host finds its bands and their items are read by `bandId`, with the same answers. An unknown URL answers null.
- **owned:** your collection has the exact item or its album, or, for an album link, any track of it (§3.8: a track bought means the album counts as yours).
- **wishlist:** the exact item or its album is in your wishlist, and you don't own it.
- **N crate mates:** how many of your top `topCrateMatesK` crate mates (the For you set, §7) own it by matchKey, so a crate mate owning a track of an album counts for the album, as in For you. Read from their `fanMatches` lists with a binary search, so a batch costs K record reads, not a query per link.

### What it says

- `owned` alone when you own it: the crate mate count doesn't matter then.
- Otherwise `wishlist`, `3 crateMates`, or both: `wishlist · 3 crateMates`. Nothing at all when there's nothing to say, so most links stay bare.
- A native `title` gives the long form ("3 of your top 30 crate mates own this"). It isn't focusable: a page of hundreds of links would get hundreds of tab stops.

### Infinite scroll and rendering

- A `MutationObserver` on `document.body` re-runs the scan 300 ms after the last change. Every anchor seen goes in a `WeakSet`, so nothing is looked up or badged twice, and Bandcamp's own DOM isn't marked.
- Each badge is a `<crater-badge>` host inserted right after its link, with a shadow root holding the shared styles, so Bandcamp CSS can't reach in. **One React root** renders every badge through portals into those shadow roots; a page doesn't get a React root per link.
- Colours come from the tokens, with the page theme (§13) on release pages, so a badge on a dark artist page isn't a light pill.
- Errors (worker unreachable, a broken page) are `console.warn`ed and the page simply has no badges.

### Gaps

- **Your data changes aren't pushed.** Wishlisting a release on a page doesn't turn its badge to "wishlist" until the next page load.
- **Links whose stored URL differs** (a release first seen under a custom domain, then linked under its subdomain) aren't found by URL; the id containers above cover the pages that have them.

## 16. Following as a signal

Code: `src/scoring/following.ts` (pure), `src/db/repo/followSignal.ts`, wiring in `src/background/recommend/` (`followSignal.ts`) and `src/background/scanner/` (`passZero.ts`, `fanProfileStep.ts`), reason text in `src/content/shared/followedText.ts`. Decided 2026-10-22.

### What the following sync gives us, and what it doesn't

- **Ours only.** The sync (§8) stores *your* followings: band accounts (artists and labels, not told apart) by `band_id`, and fans by `fan_id`, with names. Unfollowed-on-the-tab rows (`unfollowed`) don't count as follows here.
- **Other fans' followings aren't stored.** The same endpoints work for any `fan_id` logged out (§8), at one request per 500 follows per list, so two requests per fan. Not built: "follows the same artists as you" mostly restates collection overlap (you follow what you buy), and crate mates already measure that with purchases, which are the stronger signal. Two requests for each of the 200 crate mates would be ~400 requests a recompute for a small, redundant nudge.
- **Followed fans aren't crawled either** (yet). Fans you follow are scanned only when a supporter list brings them in, as everyone else. Queueing them at seed priority would cost ≤ 20 requests each once (the 2,000-item cap at batch 100), then the 30-day re-read, and is the cheapest next step if followed fans turn out to be good crate mates. Left for later so this change touches no queue or sync code.

### Signals, and how strong

- **Releases from accounts you follow** (For you, both modes, and Also bought's co-owned rows): a release counts as followed when its selling account (`items.bandId`) or its label (`items.labelId`) is a band you follow. Its score is multiplied by `1 + FOLLOW_BOOST` = **×1.25**, flat. Smaller than the crate mate boost's ×1.5 (§6) on purpose: following an artist says you like them, but you'll also hear about their releases from Bandcamp itself, so these picks carry less discovery. ×1.25 re-orders close calls; it never lifts a release past one with clearly more evidence. Pruning stays exact: every candidate's ceiling is multiplied by the same factor (when you follow anyone), since both ceilings are linear.
  - Same-artist and same-label fallback picks aren't re-ordered; they're already about the release's own seller.
  - Setting `followingBoost` (default on, "Boost releases from accounts you follow"). Off, the boost and its reason text are both gone.
- **Supporters you follow are read first** (§12): pass 0 moves followed fans to the front of a release's supporter order (page order among them), and in pass 1 a followed fan's collection always reads ahead of the profiles still waiting, ranked by similarity like the rest. Costs nothing: it only re-orders requests already planned. No setting: it changes when fans are read, not what's recommended.
- **Fans you follow on the crate mates boards** get a "you follow" badge on their row (both boards). Their score isn't touched: the board is a measurement of overlap, and "your #4 crate mate" is read in badges, sidebars and For you weights. Nudging the score would make every rank partly about who you happen to follow.

### Reason text

- Rows boosted for a follow say so after the usual reason, with the account's name, as Fresh does with " · ": "7 supporters have this so far · you follow Warp", "owned by 5 of your top crate mates · you follow Warp". The name is Bandcamp's name for the account you follow. When both the seller and the label are followed, the seller's name shows.
- **Cost:** one more read per score: the followed bands, then their releases through the `bandId` and `labelId` indexes. Pass 1 reads one `following` row per profile.
- **Not yet checked on real data:** whether ×1.25 feels like a nudge. Tune it with the other weights (Phase 7.3).

## 17. Ignoring compilations

Decided and built 2026-10-22. Roadmap: *Ignoring compilations*. Code: `src/bandcamp/compilation.ts` (detector, pure), `src/scoring/compilations.ts` (pure), `items.compilation` (schema v11, `db/repo/items.ts`), and its uses in `db/repo/crateMates.ts` and `background/recommend/` (crate mates, Also bought, For you). Fixture: `album-page-compilation.html`.

### Why

- **Compilations connect fans who share nothing else.** A label sampler, a Various Artists charity comp or a scene retrospective is bought by fans of every artist on it, and by the label's subscribers. Two fans who both own *Bandcamp Friday Benefit Vol. 3* may have no other release in common.
- **Crate mates suffer most.** Crate mate overlap only counts releases you own (§7), and a comp you own matches everyone who bought it for any of its 20 artists. w(i) only damps the big ones: a niche comp with 60 supporters still weighs about as much as a niche album. The label-cluster flag (§7) catches label subscribers, not a comp's mixed crowd.
- **Recommendations suffer less.** In Also bought, lift already corrects for a comp's base rate (§6), so a comp that ranks high there is one this release's buyers really do buy more, often because the artist is on it. In For you, a comp several crate mates own is a fair pick, though it's there partly for the same reason it shouldn't make them crate mates.

### Detecting one (high precision)

`isCompilation` in `bandcamp/compilation.ts`. Wrongly flagging a normal album would silently drop real overlap, so each rule needs strong evidence, and missing a comp only leaves things as they were before.

1. **Artist is a various-artists placeholder.** After lowercasing, trimming and dropping trailing dots: `various artists`, `various artist`, `various`, `va`, `v.a`, `v/a`, `v-a`, plus the common translations (`varios artistas`, `vários artistas`, `artistes variés`, `artisti vari`, `verschiedene künstler`, `diverse artiesten`, `vv.aa`). The artist must be exactly one of these: "Various Artists" as part of a longer name doesn't count. On collection pages `band_name` is the release's artist line, not the selling account's name: the Jazzman comp in `collection_items-p1.json` has `band_name` "Various Artists", sold from `jazzmanalbums`.
2. **The title starts with a VA prefix:** `VA - Title`, `V/A: Title`, `Various Artists – Title`, optionally after a catalog number in brackets (`[LBL001] VA - Title`). This is how labels selling from their own account often name comps, with the label as the artist. *Changed 2026-10-25:* "Various Artists" anywhere in the title counts too (*Nautilus - Various Artists Compilation Vol.1* by MBM, whose track artists are all null, with the names in the track titles). On a track page the album's title (ld+json `inAlbum.name`) is checked as well, so a track of such a comp is flagged.
3. **Release pages only: at least 3 distinct track artists other than the album artist, on at least half the tracks.** `data-tralbum.trackinfo[].artist` is null on a normal album (all 9 tracks of `album-page.html`) and set per track on a comp (24 different artists on the 24 tracks of `album-page-compilation.html`). A track artist that contains the album artist or is contained in it doesn't count, which keeps "Artist feat. Guest" and split releases whose artist line names everyone out. Titles that say remix, rework, edits, versions or reimagined skip this rule, since remix albums list the remixers per track but are bought by the original artist's fans.

Collection pages carry only the featured track's artist (`tracklists`), and on a comp it's the album artist again ("Various Artists"), so rule 3 can't run there.

**Not used, on purpose:** title words like "compilation" or "sampler" (single-artist sample packs, of which the collection fixtures hold several, and an artist's own "The Compilation" would trip them), and "sold from a label's account" (most label releases are single-artist albums, §3.3).

**Coverage:** rules 1–2 run on every item from every scan. Rule 3 runs on release pages we fetch: every release you open, and every release in your own collection, since seeding fetches each one's page (§5). Crate mate overlap only ever touches releases you own (§7), so the rule that sees the most lands where it matters most. Comps whose artist is a label's name and that only turn up in other fans' collections are missed.

### What ignoring means, per scorer

The `ignoreCompilations` setting (default on, a popup toggle next to the label-cluster one) turns all of this off. Changing it takes effect at the next crate mates recompute and the next score of Also bought or For you.

- **Crate mates, all-time and lately: dropped.** Shared compilations are removed from the shared releases before anything is counted, so they add nothing to the score, the lately score, the overlap, Jaccard, "this year" or the label-cluster test. A fan whose only overlap is comps isn't a crate mate at all. The comp still counts in both collection sizes (√(|M|·|F|)), so a collector of comps is a little diluted, as with any release they don't share with you. Dropping rather than down-weighting because overlap on a comp is evidence about the comp's artist list, not about taste.
- **Also bought: down-weighted ×0.5** (`COMPILATION_FACTOR`) as a candidate. Kept, because a comp with a high lift among this release's buyers is a real association. The release you're looking at being a comp changes nothing for an album page: you chose that page. *Changed 2026-10-25:* which buyers count depends on the page (`scoring/releaseBuyers.ts`), see §6 "Whose buys count". Pruning stays valid, since the factor only lowers scores.
- **For you and Fresh: down-weighted ×0.5** as a candidate, for the same reason. Crate mate scores feeding it are already comp-free.
- **Left alone:** Crate mates' latest (a feed of what crate mates bought, not a ranking), crate mates who own this, same-artist and same-label picks, and pass 0's supporter ranking (§12; it only orders scans).

### Data

- **`items.compilation: boolean`**, set by the parsers (`CollectionItem.compilation` from rules 1–2, `ReleasePageItem.compilation` from all three). Not indexed: scorers look it up for records they already read (your collection for crate mates, the candidates' records for Also bought and For you).
- **Merging:** a release page has the whole picture, so its verdict replaces the stored one. A collection page only sees the name, so it can set the flag but never clear it: `compilation = fromCollection || stored`.
- **A matchKey is a compilation** when a record scoring already reads for it says so. Crate mates: any of your own records under it, album or track. Also bought: the matchKey's own record (`getCompilations`), so an album known only through tracks isn't checked. For you: the record it shows (`getDisplayItems`), which may be a track of the album.
- **Schema v11** adds no index. Its upgrade runs rules 1–2 over every stored item's artist and title, so existing data is flagged at once. Rule 3 fills in as release pages are re-fetched (weekly for your own releases, §5). Importing an older backup does the same in `migrateRows`.

## 18. Deep cuts

Researched 2026-10-21 ([docs/research/deep-cuts.md](research/deep-cuts.md)); scorer, worker and message built 2026-10-22 (Roadmap *Deep cuts* steps 1–3). Code: `src/scoring/deepCuts.ts` (pure), the constants and `nichePenalty` in `src/scoring/weights.ts`, `src/background/recommend/deepCuts.ts`, and the *Deep cuts* option in the For you tab's switch (`src/content/profile/forYou/`), with the cap in the popup's settings.

- **A third mode of For you**, next to *Fresh*: `All / Fresh / Deep cuts`. It reuses For you's crate mates, exclusions, rows and diversity rule. On the bus it's `getForYou { mode: 'deep' }`, answered with the same `ForYouResult`.
- **Score** = `T × t/(t + c) × n^−β`, limited to `n ≤ cap`. T is the sum of the all-time scores of the top-K crate mates who own the release, t is how many own it, and n is Bandcamp's owner count (`supporterCount`), at least t. Defaults: K = 100 (`DEEP_CUT_CRATE_MATES_K`), c = 2 (`DEEP_CUT_AGREEMENT`), β = 0.6 (`DEEP_CUT_BETA`: RP³β's default and Zhou et al.'s tuned value on RateYourMusic data), cap = 50 (underground electronic releases run small). The cap is a user setting, `deepCutMaxSupporters` (5–1000), since what counts as rare depends on the genre. `rankDeepCuts` takes the cap and optional β and c, so the eval (step 5) can grid them.
- **Popularity is always Bandcamp's count, never `matchOwners`.** We scan around your crate mates, so local counts make your own neighbourhood look popular. A release with no Bandcamp count isn't a deep cut.
- **No IUF or BM25:** both need the number of Bandcamp fans, which we don't know. A power law doesn't.
- **Pruning:** `T × t/(t + c)` is a ceiling known before any item lookup (n^−β ≤ 1), so candidates are looked up in falling ceiling order, 200 at a time, and the scan stops once a ceiling is below the 60th-best score. `pnpm perf` (`tests/perf/deepCuts.perf.ts`: 200-crate-mate board of full 2,000-item collections, Bandcamp counts following popularity so the most-shared releases are over the cap): 78k candidates, 4.7k looked up, **median 130 ms** against the 200 ms budget in fake-indexeddb. So no `items.supporterCount` index was added (it would now be schema v12).
- **Compilations** are down-weighted ×0.5 as picks, as in For you (§17). Crate mate scores feeding T are already comp-free.
- **No follow boost** (§16), unlike All and Fresh: a release from an account you follow is one Bandcamp already tells you about, the opposite of a deep cut. Keeping it out also means the pure scorer is the whole score, so the eval measures what ships. Deep-cut rows have `followed: null`.
- **Reason line:** "Only 4 owners on Bandcamp · 3 are your crate mates", "Only 3 owners on Bandcamp, all your crate mates", or with one crate mate "Only 12 owners on Bandcamp · one is your #3 crate mate". `ForYouRow` carries `supporters` and `bestCrateMateRank` (the rank, on the board the mode draws on, of the most alike crate mate owning it) in every mode. In All and Fresh, `supporters` falls back to the owners we've seen when Bandcamp gave no count.
- **Tags, labels and early-adopter signals stay out of v1.** Tags re-rank only (§12). Earliness is a later boost, after a check that early buyers really predict crate mate overlap.
- **Tuning** comes from an offline holdout eval (`pnpm eval <backup.json>`, `tests/eval/`) with niche recall@k as the target metric, not plain recall.
- **First eval, 2026-10-22: defaults kept (β = 0.6, c = 2, cap 50).** One real backup: 2,144 fans, ~895 owned releases, 179 held out per fold. Recall@30 on held-out releases with n ≤ 50, as % (± is the spread across the 5 random folds):

  | Method | Temporal (newest 20%) | Random (5 folds) | Median n of hits (random) |
  | --- | --- | --- | --- |
  | For you | 3.6 | 4.1 ± 1.3 | 91 |
  | For you filtered to n ≤ 50 | 5.4 | 7.3 ± 3.7 | 25 |
  | Deep cuts, defaults | 5.4 | 7.3 ± 4.3 | 25 |
  | Deep cuts, cap 25 (niche n ≤ 25) | 9.1 | 12.6 ± 13.5 | 15 |

  - Deep cuts finds ~1.8× as many held-out rare releases as For you, with hits a quarter as popular. The bar (1.5× and under a fifth of the median n) is met on the temporal split and missed narrowly on the random one, on the median.
  - **The cap does the work so far.** Every β and c at cap 50 lands within the noise, and the plain filter scores the same. With one or two rare hits per fold the eval can't tell them apart. What the formula changes is the list's shape, which recall doesn't see: c = 2 keeps single-crate-mate picks out of the top 100 (0% against 28% at c = 0), and a higher β puts 5-owner records above 45-owner ones.
  - Cap 25 is the only setting that clearly clears the bar, but its spread is as wide as its lead, so the default stays 50. Re-run after much more scanning before moving any default.
  - The eval runs on fake-indexeddb, which scans every index entry on each overwrite or delete. So it loads items into an emptied table and holds out by writing your remaining lists under a fresh fan id per fold, never by deleting rows. A full run takes ~3 minutes.

## 19. Slimmer database, gzipped backups

Decided and built 2026-10-22. Code: `src/db/storage.ts` (row shapes, pure), `src/db/gzip.ts`, `slimToV12` in `src/db/schema.ts`, `src/db/repo/items.ts` and `fanRows.ts`, `tests/golden/`.

### Measured

A real backup from 2026-10-22 (schema v7, 2,144 fans, 1,270 of your own rows) was **377 MB** of JSON and **87 MB** gzipped (`gzip -6`). The live database it came from is a **446 MB** LevelDB folder in the browser profile, but that can't be split by table: by then it was on v11, still scanning, and held overwritten values LevelDB hadn't compacted yet. To compare layouts, the backup was loaded into a fresh headless Chrome 155, one origin per table, and each LevelDB folder measured after writing. LevelDB compresses values with Snappy and shares key prefixes, so disk and JSON sizes don't move together:

| Table | Rows | JSON | Disk now | Disk after |
| --- | --- | --- | --- | --- |
| `items` | 543k | 180 MB | 188 MB | 126 MB |
| `ownership` | 1.3M | 144 MB | 273 MB | 173 MB |
| `fanMatches` | 2,144 | 40 MB | 21 MB | unchanged |
| `matchOwners` | 286k | 9 MB | 12 MB | unchanged |
| **Total** | | **377 MB** | **~494 MB** | **~332 MB** |

- **Index entries cost more than values.** `ownership` is 144 MB of JSON but 273 MB on disk: each row is stored once as a record and three more times as `fanId`, `itemKey` and `matchKey` index entries, each carrying the `[fanId+itemKey]` key. The `url` index alone is 48 MB of `items`, because IndexedDB stores string keys as UTF-16.
- **Who reads what.**
  - **`ownership.itemKey` index:** nothing reads it.
  - **`ownership.fanId` index:** every lookup by it can be a range over the primary key, which starts with `fanId`.
  - **`ownership.matchKey` index:** Also bought and "crate mates who own this" read it, and they use only `fanId` and `source`.
  - **Fields of every item, owned by anyone:** `bandId`, `labelId` and `albumKey`. They feed label catalogs (crate mates' label-cluster flag), same-seller fallback picks, pass 0 and the follow boost.
  - **Display fields:** any candidate's record, through `getDisplayItems`. When an album has no record of its own, the record shown is a track.
  - **`url`:** page badges, to turn a link into `itemKey`/`albumKey`.
  - **Written, never read:** `tags` and `fetchedAt`.

### Changes

Each change lists what it saves, in JSON and on disk.

**1. Scanned fans' purchases only in `fanMatches`: rejected.** It would save 253 MB on disk (`ownership` plus a new inverse table, 20 MB). It was rejected because it's one-way. `fanMatches` would become the only copy of other fans' purchases, so a bug in the merge code couldn't be repaired by recomputing from rows, only by re-scanning those fans. Per-item purchase times of other fans would also be lost. We keep the rows and slim them instead (change 4).

**2. Minimal `items` records for tracks: rejected.**
- 389k of 543k items are tracks, and every track's `albumKey`, `bandId` and `labelId` are read (see above).
- 144k tracks are their album's only record, so they stand in for it on display (§6).
- A track link on a page needs its record to fold into the album (§15).
- Only the display fields of tracks whose album has its own record could go: 17.7 MB of JSON, about 10 MB on disk. Keeping results identical would need three special rules: strip those fields when the album's record arrives, but never for your own items (wishlist rows show the track) or for a track page you opened (its fallback picks compare the artist).

**3. URLs split: accepted. Saves 21 MB of JSON and, with the dropped index, 48 MB on disk.**
- `items.url` becomes `slug`: the path segment after `/album/` or `/track/`. The kind comes from the item key.
- **New table `bands: 'bandId, *hosts'`.**
  - The first host seen for a band is its default.
  - A subdomain is stored without `.bandcamp.com`. A custom domain has dots, so it's stored whole.
  - An item whose host differs (2 bands, 5 items in the backup) keeps its own `host`, which is also added to the band's `hosts`.
  - A URL that doesn't round-trip as `https://<host>/<album|track>/<slug>` is stored verbatim in `url`. The backup has none.
- **The `url` index is dropped, with no replacement.** Page badges find a link's host in `*hosts`, read those bands' items by the existing `bandId` index, and keep items whose rebuilt URL matches exactly. Every stored URL's host is in its band's `hosts`, so this finds exactly what the `url` index found. A `slug` index would still have cost ~31 MB on disk, and badge lookups are one batch per page.
- Repos rebuild `url` when they read, so `ItemRecord` keeps its shape for every caller. Only `db/` knows about slugs.

**4. Defaults omitted and unused indexes dropped: accepted.**
- **`items`: saves 55 MB of JSON and 15 MB on disk.**
  - Fields left out when they hold their default: `albumKey`, `label`, `labelId`, `artId` and `supporterCount` when null, `compilation` when false, `tags` when empty. Empty tags were the 20 MB of `$types` in the JSON.
  - `fetchedAt` is no longer stored, since nothing reads it.
  - Reads restore the defaults.
- **`ownership`: saves 28 MB of JSON and 100 MB on disk** (the `source` part only for rows written from v12 on).
  - Indexes become `[fanId+itemKey], matchKey`. Reads by fan become a range over the primary key.
  - `source` is left out when it's `'collection'`, and reads restore it.
  - `matchKey` is kept even when it equals `itemKey`. A row without it would drop out of the `matchKey` index, which Also bought and "crate mates who own this" depend on.

**5. Display fields only where they can be shown: rejected.**
- Items owned by one non-crate-mate fan are 144k records (48 MB of JSON). But crate mates are recomputed after every 15 scans and after each sync, so today's non-crate-mate can be tomorrow's Deep cuts single-crate-mate pick, which would then have nothing to show without a re-fetch.
- Same-seller fallback picks (§6) show any local item from the seller, whoever owns it.

**Also dropped:** label names stored once per label. It saves 2.5 MB of JSON and nothing measurable on disk.

### Gzip backups

- **Export:** `exportDB`, then `CompressionStream('gzip')`, saved as `crater-backup-YYYY-MM-DD.json.gz`. The OPFS import snapshot (§10) is gzipped the same way.
- **Import:** one `readBackup(blob)` decompresses when the first two bytes are `1f 8b`, whatever the file is called; otherwise it reads plain JSON. The popup's import, snapshot restore, `importRecovery` and `pnpm eval` (`loadBackup`) all go through it.
- **File picker:** accepts `.json`, `.gz` and `application/gzip`.

### Migration (schema v12)

- **One step function, `slimToV12`**, used by both the Dexie upgrade and `migrateRows`, so an older backup is written as-is and then migrated, as now. It rewrites every item (slug and defaults) and builds `bands`. Dexie removes the three dropped indexes itself. **Ownership rows aren't rewritten** (changed 2026-10-22, below): old rows keep `source: 'collection'`, which reads accept, and rows written from v12 on leave it out, so that part of the saving arrives as fans are re-scanned.
- **The worker is kept alive while the database opens** (`keepAliveWhile` in `background/keepAlive.ts`), and during backup import and export. Chrome stops an MV3 worker ~30 s after its last extension event or API call, and IndexedDB work doesn't count, so the worker calls `chrome.runtime.getPlatformInfo()` every 20 s until the open finishes. Why: the first real upgrade (446 MB database, 2026-10-22) rewrote items and 1.3M ownership rows in one transaction, took minutes, and was cut off and rolled back on every wake-up, leaving the extension unable to open its database. The data was intact (an aborted upgrade rolls back), and the way back was a backup converted to the v12 shape offline, which imports without migrating. fake-indexeddb has no worker lifetime, so no test could have caught it. `keepAlive.test.ts` now checks the pinging itself.
- **Reads accept both shapes.** A row without `source` is collection. An item with `url` and no `slug` is still read correctly, so the rows written before the migration step runs are never misread.
- **The eval's fast path** (`loadBackup`, v7 and later) can't run `modify` over 10⁵ rows in fake-indexeddb. It runs the same pure per-item transform into an emptied `items` table instead, and leaves ownership rows as they are, which reads accept.
- **Real-world cost:** a one-time rewrite of ~540k items inside the upgrade transaction, with the worker kept alive. If it's killed anyway, the transaction rolls back and the upgrade runs again on the next start.

### Proving results stay identical

- **Golden outputs, recorded before any code changes.** A test builds a small synthetic database through the real write paths: your sync, supporter lists, quick, full and latest reads, release pages, and a forgotten fan. It records every output to a golden file:
  - Also bought: co-owned rows, fallback picks and warm-up.
  - Crate mates who own this, and both crate mate boards.
  - For you: All, Fresh and Deep cuts.
  - Crate mates' latest.
  - Page badges by id and by URL, including a custom domain.
  - The wishlist.
  - Pass-0 ranks.

  It also saves that database as a v11 backup fixture.
- **Three routes must reproduce the golden file exactly:** the same writes on the new code, the v11 fixture upgraded by Dexie, and the v11 fixture imported through `migrateRows`.
- **Perf:** `pnpm perf` medians, before and after, on the same seeds:

  | Check | Budget | Before | After |
  | --- | --- | --- | --- |
  | Also bought re-score | 200 ms | 59 ms | 61 ms |
  | Deep cuts | 200 ms | 132 ms | 132 ms |
  | For you, All (new check) | 200 ms | 107 ms | 107 ms |
  | Crate mates recompute, 200 full collections (new check) | 2 s | 513 ms | 482 ms |

  The before figures for the two new checks come from running them on the code before the change.

### As built

- **URLs are rebuilt only where they're shown.** Rebuilding a URL means reading the item's band, and doing that for every scoring chunk made For you and Deep cuts ~50% slower. So there are two kinds of read:
  - Readers that never show a URL get `ItemFields` (an `ItemRecord` without `url`) and touch no bands: crate mates, pass 0, the follow boost, Also bought's release and seller items, and the scoring chunks of For you and Deep cuts (`getShownFields`).
  - `getDisplayItems` reads the bands for the rows actually shown. It picks the same record as `getShownFields`.
- **Single-value index reads use `equals`, not `anyOf`.** fake-indexeddb scans the whole index for `anyOf`, which made the crate mates recompute's label catalogs ten times slower.
- **`ItemRecord` lost `fetchedAt`**, and the item writers lost their `now` argument.
- **Results:** all three routes (fresh writes, Dexie upgrade, backup import) and a gzipped export and import reproduce the golden outputs exactly. The real backup in the v12 shape is 275 MB of JSON and **77.6 MB gzipped**, down from 377 MB. Gzipping the old JSON alone would give 87 MB, so most of the file-size win comes from gzip. The slimming pays off on disk instead: ~494 → ~332 MB in the headless-Chrome measurement above.

## 20. Crate mates

Decided and built 2026-10-22. Code: `TABLES_RENAMED` and v13 in `src/db/schema.ts`, `src/db/renameTables.ts`, `RENAMED_SETTINGS` in `src/shared/settings.ts`.

- **The name.** The fan leaderboard was called *Taste twins*, the name of another Bandcamp extension. It is now *Crate mates*, in the UI, the docs and the code (`crateMate…`). The profile tab's hash is `#crate-mates`.
- **Stored names follow.** Schema v13 creates `crateMates` and `latelyCrateMates`, copies the rows of the old `twins` and `latelyTwins` tables and drops them in the same upgrade (Dexie deletes removed tables after the upgrade runs). Older versions in the schema keep the names they shipped with.
- **Older backups.** A backup made before v13 names the old tables, and dexie-export-import can't import a table the database doesn't have. Importing (and restoring a snapshot) first streams the JSON through `renameTables`, which rewrites only the two places the format names a table: `{"name":…,"schema":` in the header and `{"tableName":…,"inbound":` before each table's rows. Row values can't match, since quotes inside strings are escaped. The v11 golden backup still has the old names, so the golden tests cover both the upgrade and the import.
- **Settings.** `topTwinsK` and `latelyRescanTwins` became `topCrateMatesK` and `latelyRescanCrateMates`. Saved values under the old keys are read as the new ones, and the next save writes only the new keys.

## 21. Tag on follow and wishlist

Decided and built 2026-10-23. Roadmap: *Tag on follow and wishlist*. Code: `bandcamp/pageActions.ts` (+ `pageActionsDom.ts`), `hooks/useTagPrompt.ts`, `hooks/useRecordFollow.ts`, `content/shared/TagPrompt.tsx`, `content/release/ReleaseTagPrompts.tsx`. Tested on a fixture of the controls as Bandcamp's JS renders them (jsdom, logged out); not yet tried logged in on live pages.

Before this, tags on a new follow or heart only showed after the next sync (§8, §14), so the moment you'd most want to tag it passed.

### Which controls

- **The heart** on album and track pages: `li#collect-item`, server-rendered as `#collect-item-placeholder` and filled in by Bandcamp's JS. Its `collectItem` / `uncollectItem` swap `wishlist` ↔ `wishlisted` **before** the request, and swap back if it fails. A revert reads as an un-heart, which undoes our mark. Neither class (owned: `purchased`) means nothing.
- **Follow** on band, release and fan pages: `#following-actions button.follow-unfollow`. `following` is on while you follow. After a band follow, Bandcamp may re-render it as a "Subscribed!" button (mailing list, class `subscribed`, no id), which counts as following. The server-rendered placeholder has no id and is ignored, so Bandcamp's first render isn't read as a follow.
- On release pages, Follow is the selling account (`bandId`), the same account whose tags the sidebar shows.
- **We send no follow or wishlist requests**, as in §8: Bandcamp's handler does. We watch class changes.

### Watching

- One `MutationObserver` per control on `document.body` (subtree, child list, `class` only). Neither element lives for the whole page (the heart appears after load, the follow button is re-rendered), so watching the element itself would miss changes.
- A change counts only between two known states. Unknown (not rendered, owned) keeps the last known state.

### Saving

- **Follow:** `markFollowed` adds the account with the details on the page (name, URL, location; no avatar) and no tags. A row we already have keeps what the sync wrote and its tags; only the unfollowed mark is cleared. **Unfollow** reuses `setUnfollowed`, so a quick re-follow keeps the tags, and the next full sync deletes the row (§8).
- **Heart:** `markWishlisted` writes your wishlist `ownership` row (dated now) and refreshes your match index. An item you own stays owned; one already wishlisted keeps its date. It answers false before Crater knows who you are, and then nothing opens. **Un-heart** deletes the wishlist row but keeps `itemTags`, so a quick re-add keeps the tags; the next full sync drops them (§14).
- The release itself is in `items` already: opening its page saved it (`releaseOpened`).
- After either, the page's hooks refetch, so the inline tag editor shows at once.

### The picker

- After a heart, the usual tag picker opens **next to Bandcamp's button**, titled "Tag <name>", with the input focused. Escape or a click outside closes it. An un-heart closes it.
- It's `AnchoredTagPicker`: the same combobox as "+ tag", anchored to the page's element through Radix's `virtualRef` and portalled into our shadow root.
- It opens only once your tags and the saved heart have loaded; until then, and on errors (logged), nothing shows. The inline editor carries the error and empty states.
- On release pages the prompts mount in a shadow root of their own, since the sidebar renders nothing inside while collapsed.
- **No picker on Follow** (changed 2026-10-23). After a band follow Bandcamp often opens its mailing-list dialog, which takes focus and closed our picker. Waiting until nothing covered the button didn't hold up live, so a follow is only saved: the page's own tag line ("You follow …" and "+ tag") shows at once, and you tag from there.
- **Setting:** *Ask for tags when you wishlist*, under *On Bandcamp pages*, on by default. Off, the heart is still saved; only the picker stays shut.

## 22. Hide, heard and play-through

Decided and built 2026-10-24. Roadmap: *Hide, heard and play-through*. Code: `scoring/exclusions.ts`, `db/repo/hidden.ts`, `heard.ts`, `sellers.ts`, `background/hideHeardHandlers.ts`, `background/recommend/hideScopes.ts`, `shared/heard.ts`, `shared/playQueue.ts`, `hooks/useListPlayer.ts`, `useBandcampPlays.ts`, `rowActions.ts`, `src/ui/Menu`, `HeardBadge`, `PlayQueueBar`, `popup/HiddenList.tsx`. Tested on synthetic data and the fixtures (jsdom); not yet tried live.

### Hide and heard stay apart

- **Hide is a verdict, heard a state.** A hide takes a release, an artist or a label out of every recommender for good, until unhidden in the popup. Heard only marks a release you've listened to: it stays in with a badge and a dimmed cover, unless that list's *Hide heard* is on.
- **Hide wins.** A hidden release never shows, heard or not. Unhiding leaves its heard mark as it was.
- **Both filter in the worker, before the list is cut to length**, so *Hide heard* still returns a full list. `exclusions(mine, hidden, { release, heard })` takes the heard set only when the request asks (`getForYou { mode, hideHeard }`, likewise `getAlsoBought` and `getCrateMatesLatest`).
- **Heard is not a scoring signal.** "Heard but never wishlisted" might be a soft negative later, only if the eval shows it helps.

### Storage (schema v14)

- **`hides: '[kind+key]'`** replaces `hidden`. Releases are keyed by matchKey, artists and labels by their band account id, with the name they had when hidden, for the Hidden list. Dexie can't change a primary key in place, so v14 copies `hidden` into `hides` and drops it, like the v13 rename (§20).
- **Older backups.** `TABLES_RENAMED` maps `hidden` to `hides` as of v14, and `replaceAll` reshapes those rows as it imports them (`upgradeHide`, the same function the Dexie upgrade uses). `migrateRows` runs after writing, which is too late: an old row has no `[kind+key]`, so it can't be written at all. Import accepts the changed primary key the file names. The v11 golden backup has a hidden release, so the golden tests cover both the upgrade and the import.
- **`heard: 'matchKey'`**: `{ matchKey, heardAt, source }`, source `preview`, `bandcamp` or `manual`. A track of an album marks the album, from its stored record or, for previews, from the page (`current.album_id`). Marking again keeps the first time and source. Added in v14 (`TABLES_ADDED`), so older backups restore without it.
- Clear data and the full backup include both. Nothing is pruned: a hide or heard row is ~50 bytes.

### Artists and labels

- **The menu:** *This release*, *Everything by &lt;artist&gt;*, *Everything on &lt;label&gt;*, each only where the account is known (`hideScopes`, pure):
  - With a `labelId` the release is sold from the artist's own account (§1, §3.3), so `bandId` is the artist and `labelId` the label.
  - Without one, the seller is the artist's account unless its stored items name other artists (compilations aside). Then it's a label's own account: there's no artist option, since hiding "everything by" that account would hide the whole label, and the label option names its host (`hyperdub`), since its name isn't known.
  - That check reads at most 25 items per seller (`multiArtistSellers`). Reading whole catalogs took Also bought's re-score from 62 to 217 ms in `pnpm perf`; with the sample it's 67 ms.
- **The check is per item, not ids:** an artist or label hide must catch releases scanned after it, so `exclusions` returns `allows(item)` beside the ids. A hidden artist matches `bandId`; a hidden label matches `labelId` or `bandId`, since a label sells either way.
  - For you and Deep cuts check the record they already read per chunk. Crate mates' latest checks the shown records, and now reads more until its 50 rows are full.
  - Also bought's co-owned scoring reads no records, so it reads the chunk's (`getShownFields`) only when an artist or label is hidden (`checksSellers`). Its same-artist and same-label picks are filtered too.
- **Gap:** a label account whose first 25 stored items are one artist is offered as that artist. Hiding it hides the label's account.

### When a play counts as heard

- **30 seconds of listening to a release**, summed over its tracks while playing. Seeks don't count: a step between time updates over 2 s, or after a pause or `seeking`, is skipped. A track that ends after at least half of it was heard also counts, for releases of short tracks.
- **Why 30 s:** it's the threshold streaming services count a play at, long enough that a mis-click or a quick skim doesn't count, short enough that sampling a release does. A 10-second preview proves little either way, which is why heard is a state and not a verdict.
- **Our preview player** (`usePreviewPlayer`) sends `markHeard` itself, so every preview counts, wishlist cards included; lists also flag the row at once.
- **Bandcamp's player** on release pages: `useBandcampPlays` listens on `document` in the capture phase, since media events don't bubble. Our own preview's audio element isn't in the page and our shadow roots' events aren't composed, so only Bandcamp's player reaches it. Mounted with the tag prompts, which never collapse.
- **Gap, untested live:** if Bandcamp's player keeps its `<audio>` out of the document, no events reach us. Then we'd need a main-world script hooking `HTMLMediaElement.prototype.play`.

### Play through a list

- **One player per list** (`useListPlayer`): the pure queue (`shared/playQueue.ts`) over the visible rows, and one `usePreviewPlayer` whose URL is the current row's. A cover starts the queue at that row; a release's last track ending moves on to the next row, and the last row stops it. *Play all* starts at the top.
- **The list changing under it** (a hide, a reload, *Hide heard*): the same release keeps playing if it's still there, else the next row that is.
- **Keys while playing:** K play / pause, N next, P previous, Esc stop, on `document`, left alone while typing or with a modifier held. Space stays Bandcamp's.
- **Autoplay:** moving on starts the next release without a click. Chrome allows it because the page has had a user gesture (the first play).
- Lists: For you (every mode), Also bought, Crate mates' latest and, since the merge, New from your follows (§23). The wishlist and collection grids show `HeardBadge` and a dimmed `Cover` too (§24, "Heard on cards").

### UI

- **`Menu`** wraps Radix's dropdown and portals into the shadow root, like `Tooltip`. Arrow keys move, Enter picks, Escape closes and refocuses the trigger.
- *Hide heard* is a checkbox in each list's toolbar, kept per list in `chrome.storage.local` and shown in every state. An empty list with it on says so and offers *Show heard releases*.
- Rows: a heard button (`aria-pressed`) next to the hide menu, and `HeardBadge` under the meta lines.
- **Popup:** a *Hidden* tab lists every hide, newest first, release names looked up from `items`, with Unhide.
- **Also bought's pushed re-scores** keep heard releases in. With *Hide heard* on, the sidebar asks again instead of showing the push.

## 23. New from your follows, and notifications

Recon 2026-10-24, logged out, with curl against live bandcamp.com. Built the same day. Code: `src/bandcamp/discography.ts` (parser), `src/db/repo/bandReleases.ts` and `followsDigest.ts`, `src/background/scanner/followReleases*.ts`, `src/scoring/followsDigest.ts` (pure), `src/background/follows/` (digest, visits, notifications, handlers), `src/content/profile/follows/`. Roadmap: *New from your follows*.

### Data source: the mobile API, not `/music` or the fan feed

Three candidates were tried:

- **(a) The band's `/music` page** (`band-page.html`): its grid has every release (16 rendered `li.music-grid-item[data-item-id]`, the rest in `ol#music-grid[data-client-items]`, 28 in all for Floating Points), with `page_url` and art. But it has **no release dates**, so only "first seen" could order it. It also lives on the band's own host: a band with a custom domain **301s** `<sub>.bandcamp.com/music` to it (`pearsonsound` → `music.pearsonsound.com`), which the worker has no host permission for, so the fetch fails as a network error and would pause the whole queue (§5). And a band with one release 303s `/music` to that release.
- **(b) The logged-in fan feed** (`POST /fan_dash_feed_updates`): logged out it answers `oops`. It needs your session, mixes in followed fans' purchases, and the built-in browser had no Bandcamp login to check it with, so nothing about it is confirmed. Not used.
- **(c) The mobile app's public API (chosen).** On `bandcamp.com`, logged out, JSON:
  ```
  POST https://bandcamp.com/api/mobile/24/band_details  {"band_id": 2009518365}
  → {id, name, bandcamp_url, discography: [{item_id, item_type, title, artist_name, band_name, band_id, art_id, release_date: "28 Aug 2026 00:00:00 GMT", is_purchasable}], ...}
  POST https://bandcamp.com/api/mobile/24/tralbum_details  {"band_id", "tralbum_type": "a"|"t", "tralbum_id"}
  → {id, type, bandcamp_url, album_id, release_date: <unix s>, is_preorder, label, ...}
  ```
  `band_details` lists the account's **whole discography with release dates** (28 for Floating Points, 127 for the Peacefrog label). For a label, entries sold from its artists' own accounts carry the artist's `band_id` and `artist_name`. It has **no release URL**; `tralbum_details` has it (`bandcamp_url`), taking the selling account's `band_id`. Errors are HTTP 200 `{"error": true, "error_message": "..."}` (unknown band, unknown release), so `BandcampApiError`. Fixtures: `band_details.json`, `band_details-label.json`, `band_details-unknown.json`, `tralbum_details.json`, `tralbum_details-track.json`, refreshed by `pnpm fixtures:refresh`.

Chosen because it gives real release dates, one request per account whatever its size, and never leaves `bandcamp.com`, so custom domains just work. The cost: one more request per release whose URL we need, which is only news in the digest's window (below), a handful a week. Risk: it's the mobile app's API, unofficial like every endpoint we use; a shape change is a `ParserError` like any other.

### Storage (schema v15)

```
bandReleases: '[bandId+itemKey], bandId, releasedAt, firstSeenAt'
bandReads:    'bandId'
followMutes:  'bandId'
```

- **`bandReleases`**: one row per followed account and release (a release listed by an artist and their label you both follow has two). It keeps the seller's `band_id`, title, artist line, art, release date, `firstSeenAt`, `baseline`, and once its details are read `url`, `albumKey` (for an album track) and `preorder`. A read deletes rows the discography no longer lists.
- **`baseline`**: set on everything the account's **first** read finds. That's back catalogue, not news, even when it's dated recently: it's how a new follow doesn't flood notifications.
- **`bandReads`**: when each account was last read, so accounts with no releases are still known to be read.
- **`followMutes`**: see *Mute*. Kept when you unfollow, so a re-follow stays muted.
- All three are in backups (`TABLES_ADDED` at 15) and cleared by Clear all data. When the daily pass finds an account with a read but no `following` row (a full sync deleted it), its releases and read are dropped; mutes stay.
- **Your last visit and last notification** are in `chrome.storage.local` (`followsDigest`), not IndexedDB: clearing or importing the data shouldn't make everything new again.

### Scanning

- **Job kind `followReleases`**, target the `band_id`. One request per run, as every job (§5): the first run reads `band_details`; then one run per release that needs details: news (below) in the window with no URL yet, newest first, at most 20 a read so a big label's first read can't flood the queue (the rest follow on later reads). A release whose details answer `{"error": true}` is skipped; the next read drops it.
- **Weekly:** the daily maintenance pass (§9), and every finished sync of your own (which may bring new follows), queue every account you follow (not unfollowed on the tab) whose last read is 7 days old or more, never-read first, then the longest unread. So each account is read every 7 to 8 days.
- **Priority 3.5** (`FOLLOW_RELEASES`): **after the seed backlog** (changed 2026-10-28, v19 moves reads queued at the old 2.75). It first sat at 2.75, ahead of the seed, so a weekly read couldn't wait weeks behind it. But on a first install that meant a request per follow (606 for one user, ~25 minutes) before any of your releases was read, with Crate mates empty all that time. Crate mates are the core of the extension, so they go first. While a big backlog drains, the digest can lag. Opening the follows tab still moves every waiting read up to BACKGROUND, and once the backlog is through, each sync seeds only what it added, so weekly rounds run promptly. A round costs about one request per account plus a few details, e.g. ~250 requests a week for 200 follows, about 0.4% of a week's budget at the default 10,000 a day. It runs through the same loop, so pace, back-off and the daily budget apply.
- **Opening the tab** queues whatever is due and moves every waiting read up to BACKGROUND (2), behind only the release page you have open.
- First install: the first sync queues every follow, but the round waits behind the seed backlog, unless you open the follows tab.

### What's news, and the order (`scoring/followsDigest.ts`)

- **News time** (`newsAt`): the release date, except when a release was first seen more than 14 days after its date (`LATE_UPLOAD_MS`; reads are weekly, so a new release is seen at most ~8 days late). Then it's an old release newly put up, news from when we saw it. Back catalogue (`baseline`) only counts by its date; without one it's never news. Pre-orders have future dates and sort first.
- **Window**: news of the last 60 days (`DIGEST_WINDOW_DAYS`, as Crate mates' latest).
- **Left out**: accounts you no longer follow, releases whose URL isn't read yet (they show up within the round), and owned, wishlisted and hidden releases through `scoring/exclusions.ts` as it is (its `exclusions(mine, hidden)` match ids; an album track goes by its album).
- **One entry per release**, listing each followed account that has it, the seller first.
- **Order**: newest **day** first (Bandcamp dates are days, and releases bunch on Fridays), then **crate-mate interest**: how many of your top `topCrateMatesK` all-time crate mates own any release in that account's discography (our stored `bandReleases`, matched against their `fanMatches` lists). Then time and title. Interest also shows in the row: "3 of your top crate mates buy from them".

### The tab

- A fifth profile tab, `#follows` ("new from follows"), after Crate mates' latest. Rows reuse `ReleaseRow` (preview, open, hide), with the followed account in the label slot when it isn't the artist ("Michael J. Blood · Peacefrog Records"), and a **Mute** action.
- **"New since your last visit"** splits the list in two. The tab records the visit when it opens (`followsDigestOpened`) and answers with the visit before it; rows first seen after that are new. A new follow's back catalogue only counts if it also came out since then. Once per page load, so switching tabs and back keeps the split. No per-release seen state: the *heard* store from research #2 will replace it after the merge.
- **Filters**: the follow tags (§8) as chips with all/any, and a search over title, artist and account names (the shared `FilterControls`). A release's tags are its accounts' tags.
- **States**: loading; not logged in; following no one (or follows still syncing); the first round under way, with a progress bar of accounts read; nothing new; nothing matching the filters, with "Clear filters"; worker unreachable, with "Try again"; results. While reads are queued the list re-fetches every 10 s and shows "Checked N of M accounts".

### Mute: a set of its own, not a tag

A per-account mute is a separate `followMutes` set rather than a reserved tag or a flag on `following`:

- **Tags are yours to name and mean "show me these"**. A built-in "muted" tag would show up in every tag picker and filter (following tab, wishlist, page tags) and could be renamed or deleted, or be exported and imported with your tags.
- **A flag on `following` would be the sync's to keep**: `putFollowing` merges and `replaceFollowing` deletes rows, so the merge would have to learn one more field, and an unfollow then re-follow would lose it. A set keyed by `band_id` is untouched by the sync.
- Muted accounts' rows stay in the answer, flagged, so muting and unmuting is instant; the tab hides them and lists the muted accounts under "Muted accounts (N)" with Unmute. A release listed by two accounts is only hidden when both are muted.

### Notifications (#10)

- **Setting `followNotifications`**, default off, in the popup's new *New from your follows* section.
- **`notifications` is an optional permission** (`optional_permissions`), asked for when you turn the setting on (Chrome only prompts from a click). A required one would show a new permission warning on update and disable the extension until it's accepted, for a feature that's off by default. Refused, the toggle stays off; revoked later, the popup says so.
- **One grouped notification per round**: when a `followReleases` job ends and none are left queued, the worker builds the digest and announces releases found since the later of your last visit and the last notification, leaving out back catalogue and muted accounts. "5 new releases from your follows", naming the first three in digest order. Nothing new, no notification. Clicking it opens your profile at `#follows`.

### Not checked live yet

- The tab, the toggle and a notification in a real browser (all tested on fixtures and in jsdom).
- `chrome.notifications` after granting the optional permission without a worker restart (the click listener is registered on `permissions.onAdded` too).
- How a big label (hundreds of releases) reads, and whether ~20 details per read is enough for one's first round.

### With hide and heard (merged 2026-10-24)

- **Rows are like every other list's:** `rowControls` gives them the heard mark, the *Hide from recommendations* menu and the list player (play through), and the tab has its own *Hide heard* switch (`hideHeard.follows`). `getFollowsDigest` takes `hideHeard`, filtered in the worker before rows are shown, like the other lists (§22).
- **Hides of artists and labels apply here too.** `buildDigest` takes `exclusions()`'s `ids` and `allows`, and asks `allows` about the release's seller, with the followed account listing it as its label when the two differ (`sellerOf`). So hiding a label you follow takes its releases out of the digest, and of its notifications, without unfollowing or muting it.
- **Hide scopes** come from the same `loadHideScopes` as the other lists, fed with the seller, the listing account as label (named by its follow), and the artist name.
- **Mute stays separate from hide:** mute is per followed account and only about this tab and notifications; hide is about every list.

## 24. Wishlist and collection tools

Decided and built 2026-10-24. Roadmap: *Wishlist and collection tools*. Code: `src/content/itemList/` (the takeover, generalised from §14), `src/shared/csv.ts`, `exportCsv.ts`, `src/scoring/wishlistCrateMates.ts`, `db/repo/itemLists.ts`, `src/popup/CsvExport.tsx`. Tested on the fixtures (jsdom); **not yet tried on the live tabs** with Bandcamp's own JS running.

### One takeover for both tabs

- **Generalised, not copied.** `content/wishlist/` became `content/itemList/`. A `ListConfig` (`lists.ts`: `WISHLIST`, `COLLECTION`) holds what differs: Bandcamp's grid and items selectors, the noun in our text, the sync step and count that say the list is complete. Takeover, lazy opening, `showBandcampList` fallback, `syncEmpty.ts`, grid, card, filter bar, tags and bulk bar are the same code. `listWishlist` became `listItems { source }`, `WishlistItem` became `ListedItem`.
- **The collection tab's DOM differs a little, and `me-fan-page.html` already shows it** (no new fixture; the page is the logged-in capture, and a fresh one would need a login). `#collection-grid` is `active` when the page loads, so the takeover happens at once, not on a click. `#collection-items` holds the first 20 items already rendered in `ol.collection-grid.editable`, then a second, empty `ol.collection-grid`, then `.expand-container`. All are direct children, so the same rule hides them (`FAN_PAGE_DOM.itemsNativeList`, `itemsExpand`), and our slot goes before the first `ol`. Bandcamp's own search box is hidden while ours stands in (see *No sort*).
- **Same fallbacks as the wishlist:** Bandcamp's list comes back while the worker is unreachable or while our list is empty and the sync hasn't finished, failed, or hasn't seen you log in.
- **Big collections:** 120 cards at a time with "Show more", filters over the whole list. A heavy user's collection is thousands of rows over the message bus (about 400 bytes each); not measured on a real account yet.
- **Tags apply to collection items too**, the same pool (§14). `getItemTags` still answers only for wishlisted items, so a release page shows tags only while it is in your wishlist: a gap.
- **Tags, notes and ratings now survive a purchase.** Before, the wishlist sync dropped the tags of anything that left the wishlist (§14). A full sync now prunes at its end (`pruneItemData`), after both lists: tags and notes of items in neither list go, prices of items off the wishlist go. A bought item keeps its tags and note. A hidden wishlist leaves its rows, so it keeps them as before.

### No sort (removed 2026-10-24)

- A sort menu (added, artist, label, price, crate mates who own it, buy next) shipped and came out the same day: it crowded the toolbar for little use. Cards are newest first, as the worker sends them.
- **Crate mates who own it** stays as a line on wishlist cards and a CSV column: `scoring/wishlistCrateMates.ts` counts how many of your top K crate mates (`topCrateMatesK`, same as For you) hold each wishlist item's matchKey, over their `fanMatches` lists (`getPurchaseLists`). Wishlist only: you own what's in your collection.
- The search also looks in the label. It's the only search on the tab: Bandcamp's own box (`#wishlist-search`, `#collection-search`) only searches its hidden pages, so the takeover hides it too.

### No notes, ratings or prices (removed 2026-10-24)

- Private notes with 1–5 ratings on cards, and wishlist prices read by the sync, shipped and came out the same day. Schema v18 drops their tables (`itemNotes`, `itemPrices`, added in v16). A full backup from v16 or v17 still restores: `TABLES_DROPPED` names the two, and the import skips them unread (`skipTables`).
- **Tags backup file:** written as version 2 again. Version 3 files, which carried a `notes` list, still import; the notes are ignored.
- **Tags survive a purchase**, which came with this work and stays: a full sync prunes at its end (`pruneItemData`), after both lists, so only tags of items in neither list go.

### CSV export

- **Pure serializer** in `shared/csv.ts`: UTF-8 with a byte order mark (so Excel opens accents right), CRLF, RFC 4180 quoting. Text that starts with `=`, `+`, `-`, `@`, tab or carriage return gets a leading apostrophe, so a hostile title can't run as a formula; numbers aren't touched.
- **Row shapes** in `shared/exportCsv.ts`. Wishlist: artist, title, label, URL, added (ISO date), crate mates who own it, tags. Collection: the same without crate mates, with the purchase date. For you: rank, artist, title, label, URL, owned by your top crate mates, owners on Bandcamp, best crate mate rank, newest crate mate purchase, who you follow behind it. Tags are names, joined with "; ".
- **From the popup's Settings tab** ("CSV export"): Wishlist, Collection, For you, with a menu for which For you picks (All time, Fresh, Deep cuts). The popup can't see the profile tab's current mode, so it asks. It reads through the existing `listItems`, `listTags` and `getForYou` messages (no new one) and saves through a blob URL (`hooks/saveFile.ts`, now shared with the two backups). An empty list says so instead of saving an empty file. M3U export from the backlog is still open.

### Heard on cards (merged 2026-10-24)

- `listItems` answers `heard` per item, read from the heard store by matchKey (an album for its tracks), so wishlist and collection cards show `HeardBadge` and a dimmed cover like the recommendation rows (§22).
- A card's preview marks the release heard in the worker after 30 s, as every preview does. The grid also flags the card at once (`onHeard` from `ReleasePreview`), instead of waiting for the next read of the list.
- The cards have no Hide heard switch and no manual mark: the wishlist doubles as a to-listen list, and the badge is what that needs. Add either if it turns out to be missed.

## 25. Filters on recommendation lists (removed)

Built and removed on 2026-10-24. A filter bar (genre, release year, name your price, physical edition, near me) on For you, Also bought and Crate mates' latest, with a "Your place" setting, facts read from collection rows and release pages, and a v17 upgrade that filled in followed bands' locations. It took a row on lists meant for browsing, and filled the parsers and the schema with facts nothing else used.

- v17 stays declared, as released versions must, but no longer fills anything in. Facts already written to `items` (`year`, `nyp`, `physical`) and `bands` (`genre`, `location`) are left as unread fields: rewriting every item would make the upgrade take minutes (§19), and a rescan writes each row afresh.
- If filters come back, start from the commits of that day (`feat(filters)`), and from the notes there on what Bandcamp sends: `band_location` is null logged out, and "name your price" isn't "free".

