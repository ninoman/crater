# Bandcamp fixtures

Captured logged out with curl on 2026-10-19 (Phase 0). Every parser in `src/bandcamp/` gets a test against these files. Re-capture them when Bandcamp changes something, and diff before you update tests.

| File | Request | Used by |
| --- | --- | --- |
| `album-page.html` | `GET https://floatingpoints.bandcamp.com/album/promises` | `parseReleasePage`: `data-tralbum`, `#pagedata`, `#collectors-data` (first 80 thumbs and 6 reviews), ld+json, tags |
| `track-page.html` | `GET https://floatingpoints.bandcamp.com/track/movement-1` | `parseReleasePage` for tracks: `album_url`, `current.album_id`, track-only supporters |
| `tralbumcollectors-thumbs-p2.json` | `POST https://bandcamp.com/api/tralbumcollectors/2/thumbs` with `{"tralbum_type":"a","tralbum_id":3149089081,"token":"<last thumb token>","count":100}` | `parseMoreSupporters` |
| `tralbumcollectors-reviews-p2.json` | `POST .../tralbumcollectors/2/reviews`, same body using the last review token | `parseMoreSupporters` (reviewers are supporters too) |
| `album-page-compilation.html` | `GET https://jazzmanalbums.bandcamp.com/album/follow-me-to-the-popcorn-the-untold-history-of-the-belgium-popcorn-scene`, logged out (2026-10-22). Artist "Various Artists", sold from Jazzman's account, every `trackinfo[].artist` set (24 artists) | `isCompilation` through `parseReleasePage` (decisions §17) |
| `album-page-small.html` | `GET https://doorsdarkmancollective.bandcamp.com/album/summers-fault` (3 supporters, `more_thumbs_available: false`) | small-release fallback path |
| `fan-page.html` | `GET https://bandcamp.com/jiggypol` (10 items, so `small_collection` is true) | `parseFanPage` |
| `fan-page-medium.html` | `GET https://bandcamp.com/icantthinkofaname` (122 items, 9 wishlisted) | `parseFanPage` with pagination tokens |
| `collection_items-p1.json` / `-p2.json` | `POST https://bandcamp.com/api/fancollection/1/collection_items` with `{"fan_id":1138719,"older_than_token":"<token>","count":40}` | `parseCollectionPage`, token round trip |
| `wishlist_items.json` | `POST .../fancollection/1/wishlist_items` with `{"fan_id":1138719,"older_than_token":"<now>::a::","count":40}` | `parseCollectionPage` (wishlist) |
| `wishlist_items-hidden.json` | wishlist_items for a fan whose wishlist is hidden (`fan_id` 11705655) | hidden wishlist gives `{"error":true}` |
| `collection_items-unknown-fan.json` | collection_items with `fan_id: 1` | empty result: `items: []`, `last_token: null` |
| `collection_items-bad-token.json` | collection_items with `older_than_token: "garbage"` | error shape: HTTP 200 with `{"error":true}` |
| `following_bands-p1.json` / `-p2.json` | `POST https://bandcamp.com/api/fancollection/1/following_bands` with `{"fan_id":7027105,"older_than_token":"9999999999:","count":5}`, then the `last_token` (2026-10-20) | following parser: band rows, token round trip (decisions §8) |
| `following_fans.json` | `POST .../fancollection/1/following_fans`, same fan, `count: 20` (all 7, `more_available: false`) | following parser: fan rows, last page |
| `following_fans-unknown-fan.json` | following_fans with `fan_id: 1` | empty result: `followeers: []`, `last_token: null` |
| `me-following-tab.html` | `#following-grid` outerHTML from `https://bandcamp.com/randoom_taker/following/artists_and_labels`, logged in, after "view all" (2026-10-20, 232 cards). No crumbs or personal data in it | following tab selectors: active sub-tab, card markup, `button.follow-unfollow` data attributes |
| `me-fan-page.html` | `GET https://bandcamp.com/randoom_taker` in a logged-in browser (2026-10-20). Scrubbed: email, re-download `sig`/`payment_id` and CSRF crumbs are placeholders | `parseViewer` on a logged-in page: `identities.fan` is `{id, username, name, photo, private, url, verified}`; also `is_own_page`, `hidden_data` |
| `fan-page-in-common.html` | `GET https://bandcamp.com/otfx` in a signed-in browser (2026-10-21), a supporter of one of the viewer's releases. Scrubbed: the viewer's email is `fan@example.com`, their username, name, ids and band are placeholders (`viewer`, `1000001`…), crumbs are `CRUMB`, `ip_country_code` is `XX` | `parseFanProfile`: the header's `ol.info-items` → `li.genre-wrapper` reads "Electronic, 8 items in common" (signed in only); `fan_data.location` / `fav_genre`, `collection_data.item_count` (decisions §12) |
| `purchase-confirmation.html` | The page checkout lands on, `GET https://bandcamp.com/download?cart_id=<id>&sig=<sig>&from=checkout`, logged in (2026-10-20, one track). Scrubbed: email is `fan@example.com`, every `sig`, crumb and `payment_id` is a placeholder | `isPurchaseConfirmationUrl` (the URL shape; `from` is gone from the address bar after load). `#pagedata` also has `download_items` with `cart_id`, `tralbum_id`, `item_type` |
| `band-page.html` | `GET https://floatingpoints.bandcamp.com/music`, logged out (2026-10-20). `/` 303s to the latest album, so `/music` is the band's home page. `data-tralbum` there holds only a url (no item), `data-band` has `id` and `name`, and the name sits in `#band-name-location` | `parseBandId`, `hasTralbumItem`, `detectPageKind` |
| `discover-genres.json` | The `genres` list in the `#pagedata` of `GET https://bandcamp.com/discover`, logged out (2026-10-24): 27 entries with `id`, `label` and `slug`. Cut from the page by hand; not in `fixtures:refresh` | `GENRES` in `bandcamp/genres.ts` (decisions §22) |
| `page-actions.html` | Bandcamp's heart (`li#collect-item`) and follow (`#following-actions`) controls, copied from the rendered DOM of `https://floatingpoints.bandcamp.com/album/promises` logged out (2026-10-23), plus the server-rendered placeholder, the "Subscribed!" variant from Bandcamp's `fan/band_follow` template and the fan page's button from `fan-page.html`. One `<section>` per case | `bandcamp/pageActions.ts`, `TagPrompt` (decisions §21) |


