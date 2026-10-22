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
| Private fans | **Decided (2026-10-20): ignore them.** If a fan's collection can't be read (`collection_items` errors on the first page), set `status = private`. Leave them out of twins, scoring and the fan count `N`, and show nothing in the UI. | Decided |
| Name | Still open. "Dighead" stays the working name. | Open |

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
     - You own album A and a twin owns one track from A: **match.**
     - Two people own different tracks from A: a match for co-ownership and recommendations (Also bought, For you), since it's the same release group. **Not a match for twin overlap** (changed 2026-10-21, §7).
     - Rarity weight uses the album's `also_collected_count` when it's known, otherwise the track's.
     - Recommendations are ranked per `matchKey` and point at the album, with a reason such as "2 twins own tracks from this".
     - If you own a track of A, A is left out of recommendations, as if you owned A (changed 2026-10-22: buying a track almost always means you've heard the album; before, A stayed in, tagged "you own 1 track"). Wishlisting a track of A keeps A in.
   - Still open for Phase 4: track-only buyers don't appear in the album's supporter list. Pulling them would cost one supporters request per track on the album page. Measure whether it's worth it once the sidebar works.

## 4. Syncing your own collection (Phase 2)

- **Who you are** comes from `#pagedata` → `identities.fan` (`id`, `username`), which is on fan, album and track pages. The content script sends only that element to `parseViewer`, not the whole page. It reports it to the worker on every Bandcamp page view (`pageSeen`).
- **Your owned and wishlisted items are your `ownership` rows** (`source` = `collection` or `wishlist`). `me` only holds who you are and `syncedAt`. Item metadata goes into `items` with the same mapper as fan scans, keeping any tags from release pages.
- **Two sync modes:**
  - *full*: page everything, then delete your rows that weren't seen, so removed wishlist items go away. It runs on first detection, when the logged-in fan changes, after a sync that never finished, and from the popup's Re-sync button.
  - *incremental*: stop at the first page whose items are all known, so it usually costs 1–2 requests per list. It runs on browser startup, on the purchase page, and on any page view when the last sync is over 24 h old. It can't see removals.
- **Wishlist first, then collection**, so an item you bought since wishlisting ends up as `collection` (same `[fanId+itemKey]` row).
- **Hidden wishlist:** if your wishlist errors on its first page, the sync keeps going with the collection.
- **Pace:** your own sync waits the scanner's pace (1.5–3 s) between pages but doesn't count against the daily budget. Each wait re-reads settings from `chrome.storage`. Because that's an extension API call, it keeps the service worker alive through a long sync. If the worker is killed anyway, `syncedAt` stays unset and the next trigger runs a full sync again.
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
- **Seeding from your own collection** (`scanner/seed.ts`). Without it, the twins pool only held supporters of pages you happened to open. After each successful sync of your own collection, a `release` job is queued for each release you own:
  - Collection only, not the wishlist. There's one job per matchKey: the album itself when you own it, otherwise your newest item under it.
  - Releases whose supporter list is fresh (7 days) are skipped. A full sync seeds every release you own. An incremental sync seeds only the releases holding items it added, so the daily resync doesn't re-list your whole collection each week.
  - **Three priorities:** 1 = the open release, 2 = releases opened earlier, 3 = seed. A page you open always goes first, and supporters of pages you opened aren't starved by a 1,000-release backlog. `focusRelease` only moves priority-1 jobs back to 2, so seed jobs stay at 3 unless you open that release. `enqueue` never lowers a priority, so seeding never demotes a release that's already queued higher.
  - **Order within seed:** a seed job's `nextAttemptAt` is its purchase time negated, so newer purchases run first, even when a later incremental sync adds them behind an older backlog. Negative times are always due. The newest purchase in a matchKey group counts; unknown dates go last.
  - **Fans inherit their release job's priority and place in line** (its `nextAttemptAt`). A release's supporters are scanned before the next release at the same priority starts, so your newest releases fill in fully (depth first) instead of every supporter list being read before any fan. This applies at priority 2 too.
  - **Budget:** seed jobs share the daily budget (10,000 by default) and simply take what's left after priorities 1 and 2. A large collection won't finish in a day (one release can mean ~6 supporter pages plus up to 500 fan scans), which is why the order matters. Your own sync stays outside the budget (§4).
  - The popup shows "N / M your releases scanned": releases with a supporter list of any age, out of the matchKeys you own.
  - The `seedFromCollection` setting (default on) turns it off. Turning it off stops new seeding only: already-queued seed jobs keep running until they're done, you pause the scanner, or you clear the data.
- **Failures come in three kinds** (`scanner/outcome.ts`):
  - *throttled*: HTTP 429, 5xx, **or no response at all** (offline, DNS, 30 s timeout). The whole queue pauses and the job stays as it is, with no attempt counted. Network errors are in this group because being offline is never one job's fault. Counting them per job would burn every job's retries in seconds.
  - *permanent*: another 4xx, a `ParserError`, or a `{"error": true}` other than a fan's first page. The job is dropped, and a dropped fan gets `status = error`.
  - *transient*: anything else, which is probably our own bug (e.g. a DB error). The job is retried after 60 s, then 120 s, then dropped.
- **Offline vs. Bandcamp pushing back:** both use the same back-off, but a back-off started by a request with no answer is flagged `offline` in the scanner state, and `getScannerStatus` reports it as `pause.reason = 'offline'`, plus `online` from `navigator.onLine`. The UI then says "You're offline", not "Bandcamp asked Dighead to slow down". The flag clears on the next successful request.
- **Back-off:** honour `Retry-After` (seconds or an HTTP date). Without it, wait 60 s and double the wait after each consecutive throttled request, up to 1 h. The first successful request resets it. The pause lives in `chrome.storage.local` (`scanner` key), so it survives a killed worker and a browser restart.
- **Lock:** `chrome.storage.local` holds the lock as `{owner, heartbeatAt}`, with the heartbeat refreshed before every request. A lock older than 45 s is treated as left behind by a dead worker. Only one worker instance exists at a time, so in practice this only matters after a kill: the queue resumes on the first 1-minute alarm after those 45 s, usually within 1–2 minutes.
- **Supporter paging:** the first page (up to 80 thumbs and 6 reviews) comes free with the release page. After that, **thumbs come first, then reviews**, 100 per request (fewer for the last one), until the cap. Thumbs are the most recent buyers, which is what the cap means ("500 most recent").
- **Supporters are owners.** Each supporter gets an `ownership` row for the release (`source = collection`, `addedAt` from the token, as in §3.7). That way a fan counts as an owner even when the release falls outside their newest 2,000 items. An existing row is never overwritten.
- **Fan status** after a scan:
  - `quick` (added 2026-10-21, §12): only the quick read is in and the full scan is still queued. Also bought counts them, twins don't.
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
  - The event carries one field more than the spec, `listed`, so the UI can tell "not fetched yet" (0 / 0, false) from "no supporters" (0 / 0, true).
- **Known limitation:** a re-scan after 30 days adds new items but doesn't remove items a fan no longer has. That's rare, and harmless for scoring at this scale.

### Add release to queue (Phase 5.7)

A "scan supporters" button on each Also bought row sends `queueRelease { itemKey, url }`, which queues that release's job at BACKGROUND priority (never above the page you're reading). Fresh supporter lists (7 days) are reported as "scanned recently" and not re-queued; a job already waiting isn't duplicated, though it moves up from SEED. We chose the row button over a popup URL field because the rows are where you already spot interesting releases, and they carry the item key and url, so there is no URL parsing to get wrong. Twins-who-own-this rows list fans, not releases, so they get no button.

## 6. Also bought (Phase 4)

Code: `src/scoring/alsoBought.ts` (pure), `src/db/repo/alsoBought.ts` (gathering), `src/background/recommend/` (running it). Decided 2026-10-20.

### Match index: the risk-checkpoint fallback, applied up front

