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
     - Two people own different tracks from A: **also a match**, since it's the same release group.
     - Rarity weight uses the album's `also_collected_count` when it's known, otherwise the track's.
     - Recommendations are ranked per `matchKey` and point at the album, with a reason such as "2 twins own tracks from this".
     - If you own one track of A, A stays in your recommendations, tagged "you own 1 track", and is not hidden.
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
- **Purchase page (unverified):** treated as `https://bandcamp.com/download`. Re-downloads match too, but that only costs an incremental sync. Confirm with `purchase-confirmation.html`.
- **Confirmed with a real account (2026-10-20):** the worker's session cookies reach the API. A wishlist that is hidden publicly synced in full (137 items), and the collection count was slightly above the logged-out profile's (1,131 vs 1,127).

## 5. Network and the scanner (Phase 3)

Code: `src/background/scanner/`, with the queue repo in `src/db/repo/queue.ts`. Decided 2026-10-20.

- **All network goes through the service worker.** Content-script fetches fail CORS on artist subdomains, so content scripts only send messages.
- **One request per job run.** A `release` job and a `fan` job each send exactly one request per run and save a `cursor` (the next token) in their `queue` row. Effects:
  - A killed worker loses at most one request. The job resumes from its cursor rather than starting over.
  - A release page opened mid-scan gets the very next request, instead of waiting for a 2,000-item fan to finish.
  - The budget counts each request **before** it's sent, so a request cut off by a kill still counts.
- **Priority bump = foreground release.** Opening a release page moves its job and its supporters' jobs to priority 1, and moves any other priority-1 jobs back to 2. **This changes the spec**: if nothing moved back, every release you'd ever opened would sit at 1, and "jump to priority 1" would no longer put the new one first. Within a priority, jobs run by `nextAttemptAt`, then insertion order, so supporters are scanned in page order (most recent buyers first).
- **Failures come in three kinds** (`scanner/outcome.ts`):
  - *throttled*: HTTP 429, 5xx, **or no response at all** (offline, DNS, 30 s timeout). The whole queue pauses and the job stays as it is, with no attempt counted. Network errors are in this group because being offline is never one job's fault. Counting them per job would burn every job's retries in seconds.
  - *permanent*: another 4xx, a `ParserError`, or a `{"error": true}` other than a fan's first page. The job is dropped, and a dropped fan gets `status = error`.
  - *transient*: anything else, which is probably our own bug (e.g. a DB error). The job is retried after 60 s, then 120 s, then dropped.
- **Back-off:** honour `Retry-After` (seconds or an HTTP date). Without it, wait 60 s and double the wait after each consecutive throttled request, up to 1 h. The first successful request resets it. The pause lives in `chrome.storage.local` (`scanner` key), so it survives a killed worker and a browser restart.
- **Lock:** `chrome.storage.local` holds the lock as `{owner, heartbeatAt}`, with the heartbeat refreshed before every request. A lock older than 45 s is treated as left behind by a dead worker. Only one worker instance exists at a time, so in practice this only matters after a kill: the queue resumes on the first 1-minute alarm after those 45 s, usually within 1–2 minutes.
- **Supporter paging:** the first page (up to 80 thumbs and 6 reviews) comes free with the release page. After that, **thumbs come first, then reviews**, 100 per request (fewer for the last one), until the cap. Thumbs are the most recent buyers, which is what the cap means ("500 most recent").
- **Supporters are owners.** Each supporter gets an `ownership` row for the release (`source = collection`, `addedAt` from the token, as in §3.7). That way a fan counts as an owner even when the release falls outside their newest 2,000 items. An existing row is never overwritten.
- **Fan status** after a scan:
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

## 6. Also bought (Phase 4)

Code: `src/scoring/alsoBought.ts` (pure), `src/db/repo/alsoBought.ts` (gathering), `src/background/recommend/` (running it). Decided 2026-10-20.

### Match index: the risk-checkpoint fallback, applied up front

- **Measured first.** Reading the raw `ownership` rows of 300 supporters (300k rows) took about 1 s in fake-indexeddb, so plain index reads miss the 200 ms target before scoring even starts. The ROADMAP's P4 fallback ("precompute per-item owner counts") is therefore built in from the start, as schema v3:
  - `fanMatches`: each fan's distinct collection matchKeys, one record per fan.
  - `matchOwners`: per matchKey, how many fans' collections hold it.
