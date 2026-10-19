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
  - **No label field.** See §3.

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
| Does `collection_items` need a session for public collections? | **No.** Collections, wishlists and supporters all work logged out. A session only matters for your own hidden items, which still needs checking once the `me-fan-page.html` fixture is captured. | Answered |
| Private or hidden collections? | No fully private collections turned up in 50 sampled supporters. Bandcamp hides at the item level (`hidden_items_count`) and the whole-wishlist level (`wishlist_data.hidden`). Of the 50, **0 had hidden collection items** and **9 (18%) had hidden wishlists**. A hidden wishlist makes `wishlist_items` return HTTP 200 `{"error":true}`, **the same response as a malformed token**, so the scanner can only tell them apart with the first-page synthetic token. Impact is low: the MVP only reads *your own* wishlist. A fan is marked `private` only if `collection_items` errors on the first page (see "Private fans" below). | Answered |
| Tracks vs albums | **Decided (2026-10-20): owning a track counts as a match with owning its album.** Track-from-album buys are common in underground scenes. The link is cheap: a collection item's `album_id` matched the track page's `album_id` in 10 of 10 sampled tracks, so no extra requests are needed. Standalone singles have `album_id: null` and stay their own item. How this works is in §3.8. | Decided |
| Private fans | **Decided (2026-10-20): ignore them.** If a fan's collection can't be read (`collection_items` errors on the first page), set `status = private`. Leave them out of twins, scoring and the fan count `N`, and show nothing in the UI. | Decided |
| Name | Still open. "Dighead" stays the working name. | Open |

## 3. Changes to the spec's design

1. **Item key = `tralbum_type + tralbum_id`**, never `item_id`, so packages map onto their album.
2. **`supporters(i)` = `also_collected_count + 1`**, read from any collection page that contains the item. Fall back to the count of scanned owners only if it's missing. `items.supporterCount` gets filled for almost every item.
3. **Label = the selling account** (`band_id` / `url_hints.subdomain`). Collection items have no label field, but a label's releases are sold from the label's own account. For the label-cluster flag, measure "share of that seller's catalog" against the seller's items in the local DB for the MVP. A real catalog count would need one fetch of `<subdomain>.bandcamp.com/music` per seller, which can come later.
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
