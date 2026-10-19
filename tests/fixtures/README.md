# Bandcamp fixtures

Captured logged out with curl on 2026-10-19 (Phase 0). Every parser in `src/bandcamp/` gets a test against these files. Re-capture them when Bandcamp changes something, and diff before you update tests.

| File | Request | Used by |
| --- | --- | --- |
| `album-page.html` | `GET https://floatingpoints.bandcamp.com/album/promises` | `parseReleasePage`: `data-tralbum`, `#pagedata`, `#collectors-data` (first 80 thumbs and 6 reviews), ld+json, tags |
| `track-page.html` | `GET https://floatingpoints.bandcamp.com/track/movement-1` | `parseReleasePage` for tracks: `album_url`, `current.album_id`, track-only supporters |
| `tralbumcollectors-thumbs-p2.json` | `POST https://bandcamp.com/api/tralbumcollectors/2/thumbs` with `{"tralbum_type":"a","tralbum_id":3149089081,"token":"<last thumb token>","count":100}` | `parseMoreSupporters` |
| `tralbumcollectors-reviews-p2.json` | `POST .../tralbumcollectors/2/reviews`, same body using the last review token | `parseMoreSupporters` (reviewers are supporters too) |
| `album-page-small.html` | `GET https://doorsdarkmancollective.bandcamp.com/album/summers-fault` (3 supporters, `more_thumbs_available: false`) | small-release fallback path |
| `fan-page.html` | `GET https://bandcamp.com/jiggypol` (10 items, so `small_collection` is true) | `parseFanPage` |
| `fan-page-medium.html` | `GET https://bandcamp.com/icantthinkofaname` (122 items, 9 wishlisted) | `parseFanPage` with pagination tokens |
| `collection_items-p1.json` / `-p2.json` | `POST https://bandcamp.com/api/fancollection/1/collection_items` with `{"fan_id":1138719,"older_than_token":"<token>","count":40}` | `parseCollectionPage`, token round trip |
| `wishlist_items.json` | `POST .../fancollection/1/wishlist_items` with `{"fan_id":1138719,"older_than_token":"<now>::a::","count":40}` | `parseCollectionPage` (wishlist) |
| `wishlist_items-hidden.json` | wishlist_items for a fan whose wishlist is hidden (`fan_id` 11705655) | hidden wishlist gives `{"error":true}` |
| `collection_items-unknown-fan.json` | collection_items with `fan_id: 1` | empty result: `items: []`, `last_token: null` |
| `collection_items-bad-token.json` | collection_items with `older_than_token: "garbage"` | error shape: HTTP 200 with `{"error":true}` |

Still to capture (needs you, logged in):

- `me-fan-page.html`: your own profile while logged in (`identities.fan`, `is_own_page`, hidden items)
- `purchase-confirmation.html`: the page after a purchase completes (re-sync trigger)