- **They're derived from `ownership` and never drift from it.** Every ownership write (`putOwnership`, `removeOwnershipExcept`, `addSupporterOwnership`) recomputes the touched fans' lists from their rows in the same transaction (`refreshFanMatches`). Wishlists don't count as owning. The v3 upgrade builds both tables from existing rows.
- **Keys are stored as numbers.** `keyToNumber` maps albums to `+id` and tracks to `−id`, and each fan's list is a sorted `Float64Array`. Strings cost about twice as much to read and count, and made garbage collection the bottleneck in a big heap.
- **The roadmap's "move scoring to an offscreen document" wasn't needed.** A re-score takes 39 ms at 300k rows and 88 ms at the caps (500 supporters × 2,000 items, about 1M rows), both in fake-indexeddb, which is slower than Chrome's IndexedDB. Check: `npm run perf` (`tests/perf/`, kept out of `npm test` because it seeds for ~10 s). An earlier string-based version measured ~580 ms at full size; part of that gap was the test seeding everything in one huge transaction, which fake-indexeddb handles badly.

### Scoring

- **Supporters N** = fans other than you who own the release's matchKey (from the `ownership.matchKey` index, so track buyers and album buyers alike) **and whose collection has been read** (`done` or `partial`). Queued, private and failed fans don't count, so "7 of 32 supporters" always means 7 of the 32 we can actually see.
- **co(i)** = how many of those N lists contain i. Each list holds distinct matchKeys, so a fan with two tracks of an album counts once. Drop co < 2.
- **Lift uses the local base rate:** `lift = (co / N) / (owners(i) / population)`, where `owners(i)` comes from `matchOwners` and `population` is every fan with a known collection apart from you. This overrides the spec's unstated base rate. Bandcamp-wide counts would need the total number of Bandcamp fans, which we don't know, and they'd rank your own scene's staples high everywhere. Local lift answers "more common among this release's buyers than among everyone you've dug through". With only one release scanned, lift is about 1 for everything and the ranking falls back to plain co.
- **Lift is capped at 10**, then `score = co × ln(1 + lift)`. The twin boost is the constant `TWIN_BOOST = 0` until Phase 5.
- **Pruning:** candidates come in falling co order, and owner counts are fetched 200 at a time. No candidate can score more than `co × ln(1 + 10)`, so the loop stops as soon as the next candidate's ceiling is below the 30th-best score. In the perf data that means 200 lookups out of ~46k candidates.
- **Filters:** the release itself, hidden releases, and releases you own or wishlisted *as a whole*. Owning tracks of an album keeps the album in, tagged "you own N tracks" (§3.8). Wishlisting a single track keeps the album in, untagged.
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

- **Wishlist from the sidebar isn't wired up.** Adding to a wishlist needs a logged-in Bandcamp API call that we haven't captured. The ♡ button opens the release page in a new tab, where Bandcamp's own Wishlist button works. To fix it, capture the request Bandcamp sends when you click Wishlist on a release page (logged in) and save it as a fixture.
- **Track-only buyers of an album aren't listed as its supporters** (§3.8). This is still unmeasured: watch for albums whose supporter list looks small next to their `also_collected_count`.
- **Preview:** Bandcamp's release-page CSP sets no `frame-src`, and the EmbeddedPlayer sends no `X-Frame-Options` (checked 2026-10-20), so the iframe loads on artist pages.

## 7. Following tags (planned)

Planned 2026-10-20. **The data source is not yet verified.** Roadmap: *Following tags*.

You create your own tags and assign them to the fans, artists and labels you follow. Then you filter your followings by tag. **Tags apply only to followings**, not to twins, supporters or other fans you don't follow.

### Data source: unverified

- §1 confirms no following list or following endpoint. `fan_data` has only `followers_count`.
- **Nothing here may be built until a fixture is captured.** To capture it, log in, open your own fan page's following view, and save every request it makes (or what `#pagedata` holds for it) to `tests/fixtures/`, with a README entry. Record:
  - whether fans and artists/labels come back as one list or two
  - how it paginates
  - the id on each row
  - whether anything marks an account as a label

### Sync