- **Measured first.** Reading the raw `ownership` rows of 300 supporters (300k rows) took about 1 s in fake-indexeddb, so plain index reads miss the 200 ms target before scoring even starts. The ROADMAP's P4 fallback ("precompute per-item owner counts") is therefore built in from the start, as schema v3:
  - `fanMatches`: each fan's distinct collection matchKeys, one record per fan.
  - `matchOwners`: per matchKey, how many fans' collections hold it.
- **They're derived from `ownership` and never drift from it.** Every ownership write (`putOwnership`, `removeOwnershipExcept`, `addSupporterOwnership`) recomputes the touched fans' lists from their rows in the same transaction (`refreshFanMatches`). Wishlists don't count as owning. The v3 upgrade builds both tables from existing rows.
- **Each record also holds `trackIds`** (the album tracks the fan owns) **and `partialIds`** (the matchIds they hold only through tracks). Only twin overlap reads them (§7). Both are empty for a fan who buys whole albums. Added in schema v6, whose upgrade rebuilds every record from `ownership`.
- **Keys are stored as numbers.** `keyToNumber` maps albums to `+id` and tracks to `−id`, and each fan's list is a sorted `Float64Array`. Strings cost about twice as much to read and count, and made garbage collection the bottleneck in a big heap.
- **The roadmap's "move scoring to an offscreen document" wasn't needed.** A re-score takes 39 ms at 300k rows and 88 ms at the caps (500 supporters × 2,000 items, about 1M rows), both in fake-indexeddb, which is slower than Chrome's IndexedDB. Check: `pnpm perf` (`tests/perf/`, kept out of `pnpm test` because it seeds for ~10 s). An earlier string-based version measured ~580 ms at full size; part of that gap was the test seeding everything in one huge transaction, which fake-indexeddb handles badly.

### Scoring

- **Supporters N** = fans other than you who own the release's matchKey (from the `ownership.matchKey` index, so track buyers and album buyers alike) **and whose collection has been read** (`done` or `partial`). Queued, private and failed fans don't count, so "7 of 32 supporters" always means 7 of the 32 we can actually see.
- **co(i)** = how many of those N lists contain i. Each list holds distinct matchKeys, so a fan with two tracks of an album counts once. Drop co < 2.
- **Lift uses the local base rate:** `lift = (co / N) / (owners(i) / population)`, where `owners(i)` comes from `matchOwners` and `population` is every fan with a known collection apart from you. This overrides the spec's unstated base rate. Bandcamp-wide counts would need the total number of Bandcamp fans, which we don't know, and they'd rank your own scene's staples high everywhere. Local lift answers "more common among this release's buyers than among everyone you've dug through". With only one release scanned, lift is about 1 for everything and the ranking falls back to plain co.
- **Lift is capped at 10**, then `score = co × ln(1 + lift) × (1 + 0.5 × twinShare(i))`. The twin boost is below.
- **Pruning:** candidates come in falling co order, and owner counts are fetched 200 at a time. No candidate can score more than `co × ln(1 + 10) × (1 + 0.5 × s)`, where s is the highest twin share among the candidates, so the loop stops as soon as the next candidate's ceiling is below the 30th-best score. Inside a chunk, candidates whose own ceiling can't reach the list are skipped. In the perf data that means 200 lookups out of ~46k candidates.

### Twin boost (Phase 5)

Code: `twinBoosts` in `src/scoring/alsoBought.ts`; `gatherAlsoBought` reads the twin scores. Decided 2026-10-20.