`fan-page.html`, `band-page.html`, `album-page.html` and `track-page.html` also test `findReleaseLinks` (page badges, decisions §15): the id-carrying cards, the skipped tracklist and links back to the page itself.

## Refreshing the public fixtures

```bash
npm run fixtures:refresh              # capture into tests/fixtures/.fresh/ (gitignored) and report
npm run fixtures:refresh -- --write   # also overwrite the saved fixtures
npm run fixtures:refresh -- album-page.html   # only some (p2 files need their first page listed too)
```

It re-fetches every logged-out fixture above (one request at a time, 1.5–3 s apart, using the builders in `src/bandcamp/requests.ts`), then for each one:

- runs the real parser on the fresh body and reports any `ParserError` / zod failure (`BROKEN`). The error-shape fixtures must still be rejected with `BandcampApiError`;
- compares structure with the saved fixture, not text: key paths and value types, for JSON bodies and for the `data-tralbum`, `#pagedata`, `#collectors-data` and ld+json blobs of HTML pages (`DRIFT` lists removed, added and retyped paths).

The exit code is 1 on `BROKEN` or `DRIFT`. Fresh data is a different sample, so a field that is sometimes `null` can show up as a harmless type change (`number -> null|number`); a removed or renamed path, or any `BROKEN`, is the real signal. Skipped, since they need a logged-in session: `me-fan-page.html`, `fan-page-in-common.html`, `me-following-tab.html` and the purchase page.