- Followings are part of your own sync (§4). They're paced and don't count against the budget, with *full* and *incremental* modes.
- A full sync deletes unfollowed rows.

### Data

- **Kinds:** `'fan' | 'band'`. Artists and labels are both band accounts (`band_id`, see §3.3), so they share one kind. If the fixture flags labels, store that as a display-only `isLabel?: boolean`, **never in the key**.
- **Schema v4 (planned, additive; `itemKey` and `matchKey` untouched):**
  ```
  following: '[kind+id], kind, *tagIds'
  tags:      '++id, &nameKey'
  ```
  `nameKey` = the trimmed, lowercased name.
  - Tags are stored on the following row. A join table isn't needed, because only followings can be tagged.
  - Unfollowing removes the row and its tags with it.
- **Sync must not wipe tags:** `putFollowing` merges by key and keeps the existing `tagIds`. This needs its own test.
- **Deleting a tag:** one transaction deletes the `tags` row and removes its id from every following row, found through the `tagIds` index.

### Filter

- Default mode is `all` (AND); `any` (OR) is an option.
- OR uses `where('tagIds').anyOf(...)`. AND queries by the first tag, then filters in memory with a pure `matchesTags(assigned, selected, mode)`.
- You can also filter by kind (Fans / Artists & labels).
- Follow lists are small (hundreds of rows), so filtering in memory is fine.

### Planned layout

- `bandcamp/following.ts` (`parseFollowing` + zod schema + fixture test), and a request builder in `bandcamp/requests.ts`
- `db/repo/tags.ts` and `db/repo/following.ts`
- messages `tags.list`, `tags.create`, `tags.rename`, `tags.delete`, `tags.assign`, `tags.unassign`, `following.list`
- hooks `useFollowing(tagIds, mode)` and `useTags()`

### UI

- A **Following** tab on your profile (`#following`), injected the same way as Phase 5's Twins tab and reusing that code.
- Rows show avatar, name, a kind `Badge` and tag chips. A filter bar sits above the list.
- New `src/ui/` components: `Chip`, and `TagPicker` (a wrapped Radix Popover with a combobox, where Enter creates a tag). Its portal goes to the shadow-root container.
- States:
  - loading, including "syncing follows"
  - empty: you follow no one
  - empty: no tags yet
  - empty: the filter matches nothing, with "Clear filters"
  - error (reuse `parserError`)
  - results

### Backup

- **Tags are hand-made and a re-sync can't rebuild them**, so a JSON export/import of tags is part of the feature.

## 7. Taste twins (Phase 5)

Code: `src/scoring/twins.ts` (pure), `src/db/repo/twins.ts` (gathering and storing), `src/background/recommend/twins.ts` (running it). Decided 2026-10-20.

- **Score** = Σ w(i) over the shared matchKeys / √(|M|·|F|), where |M| and |F| are the two `fanMatches` lists (collection only, tracks folded into albums). w(i) uses the album's `supporterCount` first, then a track's, then `matchOwners`. Raw overlap and Jaccard are stored alongside.
- **|F| is what we've scanned**, so a collection capped at 2,000 items is compared on its newest 2,000. The size filter uses `collectionSize` once known (a `done` scan), otherwise `scannedItems`. A capped fan's real size is unknown, so `maxCollectionSize` can't catch them yet.
- **Candidates** are fans whose collection was read (`done` or `partial`), as for Also bought. Private, queued and failed fans are left out.
- **Label** = `labelId ?? bandId` (§3.3). A label's catalog is its distinct matchKeys in the local `items` table. Only the labels of releases you own are looked up, since only they can carry an overlap.
- **Label-cluster flag:** more than 50% of the overlap from one label, the fan owns more than 60% of that label's local catalog, **and at least 3 shared releases come from that label**. The last rule is new: local catalogs start tiny (often one release), so one shared release would otherwise flag everyone who owns it. Flagged twins are multiplied by 0.3 when `labelClusterDownweight` is on, and the flag is stored either way.
- **The leaderboard keeps the top 200**, replaced in full on each recompute. Fans are scored 500 at a time with a yield between pages.
- **Recompute triggers:** after each finished sync of your own collection, after every 25 fan scans (an in-memory counter, lost with the worker), and on install or update. Only one runs at a time; a trigger during a run queues one more pass.
