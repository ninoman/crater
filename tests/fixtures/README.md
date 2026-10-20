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
| `me-fan-page.html` | `GET https://bandcamp.com/randoom_taker` in a logged-in browser (2026-10-20). Scrubbed: email, re-download `sig`/`payment_id` and CSRF crumbs are placeholders | `parseViewer` on a logged-in page: `identities.fan` is `{id, username, name, photo, private, url, verified}`; also `is_own_page`, `hidden_data` |
| `purchase-confirmation.html` | The page checkout lands on, `GET https://bandcamp.com/download?cart_id=<id>&sig=<sig>&from=checkout`, logged in (2026-10-20, one track). Scrubbed: email is `fan@example.com`, every `sig`, crumb and `payment_id` is a placeholder | `isPurchaseConfirmationUrl` (the URL shape; `from` is gone from the address bar after load). `#pagedata` also has `download_items` with `cart_id`, `tralbum_id`, `item_type` |


## Refreshing the public fixtures

```bash
npm run fixtures:refresh              # capture into tests/fixtures/.fresh/ (gitignored) and report
npm run fixtures:refresh -- --write   # also overwrite the saved fixtures
npm run fixtures:refresh -- album-page.html   # only some (p2 files need their first page listed too)
```

It re-fetches every logged-out fixture above (one request at a time, 1.5–3 s apart, using the builders in `src/bandcamp/requests.ts`), then for each one:

- runs the real parser on the fresh body and reports any `ParserError` / zod failure (`BROKEN`). The error-shape fixtures must still be rejected with `BandcampApiError`;
- compares structure with the saved fixture, not text: key paths and value types, for JSON bodies and for the `data-tralbum`, `#pagedata`, `#collectors-data` and ld+json blobs of HTML pages (`DRIFT` lists removed, added and retyped paths).

The exit code is 1 on `BROKEN` or `DRIFT`. Fresh data is a different sample, so a field that is sometimes `null` can show up as a harmless type change (`number -> null|number`); a removed or renamed path, or any `BROKEN`, is the real signal. Skipped, since they need a logged-in session: `me-fan-page.html` and the purchase page.