- **Only twins among the release's scanned supporters count.** They are the fans whose collections the co-counts come from, so the boost says "some of these co-owners are people whose taste matches yours". A twin who doesn't own the release says nothing about its buyers, and leaving them out means no extra reads.
- **twinShare(i) = min(1, Σ score(F) / score(best twin))** over the twin supporters F who own i, using every twin on the stored leaderboard (top 200, §7). Your closest twin alone, or two twins half as close, gives the full share. Dividing by your best twin's score keeps the boost independent of how big twin scores happen to be, which varies with collection sizes.
- **Multiplier `1 + 0.5 × twinShare`, so at most ×1.5** (`TWIN_BOOST_MAX`). It's multiplicative so it scales with the evidence: at the same lift, a release your twins own can pass one with up to 1.5 times as many co-owners, never more. Bounded, so twins re-order close calls without drowning out what the supporters as a whole bought. Twins flagged as label clusters already carry ×0.3 in their score, so they barely move anything.
- **The reason line says so:** "7 supporters have this so far, 2 are your twins". It leaves out how many supporters were scanned: "so far" says the count can grow without the technical detail.
- **Cost:** none measurable. `pnpm perf` now also seeds a full 200-twin leaderboard with 50 twins among the 300 supporters, and medians were the same with and without it (~70 ms on a loaded machine).
- **Filters:** the release itself, hidden releases, releases you own or wishlisted *as a whole*, and albums you own a track of (§3.8). Wishlisting a single track keeps the album in.
- **Display:** rows point at the album. If no scanned collection holds the album itself, only tracks of it, the row shows one of those tracks (title and link) until the album turns up. The reason line doesn't say whether owners bought the album or only tracks.
- **`weights.ts`** implements `w(i)` and `supporters(i)` (album count, then track count, then owners we've seen). Phase 4 only uses `supporters(i)`, to order fallback picks. `w(i)` is for twins and For you.

### Small-release fallback

- A release counts as **small when fewer than 8 fans other than you are known to own it**, scanned or not.
- Small releases get **same-artist and same-label picks** from the local `items` table: other releases with the same selling account or the same `labelId`. Same seller and same artist name means "More from this artist". Same seller with a different artist name means the account is a label's, so "From the same label". A matching `labelId` reads "Also on <label>".
- Album tracks are skipped. Order: same artist first, then by `supporters(i)`, highest first. These picks come after the co-owned ones, up to 30 rows in all.

### Re-scoring and the message bus

- The worker scores on request (`getAlsoBought`, when the sidebar opens or after a hide). It also re-scores **watched releases** (the ones open in tabs, §5) after every 5 supporters scanned, after the last supporter, and when the supporter list is complete. Results go out as the `alsoBought` event. The 5-fan counter lives in memory, so a killed worker restarts it from zero.
- `releaseOpened` now carries the page's parsed `ReleasePageItem`, and the worker saves it. Scoring and the fallback therefore know the release before its scan job runs, even while the queue is paused.
- **Hidden releases** live in the `hidden` store, keyed by matchKey (so hiding an album hides its tracks too). Every scorer must respect them. There's no "unhide" yet; that's Phase 7 (popup).
- **Parser broken:** the scanner records the last `ParserError` as `parserError` in its state. It's cleared when a job of the same kind succeeds, so one odd page doesn't look like a broken parser for good. The sidebar shows "Parser broken" in place of an empty list, or as a notice above existing rows. The popup shows it too.

### Gaps

- **Wishlist from the sidebar isn't wired up.** Adding to a wishlist needs a logged-in Bandcamp API call that we haven't captured, so rows have no wishlist button; *Open in a new tab* gets you to Bandcamp's own. To add one, capture the request Bandcamp sends when you click Wishlist on a release page (logged in) and save it as a fixture.
- **Track-only buyers of an album aren't listed as its supporters** (§3.8). This is still unmeasured: watch for albums whose supporter list looks small next to their `also_collected_count`.
- **Preview plays in our own `<audio>`, not Bandcamp's EmbeddedPlayer** (changed 2026-10-21). The embed is a cross-origin iframe, so we couldn't start it from the Preview click or give it a seek bar. Now the worker fetches the release page (`getPreview`) and reads each track's `file["mp3-128"]` from `data-tralbum`. Those URLs are signed and expire, so they're fetched when a preview opens, never stored. Playback starts at `featured_track_id` and moves on to the next track at the end. Media loads aren't subject to CORS, so the content script plays the bcbits.com stream directly.

## 7. Taste twins (Phase 5)

Code: `src/scoring/twins.ts` (pure), `src/db/repo/twins.ts` (gathering and storing), `src/background/recommend/twins.ts` (running it). Decided 2026-10-20.

- **Score** = Σ w(i) over the shared releases / √(|M|·|F|), where |M| and |F| are the two `fanMatches` lists (collection only, tracks folded into albums). w(i) uses the album's `supporterCount` first, then a track's, then `matchOwners`. Raw overlap and Jaccard are stored alongside.
- **Shared releases** (`sharedReleases`, changed 2026-10-21): a matchKey you both hold counts when you share the exact item, or one of you owns the album and the other a track of it. **Two different tracks of one album don't count.** Before this, they did (§3.8), and a fan who mostly buys single tracks showed far more in common than Bandcamp's own "in common": for one real fan, 60 against Bandcamp's 21, where 39 of the 60 were albums each side only had different tracks of. With this rule the same pair comes out at 30. The rest of the difference is deliberate: we still count an album against one of its tracks (10 here), and count two shared tracks of one album once. It's computed from the `trackIds` and `partialIds` lists (§6): drop the matchKeys that are in both partial lists unless the two `trackIds` lists share a track of that album.
- **|F| is what we've scanned**, so a collection capped at 2,000 items is compared on its newest 2,000. The size filter uses `collectionSize` once known (a `done` scan), otherwise `scannedItems`. A capped fan's real size is unknown, so `maxCollectionSize` can't catch them yet.
- **Candidates** are fans whose collection was read (`done` or `partial`), as for Also bought. Private, queued and failed fans are left out.
- **Label** = `labelId ?? bandId` (§3.3). A label's catalog is its distinct matchKeys in the local `items` table. Only the labels of releases you own are looked up, since only they can carry an overlap.
- **Label-cluster flag:** more than 50% of the overlap from one label, the fan owns more than 60% of that label's local catalog, **and at least 3 shared releases come from that label**. The last rule is new: local catalogs start tiny (often one release), so one shared release would otherwise flag everyone who owns it. Flagged twins are multiplied by 0.3 when `labelClusterDownweight` is on, and the flag is stored either way.
- **The leaderboard keeps the top 200**, replaced in full on each recompute. Fans are scored 500 at a time with a yield between pages.
- **Recompute triggers:** after each finished sync of your own collection, after every 25 fan scans (an in-memory counter, lost with the worker), and on install or update. Only one runs at a time; a trigger during a run queues one more pass.
- **"Twins who own this" (sidebar tab):** leaderboard twins with the release in their collection, by its matchKey, so track buyers count and wishlists don't. Any owner counts, not just listed supporters, since owners come from every scanned collection. Rows show the twin's leaderboard rank, name, overlap and profile link. The list is pushed with each Also-bought re-score (`releaseTwins` event), so it doesn't refresh on its own after a twins recompute until the next scan step or page load.

### Profile tabs (Phase 5.5)

Code: `src/content/profile/`. Decided 2026-10-20, tried against `me-fan-page.html` with Bandcamp's real CSS and a stand-in for its tab script. Not yet tried on the live page with Bandcamp's own JS.

- **Your own page** is told apart by `fan_data.is_own_page` in `#pagedata` (`isOwnFanPage`), not by comparing usernames.
- **The tab handle is light DOM**, an `<li class="dighead-tab"><a class="tab-title" href="#twins">` appended to Bandcamp's `#grid-tabs`, so Bandcamp's CSS styles it exactly like its own tabs. It's the one exception to "injected UI lives in a shadow root". It has no `data-tab`, and clicks on it stop at the `<li>` (`stopImmediatePropagation`) so Bandcamp's tab switcher never sees them. The tab content renders in a shadow root in a slot right after `.grid-tabs-anchor`, kept at the tab list's width by a ResizeObserver because Bandcamp's grid width steps with the viewport.
- **The hash is the state.** The link sets `#twins` itself (a history entry, so Back works), `hashchange` opens and closes our tabs, and a direct `#twins` link opens it on load. Clicking one of Bandcamp's tabs drops the hash with `replaceState` and hands the `active` class back to the tab that had it, in the capture phase, before Bandcamp's handler runs.
- **While ours is open**, a class on `#grids` hides every `.grid` and `.owner-controls` through one injected `<style>`. Bandcamp's selectors live in `bandcamp/fanPageDom.ts`.
- **% match is Jaccard**, shown as a percentage. The roadmap's columns (overlap, % match, score) and sorts (overlap, Jaccard, score) are the same three numbers. Sorting is one-way, best first; ties keep leaderboard order.
- **A new tab** (For you) is one entry in `PROFILE_TABS` in `ProfileApp.tsx`: an id, a lowercase label and a view component. Views mount when their tab opens, so each opening fetches fresh data.
- **Gap:** the leaderboard doesn't update live while open. Reopen the tab or reload after a recompute.

### For you (Phase 6)

Code: `src/scoring/forYou.ts` (pure), `src/db/repo/forYou.ts` (gathering), `src/background/recommend/forYou.ts` (running it), `src/content/profile/forYou/` (the `#for-you` tab). Decided 2026-10-20.

- **Twins** are the top `settings.topTwinsK` (default 30) of the stored leaderboard, ties on fanId. Their `fanMatches` lists are what's counted, so tracks fold into albums and wishlists don't count, as everywhere else. Label-cluster twins carry their ×0.3 in their score.
- **Filters** are `scoring/exclusions.ts`, as for Also bought: hidden releases, releases you own or wishlisted as a whole, and albums you own a track of (§3.8).
- **w(i)** uses the shown record's `supporterCount` (the album's, or a track's when only tracks of the album have turned up), else `matchOwners`. It doesn't look for a track's count when the album record exists without one.
- **Pruning:** w(i) ≤ 1, so a candidate's summed twin score is its ceiling. Candidates come in falling twin-score order, 200 at a time, and the loop stops once the next ceiling is below the 60th-best score. 60 (twice the 30 shown) leaves room for the diversity rule to move an artist's extras down without leaving rows empty. Candidates with no item record are dropped before ranking, since they can't be shown.
- **Rows** show their place in the list, cover, artist · label, "owned by N of your top twins", and the same preview / wishlist / open / hide buttons as Also bought (one shared `ReleaseRow` in `src/ui/`). Wishlist still opens the release page (§6, Gaps). Hide drops the row at once and re-fetches, so the next pick moves up.
- **Empty states** reuse the twins basis (`no-viewer`, `unsynced`), then "no taste twins yet" (no leaderboard) and "nothing new from your twins", both linking to `#twins`. A scanner `ParserError` shows as a notice above the rows, or in place of them when there are none.
- **Scored on request**, each time the tab opens. Nothing pushes updates while it's open, as with the Twins tab.

### Twin badge on other fans' profiles (Phase 5.6)

Code: `src/content/fan/`, `getTwinStanding` in `background/recommend/twinStanding.ts`. Decided 2026-10-20, checked against the fixtures' markup; not yet tried on the live page.

- **Mount:** page kind `fan` (anyone but you). The badge goes at the end of the header's `.name` block, under the `<h1>` (`FAN_PAGE_DOM.name`, which skips the hidden edit-mode copy of the bio), in a shadow root.
- **Whose page:** `parseViewedFanId` reads `fan_data.fan_id` from the `#pagedata` element only, so the tab doesn't parse the whole collection.
- **Lookup:** `getTwinStanding { fanId }` finds the fan in the stored board and answers `{ rank, overlap, matchPct }`, or null. The tab never receives the board. `rank` is the position in `getTwins`, as everywhere else; `matchPct` is Jaccard × 100.
- **Text:** "your #4 twin · 37 in common". The tooltip (a real `<button>` is the trigger, so it takes keyboard focus) gives the rank, the overlap and the % match with its definition.
- **Not on the board shows nothing**, rather than "not in your twins yet". The board holds only the top 200, so "not a twin" would be wrong for a fan we've scanned who ranks 201st, and a note on every stranger's page is noise. Loading and errors also render nothing (no layout jump); errors are `console.warn`ed.
- **Gap:** the badge looks up once on load. A twins recompute while the page is open isn't pushed to it.

## 8. Following tags (planned)

Planned 2026-10-20; data source verified the same day. Roadmap: *Following tags*.

You create your own tags and assign them to the fans, artists and labels you follow. Then you filter your followings by tag. **Tags apply only to followings** (and, since §14, to releases in your wishlist), not to twins, supporters or other fans you don't follow.

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

- Followings are part of your own sync (§4): paced and off the budget.
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
- messages, named like the rest of `shared/messages.ts`: `listTags`, `createTag`, `renameTag`, `deleteTag`, `assignTag` (many keys, add or remove), `listFollowing`, `getFollowTags { kind, id }`, `exportTags`, `importTags`, and `getTwinStandings { fanIds }`, a batched `getTwinStanding`, so a list of fans is one message
- hooks `useFollowing(tagIds, mode)`, `useTags()`, `useFollowTags(kind, id)`

### UI: Bandcamp's following tab, modified

We change Bandcamp's own **following** tab on your profile instead of adding a tab of ours, and reuse its cards.

- **Why not decorate only Bandcamp's loaded rows:** it renders them 20 at a time, behind "view all N" and scrolling. A tag filter over whatever happens to be loaded would be wrong, and making Bandcamp load all of it is slow and fragile.
- **So we render the whole list in Bandcamp's markup:** inside `#following-grid`, Bandcamp's sub-tab bar (artists & labels / fans / genres) stays. In the artists & labels and fans containers, we hide Bandcamp's `ol.followeer-grid` and `.expand-container` (so its paging never runs), and insert our own `ol.followeer-grid` before them. It holds every following row from the DB as a light-DOM `li.followeer` built by `followCard.ts`. Bandcamp's CSS styles the cards, and its handler runs their follow buttons. The genres sub-tab is untouched. Selectors live in `FAN_PAGE_DOM`.
- **Card details:** the avatar is `https://f4.bcbits.com/img/<image_id, 10 digits>_41.jpg` for fans and bands alike. The link is `trackpipe_url` for fans and the band's subdomain or custom domain for bands.
- **Our additions sit in shadow roots:** the filter bar sits above our list. Each card gets one small host element holding its checkbox, tag chips, "+ tag" and, on fan cards, twin rank ("#4 twin"). The card itself must stay light DOM, because events from inside a shadow root don't match Bandcamp's `.followeer .follow-unfollow` selector. That's the one exception to "all injected UI in a shadow root". One React root renders into every card's host through portals, not one root per card.
- **Filtering** hides non-matching cards (`hidden`) instead of re-rendering, so Bandcamp's button state stays put.
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

- On a fan page you follow, next to the twin badge, and on an artist's or label's pages (release pages via the publisher's `band_id`, §3.3, and the band's home page), show your tags as chips with "+ tag".
- Shown only when you follow the account, since only followings can be tagged. Not following shows nothing.

### Backup

- **Tags are hand-made and a re-sync can't rebuild them**, so a JSON export/import of tags is part of the feature. The file holds tag names and `[kind, id]` assignments. Import merges by `nameKey` and skips assignments to accounts you no longer follow.

## 9. Popup controls and storage (Phase 7)

Code: `src/popup/`, `src/shared/settings.ts`, `src/background/maintenance.ts`, `scripts/estimate-storage.ts`. Decided 2026-10-20.

### Popup v1

- **Two tabs:** *Status* (your sync, queue progress, today's budget, pause/resume) and *Settings* (pace, caps, twins thresholds, Clear all data).
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
- **Daily cleanup** (`maintenance` alarm, every 24 h): fans with `lastSeenAt` over 180 days ago (`FAN_FORGET_MS`) are deleted with their `ownership` rows, their match-index entries (`refreshFanMatches` drops the list and lowers `matchOwners`), their twin rows and any queued fan job. You are never forgotten, even if you were once listed as a supporter. It runs 100 fans per transaction, and recomputes twins when anything went.
- **Left alone:** `items` (cheap, and still describe releases others own) and old `releaseSupporters` lists that still name forgotten fans. Such a list is over 7 days old, so opening its release re-fetches and replaces it; until then its progress counts those fans as not scanned.


## 10. Full database backup

Code: `src/db/backup.ts`, `src/shared/backupFile.ts`, `src/shared/backupStaging.ts`, `src/background/backupHandlers.ts`, `src/popup/DatabaseBackup.tsx`. Decided 2026-10-21.

- **Why a library:** `pnpm storage:estimate` puts a heavy user at ~4 GB (§9), far too much for one JSON string in the worker. `dexie-export-import` 4.4.1 (published 2026-09-10) streams rows into a Blob, which Chrome keeps on disk. The file is its format: `formatName`, `formatVersion`, `databaseVersion`, every table's rows (typed arrays such as `fanMatches` included). It has no export time; the date is in the filename.
- **Validation:** `backupMetaSchema` (zod) checks the header. Then the file is read end to end without writing anything, counting rows per table against the header, because the library doesn't notice a file cut short. A corrupt or foreign file changes nothing. A backup from a newer schema version is refused with an "update the extension" message. Older ones back to `OLDEST_RESTORABLE_VERSION` (v5) are imported, then their rows are migrated as Dexie's upgrades would have done (`migrateRows` in `db/backup.ts`: before v7 it rebuilds the `fanMatches` lists, which brings both v6's track lists and v7's purchase times, and blanks the lately fields on stored twins), inside the write phase so a failure rolls back to the snapshot. Tables added since the file's version (`TABLES_ADDED` in `schema.ts`, e.g. v7's `latelyTwins`) may be missing from it. Anything older is refused. A schema bump that changes row shapes must add its step to `migrateRows`.
- **All or nothing by snapshot, not one transaction:** the library only keeps an IndexedDB transaction open across file reads with `FileReaderSync`, which service workers don't have (so `db/backup.ts` also shims `FileReader` with `Blob.arrayBuffer()`). Import therefore runs: read-through (above), then export the current data to `backup-snapshot.json` in OPFS, then clear and write, and on any failure write the snapshot back and delete it. If the snapshot can't be saved (disk full), nothing was touched. If the restore itself fails, the snapshot is kept and the error says the old data couldn't be restored automatically. Chosen over an offscreen document with a dedicated worker, which would add a manifest permission, a second runtime and a Blob-less handoff, for the same guarantee.
- **Disk cost:** at the ~4 GB heavy-user size an import briefly holds the staged file, the snapshot and the new database: roughly 3x the database size free, on top of what the old data uses. Short of that, the snapshot step fails cleanly.
- **Scanner pause:** import sets `importing` in the scanner state (reason `import` in `pauseFor`, so your own `paused` flag is never touched), waits for the loop's lock to be released so the request in flight finishes, and for your own sync to settle, then lifts it afterwards however the import ended. The scheduler re-checks the pause after its pace wait. A sync that starts during the import isn't blocked.
- **Handing the file over:** runtime messages are JSON, so a Blob can't travel in one. The popup and worker share the origin-private file system: export stages `backup-export.json` and the popup saves it through a blob URL; import stages `backup-import.json` from the chosen file and the worker reads it. Both are deleted afterwards.
- **What's replaced:** every table, `me` included, exactly as exported. Settings, pause and today's budget stay. After an import the watched-release list and scanner errors are cleared and twins are recomputed.
- **Crash recovery:** the import records its phase in `chrome.storage.local` (`import` key): `snapshotting` → `writing` → `cleanup` → cleared. On worker start, before the scanner or any sync runs (the import flag a dead worker left behind holds them off), `recoverInterruptedImport` acts on it: `writing` restores the snapshot and deletes it; `snapshotting` deletes the partial snapshot (old data was never touched); `cleanup` deletes the snapshot (the import had succeeded). No phase but a snapshot present, which is a restore that failed earlier, is only reported, so startup can't loop on it. A failed restore keeps the snapshot. Every branch lifts the import flag, and the outcome shows once in the popup's Full backup row until dismissed.
- **Sync during an import:** `runSync` returns at once while the import flag is set. Skipped, not queued: every trigger (startup, page view, purchase page, Re-sync) goes through `startSync`, and the next one syncs as usual.

## 11. Lately twins

Code: `src/scoring/lately.ts` (pure), lately parts of `src/scoring/twins.ts`, `src/background/recommend/twins.ts` (both boards in one pass), `src/content/profile/twins/` (the switch). Decided 2026-10-21.

- **Why:** two fans can share 100 releases they both bought four years ago and little since. The all-time score can't tell that apart from being in step now, because it ignores when anything was bought.
- **Purchase times** come from `ownership.addedAt` (collection pages' `purchased`, or the supporter token's timestamp, §3.7). **Schema v7** stores them in `fanMatches.matchTimes`, parallel to `matchIds`: the newest purchase under each matchKey (buying the album after a track means it's on your mind now), 0 when no row is dated. The upgrade rebuilds `fanMatches` from `ownership` (`rebuildFanMatchLists`, shared with v6). Undated purchases count as old.
- **Fade:** each purchase counts 2^(−age / half-life), with the half-life `latelyHalfLifeMonths` (default 6, a setting). Four years at 6 months is 2⁻⁸.
- **Score** = Σ w(i) × fade(yours) × fade(theirs) × coTiming over shared releases (the same `sharedReleases` as the all-time score, so two different tracks of one album don't count, §7), divided by √(Dₘₑ · D_them), where D is a collection's faded size (Σ fade). It's the all-time score with every purchase weighed by age, so old overlap and an old back catalogue both drop out. The label-cluster factor applies as for `score`.
- **Co-timing:** a release you both bought within 60 days of each other counts up to ×1.5 (same day), falling linearly to ×1 at 60 days. Buying the same thing at the same time is the strongest "same mood" signal. Hype releases everyone buys on day one are already damped by w(i).
- **Too little to go on:** a fan whose faded size is under `latelyMinPurchases` (default 5, a setting) gets no lately score (`null`). Without it, a fan with one recent purchase that you also own would top the board, and a near-zero D would blow up the score. Your own D only needs to be above 0; it's the same for every fan, so it doesn't change the order.
- **Trend:** the same score taken a year ago (`yearAgo`), with only purchases made by then, faded to then. `converging` above ×1.25 of it, `drifting` below 1/1.25, else `steady`; `new` when they had no score a year ago, `quiet` when they have none now. Shown as "↑ closer", "→ steady", "↓ apart", "new", "quiet" on both boards.
- **This year** (`latelyOverlap`): shared releases you both bought within the last 365 days. It's also the bar for the Lately board: a fan needs a lately score **and** at least one such release. Old overlap alone still scores a sliver above 0, which would fill the bottom of the board with noise.
- **A second table, `latelyTwins`,** holds the top 200 by lately score from the same recompute pass (one intersect per fan feeds both). The all-time `twins` table and everything that reads it (For you, Also bought's twin boost, twins who own this, profile badges) are unchanged; its rows just carry the lately fields too, for the trend column.
- **Limits:** fans are re-read every 30 days (§5), so a fan's last month of purchases may be missing; the 6-month half-life keeps that from mattering much. The top lately twins are re-read weekly (below). Bandcamp Friday sprees aren't capped.
- **For you, Fresh** (`src/scoring/fresh.ts`, decided 2026-10-22): an *All time / Fresh* switch on the For you tab. Fresh takes the top `topTwinsK` of `latelyTwins` (twins with no lately score left out), and each of their purchases from the last 365 days adds lately score × fade(purchase), with the same `fade` and `latelyHalfLifeMonths` as the lately score. Older and undated purchases don't count at all, so Fresh never fills up with back catalogue. Fade ≤ 1, so the summed value is still the ceiling, and scoring, w(i), exclusions (§7's For you filters), pruning and the diversity rule are All time's unchanged. Rows say "bought by N of your lately twins · latest 3 days ago" (the newest of those purchases). Empty with no lately twins says so and points to All time. No co-timing bonus: it's about you and a twin buying the same thing, and Fresh picks are things you haven't bought.

### Re-reading top lately twins, and Twins' latest

Code: `src/background/scanner/latelyRescan.ts` (selection, pure), `fanLatestStep.ts`, `src/scoring/twinsLatest.ts` (feed, pure), `src/background/recommend/twinsLatest.ts`, `src/content/profile/latest/`. Decided 2026-10-22.

- **Who and how often:** the top `latelyRescanTwins` of the Lately board (default 25, 0 turns it off) are re-read when their last read is `latelyRescanDays` old (default 7). Both are settings with popup controls. Everyone else keeps the 30-day re-scan (§5). The daily maintenance pass (§9) queues what's due, so in practice a twin is re-read every 7 to 8 days. A twin with any scan already queued is skipped (that scan reads their newest purchases anyway), and so is one without a full read on file (`done` or `partial`).
- **A latest read, not a full re-scan:** a fan job whose cursor starts at the new `latest` stage reads the collection from the top, `collectionBatchSize` items a request, and stops at the first page holding a purchase from before the last read (less a day of overlap, for purchases Bandcamp lists late), or at the end, or at the collection cap. A twin who bought fewer than 100 things that week costs one request instead of up to 20. It counts as a fresh read (`collectionFetchedAt`), keeps the fan's status, and adds the purchases it hadn't seen to `scannedItems` and `collectionSize`. No schema bump: the cursor is data, not an index.
- **Failures:** a `{"error": true}` page ends the read and keeps the collection on file, rather than marking a long-read twin `private` over one refused page. A dropped latest read leaves the fan as it was, not `error`, so they stay on the boards and the next round tries again.
- **Queue place:** priority `LATELY_RESCAN = 2.5`, between releases you opened (2) and the seed backlog (3): it never delays a page you're looking at, and isn't held up for days behind a large seed backlog. A fraction, so SEED's stored value needn't migrate. Jobs are due from when they were queued, ranked by board place, so the closest twin goes first. They go through the same loop as every job, so pace, back-off and the daily budget apply unchanged. Cost: about 25 to 50 requests a week at the defaults, well under 1% of one day's budget.
- **Twins' latest** is a fourth profile tab (`#latest`), next to Twins and For you. It lists releases bought in the last 60 days (`LATEST_WINDOW_DAYS`) by your top `topTwinsK` lately twins, then the top `topTwinsK` all-time twins not already in, newest purchase first (a tie goes to the release more twins bought), at most 50. Each row names who bought it, lately board first, and when the newest of them did. It reads `fanMatches.matchTimes` (the newest purchase under each matchKey, §11 above), so no new index: owned, wishlisted and hidden releases are left out as in For you (`exclusions`), albums you own a track of are left out (§3.8), and undated purchases never show. While any of those twins has a scan waiting, the tab says it's checking them.

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
- **Bandcamp computes it over both full collections**, which our local overlap can't. It counts differently from our twin overlap (one real fan: Bandcamp 21, ours 30, §7), which is fine for ranking.
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
  - **Seed scans skip passes 1 and 2** (deviation): seed fans fill twins, not a page you're looking at, so they go straight to the full scan and spend no extra requests. They still get pass-0 order. If you open the release, `focusRelease` lifts their jobs, but a seed job that has started its full scan carries on as it is.
- **Pass 2, quick read:** one `collection_items` request for 100 items with `older_than_token = "<purchase + 90 days>::a::"`, the purchase being the supporter token's time on their row for the `via` release. The fan gets the new status **`quick`**: Also bought and release progress count them (`collectionRead`), twins don't (`collectionFullyRead`, also behind the Twins tab's "fans read" count), and `collectionFetchedAt` stays unset, so a fan whose job is lost is queued again later.
  - Read from the top instead when the anchor would be now or later (a purchase in the last 90 days), when there's no known purchase, or when the profile says the whole collection fits (`item_count ≤ 100`). A top read that reaches the end is the full read (`done`); one that doesn't hands its next token to the full scan, so nothing is read twice.
  - The step reports `read`, which re-scores watched releases and sends progress like a finished fan, but doesn't count toward the twins recompute.
- **Full scans follow in the same job** (one job per fan, `&[kind+target]`): after the quick read it moves to `max(priority, BACKGROUND)` with rank `FULL_SCAN_RANK + its rank`, so it runs after every quick read and profile of releases at that priority, best match first, and twins and For you get the whole collection in the end. An anchored quick read means the full scan re-reads those items from the top: one extra request per fan, against up to 20 saved before the first useful rows.
- **Steps report what changed** (`StepResult`: `continued`, `read`, `finished`), so the scheduler stays one request per run.

Measured by tests, not yet on the live site: `supporterPasses.test.ts` runs passes 1–2 end to end on a fake bandcamp.com, and `releaseJob.test.ts` checks pass 0 puts a fan who owns one of your releases first.

### Original plan

1. **Pass 0, free.** When the supporter list is in (the release job already reads all of it before any fan, §5), rank every supporter by what we already know they own of yours: supporter lists of your seeded releases put rows in their `fanMatches` before their collection is read. Weight by w(i). Bonus for owning other releases from this release's seller or label. Fans read recently skip pass 1 and get their overlap from our own data. With nothing known (logged out, nothing seeded), keep page order. The queue needs a `rank` tie-break within priority, since `nextAttemptAt` is the order today.
2. **Pass 1, one fan page per supporter**, in pass-0 order, signed in (`credentials: 'include'`, unlike release pages, §5). Rank by Bandcamp's count scaled by both collection sizes (count / √(yours · theirs)). Logged out, fall back to pass 0's ranking.
3. **Pass 2, collections, best match first.** The quick read is 100 items anchored a few months after the fan's purchase of this release. Full scans follow at background priority for twins and For you. Low-overlap fans can stop at the quick read, which saves most of today's up-to-20-requests-per-fan cost. A quick-read-only fan needs a new status, and twins must leave them out until their full scan.

Doing pass 1 for all 500 supporters before showing anything would take about 19 minutes and 500 requests. Pass 0 decides which fan pages go first, and results show early.

### Scoring and the wait

Built 2026-10-21. Code: `src/scoring/alsoBought.ts` (`wilsonLower`, `voteWeight`, `coOwnerVotes`, `isConfident`, `warmup`), `gatherAlsoBought`, `computeAlsoBought`, and `WarmupProgress` in the sidebar.

- **Confidence:** lift's share among supporters is now the Wilson lower bound on votes / N (`CONFIDENCE_Z = 1.645`, one-sided 95%), not the raw share. 3 of 8 (0.375) comes out at 0.16, 30 of 80 at 0.29, 300 of 800 at 0.35. The lift cap (10) and `score = votes × ln(1 + lift) × twin boost` are otherwise as in §6. A side effect: in the §6 test data, a staple 8 of 10 supporters own now ranks above a release 4 of them own, since more owners means less shrinkage.
- **Omnivores:** each co-owner's vote is `voteWeight(size) = min(1, √(FULL_VOTE_ITEMS / size))` with `FULL_VOTE_ITEMS = 250`: 1,000 items count 0.5, 2,000 items 0.35, 4,000 items 0.25. Votes replace co in both the share and the score; the reason line still shows the plain owner count. √ rather than 1/size because owning a release by chance grows with collection size, but 1/size would discard most of what a big collector says; it's also the damping the twin score and the planned fan-page ranking use. Capped at 1 so votes never exceed co, which keeps co-based pruning valid (`scoreCeiling` is unchanged). Size is `max(fanMatches length, collectionSize ?? scannedItems)` for now; once the scan side stores `item_count` from fan pages, use that.
- **Votes are counted only for candidates being scored**, by binary search in each supporter's sorted list, chunk by chunk. `pnpm perf` median: ~59 ms (with the supporter list stored, so it measures shown co-owned rows).
- **Warm-up:** co-owned rows are held back until `WARMUP_SUPPORTERS = 20` supporters are read (or every listed one, if fewer) **and** `WARMUP_ROWS = 5` of the top rows pass the confidence bar, which is a cautious lift of at least `CONFIDENT_LIFT = 2` (`isConfident`). It also ends once every listed supporter's scan has ended, read or not, so private fans can't hold it forever. "Read" is N, the supporters whose collection has been read; "listed" is the release's stored supporter list, so the warm-up waits for that list before it knows its target.
- **During the warm-up**, `AlsoBoughtResult.warmup` holds `{ read, readTarget, confident, confidentTarget }` and `rows` holds only same-artist and same-label picks, for any release (not just small ones). The sidebar shows "Reading supporters before picking", one bar filling over both targets, "12 of 20 supporters read · 3 of 5 strong picks", then the picks under "Meanwhile, from the same artist and label". Before the supporter list is in, it shows the existing "queued" / "scanner stopped" states instead of a bar. After the warm-up, small releases still get fallback picks after the co-owned ones (§6).
- **To tune:** all five constants. A first scan with a near-empty database has a population close to N, so lift sits near 1 and no row is confident: the warm-up then lasts until every supporter is scanned. Progress updates arrive with re-scores, every 5 supporters (§6).

### Tags (later)

- Re-rank only, never a candidate source: tag matches alone mean "sounds similar", not "fans also bought".
- First store `genre_id` and apply a mild penalty when it differs from the release's.
- Then fetch release pages for the ~30 shown candidates at low priority and keep their tags. Compare with the release's tags weighted by rarity across local items, so broad genres and place names barely count. Apply as a capped boost like the twin boost (about ×1.3) and name the shared tags in the reason line. Cost: about 30 requests per newly opened release, falling as tags accumulate.

### Done before building

- Saved a signed-in fan page as a fixture with personal data scrubbed (`fan-page-in-common.html`) and parsed the count from it. Text with a number in it that isn't the English pattern, or that mentions "common" without a count, throws `ParserError` rather than reading 0.
- **Still unchecked live:** how the line reads for a fan with no favourite genre. The parser accepts "8 items in common" without the genre, and "1 item in common", both covered by synthetic tests; capture a real one when it turns up.

## 13. Release sidebar follows the page design

- **Source:** album, track and band pages carry the artist's colours as JSON in `#custom-design-rules-style`'s `data-design` (`bandcamp/pageDesign.ts`): `body_color`, `text_color`, `secondary_text_color`, `link_color`, plus `bg_color` and others we don't use. Hex without `#`. We theme from `body_color`, the content column the release sits on; `bg_color` is the page around it and can be a tiled image.
- **Mapping** (`ui/theme.ts`, pure): background, text, muted and accent come straight from the design. Borders, hovers and subtle fills are mixes of text into background, so one rule works on light and dark pages. Tag, tooltip and status colours keep `tokens.css`. The tokens go on the shadow host as inline custom properties.
- **Readability guards:** text under 4.5:1 on the background means no theme (default look). Secondary text under 4.5:1 falls back to a text/background mix, and a link under 3:1 to the text colour. A missing or broken `data-design` also means the default look, not a `ParserError`: it's cosmetic.
- **Scope:** the release sidebar only for now. Band-page UI could take the same theme.

## 14. Wishlist tags

Decided and built 2026-10-22. Roadmap: *Wishlist tags*. Code: `src/content/wishlist/`, `db/repo/wishlist.ts`, `background/wishlistHandlers.ts`, `src/content/release/WishlistItemTags.tsx`. Tested on the fixtures (jsdom); not yet tried on the live wishlist tab.

The same tags as §8, on the releases in your wishlist, with the same filter (all / any, plus a search over artist and title), bulk tagging and backup.

### Data

- **One tag pool.** Followings and wishlist items share the `tags` table, so "dub" on an artist and on a release is one tag, with one colour. Deleting a tag takes it off both, in one transaction.
- **Schema v9 (additive):** `itemTags: 'itemKey, *tagIds'`, one `{ itemKey, tagIds }` row per tagged item. Not on `items`, which every scan rewrites, and not on `ownership`, whose wishlist row is overwritten when you buy the item. `TABLES_ADDED` lists it at 9, so a v8 full backup still restores.
- **What's in your wishlist** is your `ownership` rows with `source: 'wishlist'` (§4). `listWishlist` joins them with `items` for the release and `itemTags` for the tags, newest wishlisted first. `getItemTags` answers null for an item that isn't in your wishlist, so a release page you haven't wishlisted shows nothing.
- **Sync keeps tags.** A sync rewriting an item or its ownership row leaves `itemTags` alone. A **full** wishlist sync deletes the tags of items that left the wishlist, removed or bought, like unfollowed accounts losing theirs (§8). A hidden wishlist answers an error and returns early, so it keeps them. Until the next full sync, a bought item's tags just sit unused.
- **Backup:** the tags file is version 2, with an `items` list next to `assignments` in every tag. Version 1 files still import (no items). Import skips items not in your wishlist, as it skips accounts you no longer follow.

### UI: Bandcamp's wishlist tab, modified

- **Why take it over:** like the following tab, Bandcamp renders the wishlist 20 items at a time behind "view all", so a filter over what's loaded would be wrong.
- **Markup:** on your own page, `#wishlist-grid` holds `#wishlist-items` with an empty `ol.collection-grid` and `.expand-container` ("view all N items"); Bandcamp's JS fills the list when the tab opens. `#wishlist-grid` gets `active` while open, like every grid (me-fan-page.html). Selectors live in `FAN_PAGE_DOM`.
- **All ours, in one shadow root.** Following cards had to stay light DOM for Bandcamp's follow handler (§8). Wishlist rows don't need any Bandcamp handler, so the whole list is our own `Row`s inside one shadow root placed before Bandcamp's hidden list. No Bandcamp markup is copied, so its delegated handlers on collection items can't misfire on ours. The cost: no heart button to un-wishlist from the list; do that on the release page.
- **Lazy takeover:** the list is taken over the first time the tab opens, then stays mounted, filters and selection included. Bandcamp's own list comes back while ours can't stand in (worker unreachable, or empty and the sync hasn't finished, has failed, or hasn't seen you log in). The same rules as §8, from the shared `syncEmpty.ts`.
- **Each row:** select box, playable cover (our own preview player, one open at a time), title linking to the release, artist and "added 3 Oct 2026", then the tags and "+ tag", and "open in a new tab". Filtering re-renders the list rather than hiding rows, since no Bandcamp state lives in them.
- **Shared with the following tab:** `TagEditor`, `FilterControls`, `BulkBar`, the tag-bar CSS, `tagActions.ts` (`followTagHandlers`, `itemTagHandlers`) and the pure `tagFilter.ts`, which works over any rows through key, tags and text accessors.
- **Release pages:** when the release is in your wishlist, the sidebar shows "In your wishlist" with its tags and "+ tag", under the artist's tags (§8). Only the exact item: wishlisting an album doesn't tag its track pages.
- **Gap:** Bandcamp's own wishlist search box (`#wishlist-controls`) is left as it is and searches Bandcamp's list, not ours.

## 15. Page badges

Decided and built 2026-10-22. Roadmap: *Page badges*. Code: `bandcamp/pageLinks.ts` (+ `pageLinksDom.ts`), `db/repo/pageBadges.ts`, `content/badges/`. Tested on the fixtures (jsdom); not yet tried on live pages, and not at all on Discover or the feed, which have no fixtures (both render in JS, and the feed needs a login).

A quiet pill after release links anywhere on bandcamp.com: **owned**, **wishlist**, **3 twins**. Off by default; a toggle under *Pages* in the popup's settings. It's read when a page loads, so turning it on or off applies from the next page.

### Which links

- **A release link** is an `<a href>` whose path is `/album/<slug>` or `/track/<slug>`, on any host: artist subdomains, `bandcamp.com` itself, and custom domains linked from bandcamp.com. A link to a non-Bandcamp site with that path finds nothing in the DB, so it gets no badge.
- **Normalised URL:** `https://<host lowercased>/<album|track>/<slug>`, without query, hash or trailing slash, with relative links resolved against the page. That's the shape of `items.url`, which comes from collection `item_url` and the release page's `data-tralbum.url`.
- **Ids from the page when it has them, so no URL guessing there:** a fan page's `li.collection-item-container` (`data-tralbumtype` + `data-tralbumid`), a band page's `li.music-grid-item` (`data-item-id="album-123"`), and a release page's footer `li.recommended-album` (`data-albumid`). Otherwise the URL is the key.
- **Skipped:** links with no text (cover images: the title link next to them gets the badge), Bandcamp's action links (`?action=buy`, "go to album"), the release's own tracklist (`#track_table`) and any link back to the page you're on. One badge per release per card: a second link to the same release in the same `<li>` is skipped.
- **Not on your own profile.** Every item in your collection would say "owned".
- All of this is in `bandcamp/pageLinks.ts`, with selectors in `pageLinksDom.ts`; fixture tests cover fan, band, album and track pages.

### Lookup

- **One message per batch:** `getPageBadges { links: { url, itemKey }[] }` answers one badge (or null) per link, in order. The content script collects links, de-dupes them, and sends them together; there's never a request per link, and **no Bandcamp request at all**: only the local DB is read.
- **URL → item** is an index read: schema v10 adds an index on `items.url` (no data change, so no upgrade or backup migration). An unknown URL answers null.
- **owned:** your collection has the exact item or its album, or, for an album link, any track of it (§3.8: a track bought means the album counts as yours).
- **wishlist:** the exact item or its album is in your wishlist, and you don't own it.
- **N twins:** how many of your top `topTwinsK` twins (the For you set, §7) own it by matchKey, so a twin owning a track of an album counts for the album, as in For you. Read from their `fanMatches` lists with a binary search, so a batch costs K record reads, not a query per link.

### What it says

- `owned` alone when you own it: the twin count doesn't matter then.
- Otherwise `wishlist`, `3 twins`, or both: `wishlist · 3 twins`. Nothing at all when there's nothing to say, so most links stay bare.
- A native `title` gives the long form ("3 of your top 30 twins own this"). It isn't focusable: a page of hundreds of links would get hundreds of tab stops.

### Infinite scroll and rendering

- A `MutationObserver` on `document.body` re-runs the scan 300 ms after the last change. Every anchor seen goes in a `WeakSet`, so nothing is looked up or badged twice, and Bandcamp's own DOM isn't marked.
- Each badge is a `<dighead-badge>` host inserted right after its link, with a shadow root holding the shared styles, so Bandcamp CSS can't reach in. **One React root** renders every badge through portals into those shadow roots; a page doesn't get a React root per link.
- Colours come from the tokens, with the page theme (§13) on release pages, so a badge on a dark artist page isn't a light pill.
- Errors (worker unreachable, a broken page) are `console.warn`ed and the page simply has no badges.

### Gaps

- **Your data changes aren't pushed.** Wishlisting a release on a page doesn't turn its badge to "wishlist" until the next page load.
- **Links whose stored URL differs** (a release first seen under a custom domain, then linked under its subdomain) aren't found by URL; the id containers above cover the pages that have them.

## 16. Following as a signal

Code: `src/scoring/following.ts` (pure), `src/db/repo/followSignal.ts`, wiring in `src/background/recommend/` (`followSignal.ts`) and `src/background/scanner/` (`passZero.ts`, `fanProfileStep.ts`), reason text in `src/content/shared/followedText.ts`. Decided 2026-10-22.

### What the following sync gives us, and what it doesn't

- **Ours only.** The sync (§8) stores *your* followings: band accounts (artists and labels, not told apart) by `band_id`, and fans by `fan_id`, with names. Unfollowed-on-the-tab rows (`unfollowed`) don't count as follows here.
- **Other fans' followings aren't stored.** The same endpoints work for any `fan_id` logged out (§8), at one request per 500 follows per list, so two requests per fan. Not built: "follows the same artists as you" mostly restates collection overlap (you follow what you buy), and twins already measure that with purchases, which are the stronger signal. Two requests for each of the 200 twins would be ~400 requests a recompute for a small, redundant nudge.
- **Followed fans aren't crawled either** (yet). Fans you follow are scanned only when a supporter list brings them in, as everyone else. Queueing them at seed priority would cost ≤ 20 requests each once (the 2,000-item cap at batch 100), then the 30-day re-read, and is the cheapest next step if followed fans turn out to be good twins. Left for later so this change touches no queue or sync code.

### Signals, and how strong

- **Releases from accounts you follow** (For you, both modes, and Also bought's co-owned rows): a release counts as followed when its selling account (`items.bandId`) or its label (`items.labelId`) is a band you follow. Its score is multiplied by `1 + FOLLOW_BOOST` = **×1.25**, flat. Smaller than the twin boost's ×1.5 (§6) on purpose: following an artist says you like them, but you'll also hear about their releases from Bandcamp itself, so these picks carry less discovery. ×1.25 re-orders close calls; it never lifts a release past one with clearly more evidence. Pruning stays exact: every candidate's ceiling is multiplied by the same factor (when you follow anyone), since both ceilings are linear.
  - Same-artist and same-label fallback picks aren't re-ordered; they're already about the release's own seller.
  - Setting `followingBoost` (default on, "Boost releases from accounts you follow"). Off, the boost and its reason text are both gone.
- **Supporters you follow are read first** (§12): pass 0 moves followed fans to the front of a release's supporter order (page order among them), and in pass 1 a followed fan's collection always reads ahead of the profiles still waiting, ranked by similarity like the rest. Costs nothing: it only re-orders requests already planned. No setting: it changes when fans are read, not what's recommended.
- **Fans you follow on the twins boards** get a "you follow" badge on their row (both boards). Their score isn't touched: the board is a measurement of overlap, and "your #4 twin" is read in badges, sidebars and For you weights. Nudging the score would make every rank partly about who you happen to follow.

### Reason text

- Rows boosted for a follow say so after the usual reason, with the account's name, as Fresh does with " · ": "7 supporters have this so far · you follow Warp", "owned by 5 of your top twins · you follow Warp". The name is Bandcamp's name for the account you follow. When both the seller and the label are followed, the seller's name shows.
- **Cost:** one more read per score: the followed bands, then their releases through the `bandId` and `labelId` indexes. Pass 1 reads one `following` row per profile.
- **Not yet checked on real data:** whether ×1.25 feels like a nudge. Tune it with the other weights (Phase 7.3).

## 17. Ignoring compilations

Decided and built 2026-10-22. Roadmap: *Ignoring compilations*. Code: `src/bandcamp/compilation.ts` (detector, pure), `src/scoring/compilations.ts` (pure), `items.compilation` (schema v11, `db/repo/items.ts`), and its uses in `db/repo/twins.ts` and `background/recommend/` (twins, Also bought, For you). Fixture: `album-page-compilation.html`.

### Why

- **Compilations connect fans who share nothing else.** A label sampler, a Various Artists charity comp or a scene retrospective is bought by fans of every artist on it, and by the label's subscribers. Two fans who both own *Bandcamp Friday Benefit Vol. 3* may have no other release in common.
- **Twins suffer most.** Twin overlap only counts releases you own (§7), and a comp you own matches everyone who bought it for any of its 20 artists. w(i) only damps the big ones: a niche comp with 60 supporters still weighs about as much as a niche album. The label-cluster flag (§7) catches label subscribers, not a comp's mixed crowd.
- **Recommendations suffer less.** In Also bought, lift already corrects for a comp's base rate (§6), so a comp that ranks high there is one this release's buyers really do buy more, often because the artist is on it. In For you, a comp several twins own is a fair pick, though it's there partly for the same reason it shouldn't make them twins.

### Detecting one (high precision)

`isCompilation` in `bandcamp/compilation.ts`. Wrongly flagging a normal album would silently drop real overlap, so each rule needs strong evidence, and missing a comp only leaves things as they were before.

1. **Artist is a various-artists placeholder.** After lowercasing, trimming and dropping trailing dots: `various artists`, `various artist`, `various`, `va`, `v.a`, `v/a`, `v-a`, plus the common translations (`varios artistas`, `vários artistas`, `artistes variés`, `artisti vari`, `verschiedene künstler`, `diverse artiesten`, `vv.aa`). The artist must be exactly one of these: "Various Artists" as part of a longer name doesn't count. On collection pages `band_name` is the release's artist line, not the selling account's name: the Jazzman comp in `collection_items-p1.json` has `band_name` "Various Artists", sold from `jazzmanalbums`.
2. **The title starts with a VA prefix:** `VA - Title`, `V/A: Title`, `Various Artists – Title`, optionally after a catalog number in brackets (`[LBL001] VA - Title`). This is how labels selling from their own account often name comps, with the label as the artist.
3. **Release pages only: at least 3 distinct track artists other than the album artist, on at least half the tracks.** `data-tralbum.trackinfo[].artist` is null on a normal album (all 9 tracks of `album-page.html`) and set per track on a comp (24 different artists on the 24 tracks of `album-page-compilation.html`). A track artist that contains the album artist or is contained in it doesn't count, which keeps "Artist feat. Guest" and split releases whose artist line names everyone out. Titles that say remix, rework, edits, versions or reimagined skip this rule, since remix albums list the remixers per track but are bought by the original artist's fans.

Collection pages carry only the featured track's artist (`tracklists`), and on a comp it's the album artist again ("Various Artists"), so rule 3 can't run there.

**Not used, on purpose:** title words like "compilation" or "sampler" (single-artist sample packs, of which the collection fixtures hold several, and an artist's own "The Compilation" would trip them), and "sold from a label's account" (most label releases are single-artist albums, §3.3).

**Coverage:** rules 1–2 run on every item from every scan. Rule 3 runs on release pages we fetch: every release you open, and every release in your own collection, since seeding fetches each one's page (§5). Twin overlap only ever touches releases you own (§7), so the rule that sees the most lands where it matters most. Comps whose artist is a label's name and that only turn up in other fans' collections are missed.

### What ignoring means, per scorer

The `ignoreCompilations` setting (default on, a popup toggle next to the label-cluster one) turns all of this off. Changing it takes effect at the next twins recompute and the next score of Also bought or For you.

- **Twins, all-time and lately: dropped.** Shared compilations are removed from the shared releases before anything is counted, so they add nothing to the score, the lately score, the overlap, Jaccard, "this year" or the label-cluster test. A fan whose only overlap is comps isn't a twin at all. The comp still counts in both collection sizes (√(|M|·|F|)), so a collector of comps is a little diluted, as with any release they don't share with you. Dropping rather than down-weighting because overlap on a comp is evidence about the comp's artist list, not about taste.
- **Also bought: down-weighted ×0.5** (`COMPILATION_FACTOR`) as a candidate. Kept, because a comp with a high lift among this release's buyers is a real association. The release you're looking at being a comp changes nothing: you chose that page. Pruning stays valid, since the factor only lowers scores.
- **For you and Fresh: down-weighted ×0.5** as a candidate, for the same reason. Twin scores feeding it are already comp-free.
- **Left alone:** Twins' latest (a feed of what twins bought, not a ranking), twins who own this, same-artist and same-label picks, and pass 0's supporter ranking (§12; it only orders scans).

### Data

- **`items.compilation: boolean`**, set by the parsers (`CollectionItem.compilation` from rules 1–2, `ReleasePageItem.compilation` from all three). Not indexed: scorers look it up for records they already read (your collection for twins, the candidates' records for Also bought and For you).
- **Merging:** a release page has the whole picture, so its verdict replaces the stored one. A collection page only sees the name, so it can set the flag but never clear it: `compilation = fromCollection || stored`.
- **A matchKey is a compilation** when a record scoring already reads for it says so. Twins: any of your own records under it, album or track. Also bought: the matchKey's own record (`getCompilations`), so an album known only through tracks isn't checked. For you: the record it shows (`getDisplayItems`), which may be a track of the album.
- **Schema v11** adds no index. Its upgrade runs rules 1–2 over every stored item's artist and title, so existing data is flagged at once. Rule 3 fills in as release pages are re-fetched (weekly for your own releases, §5). Importing an older backup does the same in `migrateRows`.
