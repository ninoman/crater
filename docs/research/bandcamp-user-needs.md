# Bandcamp user needs vs. Dighead

Research date: 2026-10-24. Scope: what Bandcamp fans ask for and complain about, checked against what Dighead ships and plans. Source IDs in brackets (`[R12]`, `[H5]`, …) point to §5. Quotes are kept under 15 words; everything else is paraphrase.

## 1. TL;DR

- **Our core is what diggers already do by hand.** The most-repeated discovery method is "find a fan who owns what I love, see what else they bought" [H2][H4][H5][H7][H8][R28][K1]. Dighead automates exactly this (Also bought, Crate mates, For you), locally. Rivals that do it need a server or an account (Badger [R28], Bandcamp Enhancement Suite's FindMusic.club backend [G3], where a user asked what data gets sent [G4]).
- **The loudest gap we don't fill: "what did the artists and labels I follow just release?"** Fans with hundreds of follows can't keep up with the feed or the emails, and some built Gmail-parsing or RSS tools to cope [R26][R33][R13][R32][R42][H11][H12]. Bandcamp's July 2026 "filter Discover by artists you follow" helps a little [B1], but there's still no digest, per-artist mute or seen/unseen state. We already sync follows and have tags, so this is a natural next step.
- **Wishlist and collection management is the most-requested area.** People want sort options, notes, multiple lists, a "to check out" state and tag filters [R6][R9][R14][R15][R17][R22][R23][R29][H14][H15][H17][S5][S6]. Dighead's wishlist tags, search and bulk actions cover part of it. Sorting, notes, a "heard it" state and the collection tab are still missing.
- **"Have I already listened to this?" comes up on 5 platforms** [G2][C1][G6][G9][R12][H17][S5]. A heard/seen marker that feeds back into For you ("hide what I've heard") is cheap to build and fits the recommender.
- **Many complaints are out of our reach:** the iOS app can't sell digital downloads, the stream limit, support response, deleted purchases, AI uploads, and the mobile app in general [R31][R37][S11][R36][H18]. We stay a desktop Chrome extension.

## 2. Coverage table

Signal: **Strong** = 3+ independent sources on 2+ platforms, **Medium** = 2 sources, **Weak** = 1. Reposts and the same project's own issues count once.

| Theme | Signal | Status in Dighead | Evidence |
| --- | --- | --- | --- |
| **Discovery through fans who bought the same thing** ("follow the taste trail") | Strong (HN, Reddit, Bluesky, KVR) | **Covered.** Also bought (release sidebar, `scoring/alsoBought.ts`), Crate mates (`scoring/crateMates.ts`), For you with Fresh and Deep cuts modes (`scoring/forYou.ts`, `fresh.ts`, `deepCuts.ts`), Crate mates' latest (`scoring/crateMatesLatest.ts`). | [H2], [H8], [R28] |
| **Bandcamp's own recommendations feel random or weak** | Strong (HN, Reddit) | **Covered**, same features. The reason lines ("owned by 5 of your top crate mates") answer the "why this?" problem. | [H9], [H10], [R26] |
| **New releases from followed artists and labels** (feed, digest, email overload) | Strong (Reddit, HN) | **Gap, feasible.** We sync follows (`background/syncFollowing.ts`) and boost followed releases (`scoring/following.ts`), but we never fetch what they release. Bandcamp's July 2026 Discover filter is a partial fix [B1]. | [R33], [R26], [H11] |
| **Wishlist management**: sort, notes, multiple lists, tag filter, "to check out" | Strong (Reddit, HN, Bluesky, Chrome Web Store) | **Partly.** Wishlist takeover with tags, text search, tag filter and bulk tagging (`content/wishlist/`, decisions §14). Missing: sort, private notes or ratings, a "checked" state, filtering by Bandcamp's own genre tags. | [R15], [R17], [H15] |
| **Collection management** (sort, find old purchases, too big to browse) | Strong (Reddit, Bluesky) | **Gap, feasible.** We sync the collection but don't take over the collection tab. Page badges already flag "owned" on any page (`content/badges/`), which answers "almost bought it twice" [R23]. | [R25], [R24], [S12] |
| **"Have I heard this already?"** (listened or seen marker) | Strong (GitHub, Chrome Web Store, Reddit, HN, Bluesky) | **Gap, feasible.** We have a preview player (`content/shared/ReleasePreview.tsx`) but don't record what you've heard. | [G2], [C1], [R12] |
| **Hide or mute an artist, label or tag in recommendations** | Strong, borderline (Reddit, GitHub) | **Partly.** The row's hide button ("Hide: never recommend this", `src/ui/ReleaseRow.tsx`, message `hideRelease`) hides one release by matchKey (`hidden` store, `scoring/exclusions.ts`). An artist's or label's *next* release still comes through, there's no tag mute, and there's no unhide list (decisions §6 says unhide was left for later). | [R19], [R35], [G3] |
| **Player and listening**: queue, continuous play, volume, loop, shuffle, keyboard | Strong (HN, Reddit, Chrome Web Store, Firefox Add-ons, GitHub) | **Partly.** Single-release previews only. Five or more extensions already do player fixes well [C1][C2][C3][C4][F1]. | [H13], [R10], [C2] |
| **Search and filters**: multi-tag, exclude tags, release date, format, name-your-price, license, region | Strong (Reddit, HN, GitHub) | **Partly feasible.** Filtering *our own lists* is feasible: collection-item JSON already carries `band_location`, `genre_id`, `price`, `is_set_price`, `merch_ids` and license ids (`tests/fixtures/collection_items-p1.json`), though the slim schema (decisions §19) keeps only some of them. **Site-wide search: hard** (needs a crawl index). | [R5], [R27], [G7] |
| **Local and regional discovery** | Strong (Reddit, HN) | **Gap, feasible** as a filter on our lists, from `band_location`. | [R30], [R35], [H6] |
| **Social: follow fans with similar taste, community** | Strong (HN, Reddit, Lines) | **Covered** for finding them: crate mates, profile badges (`content/fan/`), follow tags. Bulk-following crate mates would be a gap (Weak, [R7]). | [H7], [L1], [R1] |
| **Export and interoperability** (CSV, spreadsheet, Discogs) | Strong (Reddit, Discogs, GitHub) | **Partly.** Full JSON backup and tag export exist (decisions §10). CSV export of picks is in the backlog (ROADMAP). | [R9], [R15], [D1] |
| **Purchase and download**: bulk download, wishlist to cart, Bandcamp Friday planning | Strong (HN, GitHub, Firefox Add-ons, Bluesky, Lines) | **Gap, feasible but off-core.** Bulk downloaders exist [G1][F1]. A Bandcamp Friday shortlist from the wishlist fits; downloading doesn't. | [H16], [C1], [L2] |
| **Physical formats and stock** | Strong (Reddit, Chrome Web Store) | **Gap, feasible**: `merch_ids` and `merch_sold_out` are in collection JSON; release pages list packages. | [R2], [R34], [C5] |
| **Playlists** (from wishlist, web playback, sharing) | Strong (Reddit, Bluesky, HN) | **Gap, hard.** Playlists are Bandcamp's own collection feature (May 2025 [B2]); we can't write them. | [R21], [S9] |
| **Mobile app, desktop app, cross-device** | Strong (Reddit, HN, Bluesky) | **Gap, hard or impossible.** We're a desktop Chrome extension. Firefox is in the backlog; one Firefox port request seen [G8]. | [R31], [H18], [S8] |

## 3. Ranked feature ideas (feasible gaps)

Ranked by signal × fit with the "local recommendations" core. Effort: S ≈ a few days, M ≈ a phase, L ≈ several phases.

| # | Feature | User problem | How it would work in Dighead | Effort | Signal |
| --- | --- | --- | --- | --- | --- |
| 1 | **New from your follows** (digest tab) | "No reliable way to see what my artists and labels released recently" [R26]. Emails pile up and there's no per-artist mute [R33]. | `bandcamp/`: a parser for followed bands' `/music` grid (the `band-page.html` fixture is already that page), or Bandcamp's logged-in feed endpoint if recon finds it cleaner. `db/`: a `bandReleases` store with first-seen time. `background/`: a low-priority `followReleases` job kind, inside the daily budget, re-reading follows weekly. `scoring/`: pure ordering, newest first, with a crate-mate interest boost. `content/profile/`: a tab with seen and unseen markers, and the existing follow tags as filters and mutes. | M | Strong |
| 2 | **Heard it** marker | Fans can't tell what they've already checked in the feed or their wishlist [R12][G2]. The wishlist doubles as a "to listen" list [H15][S5]. | `content/`: record a play from our preview player, and from Bandcamp's player via the release page's audio events. `db/`: a `heard` store keyed by matchKey. `scoring/exclusions.ts`: an optional "hide heard" filter for For you and the follows digest. A badge on cards and page badges. | S | Strong |
| 3 | **Wishlist sort, notes and a "buy next" order** | No sort options, so big wishlists become spreadsheets [R15][R22]. People want notes or ratings [R17][H15]. | `content/wishlist/`: sort by added date, artist, label, price, and **"crate mates who own it"**, which ranks the wishlist by our own data (a pure function in `scoring/`). `db/`: an `itemNotes` store (text plus 1–5 rating), included in the tag export. | S–M | Strong |
| 4 | **Hide from recommendations**, widened from one release to an artist, label or tag, plus an unhide list | One wrong-tagged band shows up in the feed every week [R19]. People want to blacklist tags or locations [R35]. | Build on the existing hide button: rename it "Hide from recommendations" and make it a small menu (this release / everything by this artist / everything on this label). `shared/messages.ts`: `hideRelease` becomes a `hide` message with a discriminated target (`release` / `band` / `label`, and `genre` later). `db/`: the `hidden` store gets a target kind next to the key. `scoring/exclusions.ts` reads all kinds (every recommender already shares it). A "Hidden" list in the popup to unhide. | S | Strong (borderline) |
| 5 | **Filters on our lists**: genre, location, price or name-your-price, physical available, release year | Fans want to filter by format, date, region and price [R2][R27][R30][R34]. | `bandcamp/collection.ts` already sees these fields. Keep `genre_id`, `band_location`, `is_set_price` and `merch_ids` on items (a schema bump; decisions §19 dropped some). Pure filter functions in `scoring/`, and a shared filter bar from `src/ui/` on For you, Also bought and the digest. | M | Strong |
| 6 | **Collection tab takeover** | Collections of 100+ items have no useful sort, so old purchases get lost [R25][R24][R4]. | Reuse the wishlist grid, filter bar and tags from `content/wishlist/` over your `ownership` rows with `source = 'collection'`. Sort by purchase date, artist or label, and filter by tag. | M | Strong |
| 7 | **Play through a list** | The web player plays one release at a time, and people install extensions to queue [H13][R10][C2]. | `hooks/usePreviewPlayer`: a queue over the visible rows of For you, Also bought, Latest, the wishlist and the digest. Auto-advance, plus "heard" marking from #2. | M | Strong |
| 8 | **Bandcamp Friday shortlist** | Fans save up their wishlist for Bandcamp Friday [L2][S7], and big carts get declined [R20]. | A wishlist view filtered to purchasable items, ordered by #3's "buy next" and showing the running total. It only reads data; no cart writes. | S | Medium |
| 9 | **CSV export** of picks, wishlist and notes | People ask to export the wishlist to Excel and import into Discogs [R9][D1]. | Already in the backlog. A pure serializer in `shared/`, with a download from the popup. | S | Strong |
| 10 | **Desktop notifications** for new follow releases or a big crate-mate buy | Release emails are all-or-nothing [R33]. | Needs `chrome.notifications` (a new permission, to justify for the store), fed by #1. Off by default. | S (after #1) | Medium |

### How #2 (heard it) and #4 (hide from recommendations) fit together

They look alike, since both can take a release out of a list, but they mean different things, so they stay separate.

| | Hide from recommendations (#4) | Heard it (#2) |
| --- | --- | --- |
| Meaning | A verdict: "not for me" | A state: "I've checked it". No verdict, since a 10-second preview proves little |
| Set by | An explicit click | Automatically (a play past a threshold, in our player or Bandcamp's), or a manual mark or unmark |
| Scope | Release, artist or label (genre later) | One release (matchKey) |
| Effect | Always out of every recommender, every list | Stays in by default, with a badge and dimmed cover. A per-list "Hide heard" toggle takes it out |
| Undo | Hidden list in the popup | Unmark on the row |
| Store | `hidden` (target kind + key) | `heard` (matchKey, time, source) |

Rules:

- **Hide wins.** A hidden release never shows, heard or not. Unhiding brings back its heard state untouched.
- **Both filter in the worker, before the list is cut to length**, so "Hide heard" still returns a full list. `exclusions()` gets the heard set only when the request asks for it (`getForYou { mode, hideHeard }`); hidden is always applied. Artist and label hides can't be precomputed as match ids (they must catch future releases), so `exclusions` also needs a per-item check on `bandId` / `labelId`.
- **One heard store serves every list.** "Unseen" in the follows digest (#1), "not heard yet" on the wishlist (the to-listen use [S5][H15]) and "Hide heard" in For you all read it.
- **Heard is not a scoring signal for now.** "Heard but never wishlisted" might be a soft negative later, but only if the offline eval (`tests/eval/`) shows it helps.

## 4. Out of our reach

Only Bandcamp can fix these, or they fall outside a desktop extension:

- **iOS app can't sell digital downloads** (app store policy) [R31][H20].
- **Stream limit** before you must buy [S11].
- **Purchases that vanish** when an artist deletes a release, with no re-download [R3][R36][H19].
- **Mobile app quality**: tablet layout, dead ends, links that open the browser [R31][R24].
- **Support and account activation** problems [R37].
- **AI and fake releases**, and fake sales gaming the charts [R39][R38].
- **Artist side**: statistics, scheduled releases, separate artist and fan logins [R40][S10].
- **Company changes**: the Songtradr sale, layoffs and the union [H1][H21].
- **Payouts, shipping and import charges, sold-out stock** [R34].
- **Email notification settings** per artist (only Bandcamp can change what it sends; #10 above is our partial answer) [R33].
- **Mobile and cross-device use** of Dighead: Chrome MV3 on desktop only, and our IndexedDB can't sync between machines without a backend.

## 5. Sources

### Method and what didn't load

- **Reddit** blocks scripted access and is not allowed in the in-app browser, and web search didn't index it. Reddit items come from the PullPush archive API (`api.pullpush.io`). All 10 search terms ran for r/BandCamp posts. PullPush then rate-limited us (repeated HTTP 429), so **r/vinyl, r/electronicmusic, r/indieheads, r/musicproduction, r/DJs, r/ifyoulikeblank and Reddit comments are barely covered**. Treat Reddit evidence as r/BandCamp-heavy.
- **Hacker News**: Algolia search API, 2022 onward, 420 comments read, about 300 relevant.
- **Bluesky**: the public `searchPosts` API, 2023 onward, about 1,100 posts read. Most were artist promos.
- **Did not load:** Steve Hoffman Forums (HTTP 403 and a bot check, so no Steve Hoffman claims are used), Greasy Fork's listing (403), chrome-stats.com (403), and the Bandcamp help center (the article pages came up empty). Mastodon search returns nothing without an account. X was not tried, since it needs a login. Bandcamp Daily has no comment section [B3]. Gearspace and ModWiggler searches found only recommendation threads, no feature requests.

### Reddit (r/BandCamp)

| ID | Date | Summary | URL |
| --- | --- | --- | --- |
| R1 | 2022-01-11 | Wishes for forums to talk with other fans of an album | https://www.reddit.com/r/BandCamp/comments/s1moea/building_community_on_bandcamp/ |
| R2 | 2022-01-17 | Feature request: filter by physical media (cassette, vinyl) | https://www.reddit.com/r/BandCamp/comments/s64zb9/an_ideafeature_request_for_filtering_by_phsical/ |
| R3 | 2022-03-01 | A band took down an album the poster paid for | https://www.reddit.com/r/BandCamp/comments/t488m1/band_took_one_of_their_albums_i_bought_down_is/ |
| R4 | 2022-01-23 | Frustrated at not being able to search collection or wishlist | https://www.reddit.com/r/BandCamp/comments/sb6svo/issues_searching_collectionwishlist/ |
| R5 | 2024-01-15 | Says genre tag intersection (multi-tag) search is gone. Unverified; a Hypebot piece of unknown date says tag combinations were added | https://www.reddit.com/r/BandCamp/comments/197aw4m/genre_tag_intersection_gone/ |
| R6 | 2023-05-05 | Tracks get lost in an "unorganised wishlist"; wants wishlist playlists | https://www.reddit.com/r/BandCamp/comments/138o477/wishlist_playlists/ |
| R7 | 2022-08-10 | Asks for a way to bulk-follow artists | https://www.reddit.com/r/BandCamp/comments/wkjxpg/bulk_subscribe/ |
| R8 | 2022-10-10 | "How can Bandcamp be improved?": feed seems to miss releases; wants a player on the feed | https://www.reddit.com/r/BandCamp/comments/y0g1v4/how_can_bandcamp_be_improved_what_needs_fixing/ |
| R9 | 2023-09-24 | Wants to export a wishlist of 1.5K+ items to Excel; reorders it by un-wishlisting | https://www.reddit.com/r/BandCamp/comments/16qson6/any_way_to_export_bandcamp_wishlist_to_an_excel/ |
| R10 | 2023-05-25 | "Web player sucks?" | https://www.reddit.com/r/BandCamp/comments/13roejr/web_player_sucks/ |
| R11 | 2023-03-09 | TrackDen: a tool for organising the wishlist into separate playlists | https://www.reddit.com/r/BandCamp/comments/11mo0zz/make_carts_on_bandcamp_using_trackden/ |
| R12 | 2024-04-04 | Feed is infinite and unorganised; "no way to know if I already 'listened'" | https://www.reddit.com/r/BandCamp/comments/1bvo1h8/bandcamp_for_music_discovery/ |
| R13 | 2024-05-29 | DJ wants to browse latest releases from artists and labels already bought from, like Beatport | https://www.reddit.com/r/BandCamp/comments/1d32rfw/improved_libraries/ |
| R14 | 2024-06-09 | Feature request: multiple wishlists | https://www.reddit.com/r/BandCamp/comments/1dbqo4x/feature_request_multiple_wishlists/ |
| R15 | 2024-03-14 | Built a spreadsheet to manage a 3.3K wishlist; hopes Bandcamp adds sorting | https://www.reddit.com/r/BandCamp/comments/1bex74p/spreadsheet_i_made_to_manage_my_33k_albums/ |
| R16 | 2024-01-17 | Leaving Spotify; needs discovery based on own taste | https://www.reddit.com/r/BandCamp/comments/1997fdc/i_am_leaving_spotify_but_i_still_need_a_good_way/ |
| R17 | 2024-08-17 | Asks for tags or notes on the wishlist | https://www.reddit.com/r/BandCamp/comments/1euqt2b/notes_for_your_wishlist/ |
| R18 | 2025-05-24 | Wishlist sort by "most listened" was removed | https://www.reddit.com/r/BandCamp/comments/1kum8to/wishlist_cannot_be_sorted_by_most_listened_anymore/ |
| R19 | 2025-07-05 | Can't remove or block a wrongly tagged band that is in the feed every week | https://www.reddit.com/r/BandCamp/comments/1ls55jk/how_to_remove_an_artist_from_the_recommendations/ |
| R20 | 2025-06-06 | Large baskets get bank cards declined | https://www.reddit.com/r/BandCamp/comments/1l4t74v/what_are_these_lot_playing_at/ |
| R21 | 2025-12-07 | Playlists should allow wishlist items, not just owned ones | https://www.reddit.com/r/BandCamp/comments/1pgesk9/bandcamp_playlists_opinion/ |
| R22 | 2025-08-06 | Wants better wishlist usability and new music from follows without "suggested crap in the way" | https://www.reddit.com/r/BandCamp/comments/1mj5ckq/anyone_else_so_annoyed_with_bandcamps/ |
| R23 | 2025-10-29 | Collection "impossible to navigate"; almost re-bought owned music; built crates.app | https://www.reddit.com/r/BandCamp/comments/1oj3abh/anyone_else_have_a_big_bandcamp_collection_thats/ |
| R24 | 2026-04-15 | "UX is incredibly bad": no way to sort the library; mobile lost the feed | https://www.reddit.com/r/BandCamp/comments/1sm09nq/i_love_bandcamp_as_a_service_but_the_ux_is/ |
| R25 | 2025-11-24 | Can't manage the collection for lack of "sort by"; reconsidering Bandcamp Friday purchases | https://www.reddit.com/r/BandCamp/comments/1p5a9yp/i_cant_manage_my_collection_anymore/ |
| R26 | 2026-01-13 | Follows 500+ accounts; "recommendation engine feels random"; built a Gmail-parsing release feed | https://www.reddit.com/r/BandCamp/comments/1qbngfm/bandcamps_ui_feels_stuck_in_2000_i_built_a_local/ |
| R27 | 2025-12-13 / 2026-03-28 | Wants to filter and search by release date (two separate posts) | https://www.reddit.com/r/BandCamp/comments/1plyznn/is_there_any_way_for_me_to_filter_by_music_only/ · https://www.reddit.com/r/BandCamp/comments/1s6e0w2/searching_by_release_date/ |
| R28 | 2026-03-25 | Badger: digs collectors of a track for what else they bought; crates, BPM and key; has accounts | https://www.reddit.com/r/BandCamp/comments/1s3boif/i_built_a_free_tool_that_speeds_up_bandcamp/ |
| R29 | 2026-08-15 | Feature request: filter wishlist and collection by genre tag | https://www.reddit.com/r/BandCamp/comments/1vos4xd/feature_request_filter_wishlist_collection_by_tag/ |
| R30 | 2026-02-03 | Misses browsing by location and genre; wants a feed of only latest releases from follows | https://www.reddit.com/r/BandCamp/comments/1qv3kqa/what_features_would_you_like_in_bandcamp/ |
| R31 | 2026-02-28 | iOS app: no digital purchases, not responsive on iPad, dead ends | https://www.reddit.com/r/BandCamp/comments/1rgzsv2/why_is_the_bandcamp_for_fans_mobile_app_so_bad/ |
| R32 | 2026-03-25 | Wants the music feed to show only followed artists (app) | https://www.reddit.com/r/BandCamp/comments/1s38jad/is_there_a_way_to_have_my_music_feed_tab_show/ |
| R33 | 2026-06-14 | Follows hundreds of artists; wants a weekly digest or per-artist notification control | https://www.reddit.com/r/BandCamp/comments/1u5vn4l/i_wish_we_could_get_a_weekly_digest_of_artists_we/ |
| R34 | 2026-06-04 / 2026-08-02 / 2026-02-28 | Can't list own physical purchases; wants to search items shipping within the EU; "sold out" items | https://www.reddit.com/r/BandCamp/comments/1tx0pua/how_to_figure_out_if_i_bought_the_physical_media/ · https://www.reddit.com/r/BandCamp/comments/1vd99fq/search_within_eu/ · https://www.reddit.com/r/BandCamp/comments/1rhhvfp/bandcamp_says_sold_out_on_items_that_are/ |
| R35 | 2026-08-05 | Wants to blacklist tags and locations, and more local recommendations | https://www.reddit.com/r/BandCamp/comments/1vfvf20/is_there_any_way_to_blacklist_tagslocations/ |
| R36 | 2026-01-14 | Can't download a bought album that was deleted | https://www.reddit.com/r/BandCamp/comments/1qcbgfn/is_there_a_way_to_download_a_deleted_album_that_i/ |
| R37 | 2024-10-09 | Can't activate fan account; no way to contact support | https://www.reddit.com/r/BandCamp/comments/1fzywh5/cant_make_fan_account/ |
| R38 | 2026-02-18 | Worries fake sales can game Bandcamp's visibility | https://www.reddit.com/r/BandCamp/comments/1r885c1/bandcamp_algorithm_and_fake_sales/ |
| R39 | 2026-05-11 | AI albums in collection that can't be deleted or hidden on mobile | https://www.reddit.com/r/BandCamp/comments/1tajxsi/realizing_i_might_have_ai_albums_in_my_collection/ |
| R40 | 2025-08-29 | Artist statistics are unsatisfying | https://www.reddit.com/r/BandCamp/comments/1n31wyb/bandcamp_for_artists_statistics_are_a_bit/ |
| R41 | 2026-04-27 | Vibeamp: extension that queues everything playable on a page | https://www.reddit.com/r/BandCamp/comments/1sxd4xw/bandcamp_music_player_extension/ |
| R42 | 2025-09-24 | Wants to filter the music feed to fans only, without algorithmic suggestions | https://www.reddit.com/r/BandCamp/comments/1nphc8u/filters_at_music_feed_level/ |

### Hacker News

| ID | Date | Summary | URL |
| --- | --- | --- | --- |
| H1 | 2023-09-28 | Songtradr sale thread; advice to archive your collection | https://news.ycombinator.com/item?id=37696051 |
| H2 | 2022-05-18 | Discovery via other users: "this user bought 12 things you have" | https://news.ycombinator.com/item?id=31421740 |
| H3 | 2022-02-06 | Ask HN wish: Bandcamp discovery based on your local library | https://news.ycombinator.com/item?id=30233348 |
| H4 | 2024-08-20 | Clicks supporter thumbnails to browse their collections and wishlists | https://news.ycombinator.com/item?id=41298583 |
| H5 | 2024-10-18 | Follows labels and fans with similar purchase history | https://news.ycombinator.com/item?id=41882664 |
| H6 | 2022-09-14 | Finds music by filtering tags by city; wants an "I just want some music I like" button and playlists | https://news.ycombinator.com/item?id=32837021 |
| H7 | 2024-10-19 | Follows fan accounts of liked artists to see what they buy | https://news.ycombinator.com/item?id=41885908 |
| H8 | 2026-01-14 | Main discovery: browsing collections of people who own albums they love | https://news.ycombinator.com/item?id=46616554 |
| H9 | 2023-10-17 | "Bandcamp's recommendations for me are lousy." | https://news.ycombinator.com/item?id=37911743 |
| H10 | 2026-03-15 | Bandcamp's own discovery features called lousy | https://news.ycombinator.com/item?id=47386501 |
| H11 | 2022-02-18 | Feed and emails "wasn't cutting it"; turned label emails into RSS | https://news.ycombinator.com/item?id=30390608 |
| H12 | 2023-11-20 | No personalized RSS; converts artist and label emails to RSS | https://news.ycombinator.com/item?id=38349875 |
| H13 | 2023-08-31 | Player can't queue multiple albums; built a queue-based player | https://news.ycombinator.com/item?id=37334085 |
| H14 | 2023-10-25 | Wishlist over 1,000 albums is a "things to check out" list; built a GNOME app | https://news.ycombinator.com/item?id=38013109 |
| H15 | 2023-08-22 | Wishlist over 500 used as a to-listen list; wants private ratings and comments | https://news.ycombinator.com/item?id=37217510 |
| H16 | 2023-11-07 | Uses a CLI downloader to sync purchases to a NAS | https://news.ycombinator.com/item?id=33504879 |
| H17 | 2025-04-18 | Notifications "lacking"; wishlist manager "severely lacking"; uses wishlist as a check-out queue | https://news.ycombinator.com/item?id=43728599 |
| H18 | 2026-07-17 | Bandcamp app called "godawful" | https://news.ycombinator.com/item?id=48950461 |
| H19 | 2023-09-29 | Paid items removed from collection can't be downloaded | https://news.ycombinator.com/item?id=37700780 |
| H20 | 2023-04-22 | iOS app lacks purchases, presumably due to app store rules | https://news.ycombinator.com/item?id=35664143 |
| H21 | 2024-01-08 | Features shut down with the layoffs | https://news.ycombinator.com/item?id=38914754 |
| H22 | 2023-10-17 | App search so bad it can't find what's already playing | https://news.ycombinator.com/item?id=37915474 |
| H23 | 2026-08-26 | Bandcamp has "legendarily bad semantic search" | https://news.ycombinator.com/item?id=49448230 |
| H24 | 2025-01-15 | No Creative Commons search filter | https://news.ycombinator.com/item?id=42709676 |
| H25 | 2024-01-20 | Web player "sucks"; needs a userscript for volume | https://news.ycombinator.com/item?id=39070834 |
| H26 | 2026-07-16 | "Discoverability and usability in general is godawful" | https://news.ycombinator.com/item?id=48933927 |

### Bluesky

| ID | Date | Summary | URL |
| --- | --- | --- | --- |
| S1 | 2025-12-04 | Wants Bandcamp purchases plus an algorithm recommending new stuff with buy links | https://bsky.app/profile/bikehounds.bsky.social/post/3m76rkjt5ck2z |
| S2 | 2025-12-06 | "I really wish Bandcamp UI was better" | https://bsky.app/profile/robincircle.bsky.social/post/3m7bptf4csc2a |
| S3 | 2026-04-26 | Gets irrelevant notifications | https://bsky.app/profile/soundingline.bsky.social/post/3mkg6dqx6es2y |
| S4 | 2026-05-16 | Bandcamp Enhancement Suite "fixes so many annoying issues" | https://bsky.app/profile/waiworinao.bsky.social/post/3mly6bsgsbc2m |
| S5 | 2026-08-15 | Uses the wishlist as a "to listen" tracker | https://bsky.app/profile/ceitinnyt.bsky.social/post/3mt4swaom6k23 |
| S6 | 2026-08-20 | Wishes for a separate "check it out later" list besides the wishlist | https://bsky.app/profile/voidhorn.bsky.social/post/3mtjktfsdk22y |
| S7 | 2026-02-21 | Chipping away at a big wishlist | https://bsky.app/profile/reddishraven.bsky.social/post/3mfdfnwxbqc2b |
| S8 | 2026-05-03 | App and web disconnect: playlists only in the app, gift cards only on the web | https://bsky.app/profile/catbus.phd/post/3mkxtwzdvac2q |
| S9 | 2025-07-23 | Free-download items can't go in the collection or playlists | https://bsky.app/profile/claremontcometh.bsky.social/post/3lulsrn4fes2o |
| S10 | 2026-01-22 | Must log out of the fan account to use the artist account | https://bsky.app/profile/emily182.bsky.social/post/3mcymkysq7c2k |
| S11 | 2026-03-04 | Annoyed by the "buy the album now" stream limit | https://bsky.app/profile/hunbundaisy.bsky.social/post/3mgbeqhbxak2w |
| S12 | 2026-07-20 | Search and sort of the library was missing from the Bandcamp app (via a Subsonic client) | https://bsky.app/profile/hafh.online/post/3mr2hhegb4k2f |

### Extension stores and GitHub

| ID | Date | Summary | URL |
| --- | --- | --- | --- |
| C1 | 2023-12 → 2026-09 | Bandcamp Enhancement Suite (5,000 users, 5.0): praise for preview and the "listened" marker; asks for wishlist-to-cart, a wishlist hotkey, a loop, the marker back after an update | https://chromewebstore.google.com/detail/padcfdpdlnpdojcihidkgjnmleeingep/reviews |
| C2 | 2024-11 → 2026-06 | Bandcamp Play (1,000 users, 4.8): praise for keyboard control and feed playback; asks for discography autoplay and a player in the feed | https://chromewebstore.google.com/detail/bandcamp-play/nooegmjcddclidfdlibmgcpaahkikmlh/reviews |
| C3 | 2021-05 → 2026-08 | Bandcamp Streamer (1,000 users, 4.2): continuous play over feed, collection and wishlist | https://chromewebstore.google.com/detail/bandcamp-streamer/hopclencgmfjiipjmlenfcdgcdblfmjh/reviews |
| C4 | 2023-03 → 2025-09 | Bandcamp+ (2,000 users, 4.6): volume and speed; asks to keep volume, for custom hotkeys, to hide the whole collection (the dev says only Bandcamp can) | https://chromewebstore.google.com/detail/bandcamp+/hggjmjobahhmbmnfndhdgidchhhhjkad/reviews |
| C5 | n.d. | Bandcamp Stock Count (49 users, no reviews) | https://chromewebstore.google.com/detail/bandcamp-stock-count/mcmbaenemjdoghiakgallmaokaoldloa |
| C6 | 2025–2026 | Several wishlist tagging extensions: Bandcamp Wishlist Tagger (about 24 users), Bandcamp Tagger (about 106), BC Tag & Filter. Listing details from search results; the pages weren't opened | https://chromeboard.com/extension/bandcamp-wishlist-tagger-palipgpmmmanacecgccohgejacecbpld · https://addons.mozilla.org/en-US/firefox/addon/bandcamp-tagger/ |
| F1 | 2026-10 | Firefox Add-ons search by users: Volume Control for Bandcamp is first (6,665 daily users), then Batchcamp (1,563), Bandcamp Tempo Adjust, Bandcamp+ and BES | https://addons.mozilla.org/api/v5/addons/search/?q=bandcamp&sort=users&app=firefox |
| G1 | 2026-09 | hyphmongo/batchcamp, a bulk downloader (150 stars); issues ask to skip existing files and download free releases | https://github.com/hyphmongo/batchcamp/issues |
| G2 | 2026-10-01 | BES #308: wants a listened state on feed albums, to hide what's been processed | https://github.com/sabjorn/BandcampEnhancementSuite/issues/308 |
| G3 | 2024-12-09 | BES #206: old purchases skew FindMusic.club recommendations; wants to exclude items | https://github.com/sabjorn/BandcampEnhancementSuite/issues/206 |
| G4 | 2026-08-23 | BES #288: a DJ asks what data FindMusic.club transmits and how it's handled | https://github.com/sabjorn/BandcampEnhancementSuite/issues/288 |
| G5 | 2026-03-09 | BES #231: mark an item as owned | https://github.com/sabjorn/BandcampEnhancementSuite/issues/231 |
| G6 | 2025-06-06 | borbiuk/band-play #12: show already visited albums | https://github.com/borbiuk/band-play/issues/12 |
| G7 | 2017–2024 | SvDvorak/CampExplorer (multi-tag search): exclude tags (#1), filter by license (#12), filter by recently added (#22) | https://github.com/SvDvorak/CampExplorer/issues |
| G8 | 2026-03-19 | band-play #16: asks for the Firefox version to work again | https://github.com/borbiuk/band-play/issues/16 |
| G9 | 2023-03-02 | bamdadfr/bandcamp-plus #220: listening history | https://github.com/bamdadfr/bandcamp-plus--extension/issues/220 |
| G10 | 2026-02-09 | GitHub discussion for Bandcamp Play: asks for onboarding, custom hotkeys, download progress | https://github.com/orgs/community/discussions/186718 |

### Forums and Bandcamp

| ID | Date | Summary | URL |
| --- | --- | --- | --- |
| K1 | 2026-02-19 / 20 | KVR "Where/How do you find new music in 2026?": Bandcamp and Discogs; best hits from other artists on the same labels | https://www.kvraudio.com/forum/viewtopic.php?p=9204904 |
| L1 | 2026-07-22 | Lines: the Bandcamp feed of purchases by people you follow is a nice discovery feature | https://llllllll.co/t/74893/53 |
| L2 | 2024-12-19 / 2024-03-01 | Lines: items kept on the wishlist for the next Bandcamp Friday | https://llllllll.co/t/69858/15 · https://llllllll.co/t/30348/746 |
| L3 | 2025-07-26 | Lines: iPhone app shows a label's page years out of date | https://llllllll.co/t/70464/192 |
| D1 | about 2022 ("over 4 years ago") | Discogs forum: no way to batch-import a Bandcamp collection into Discogs | https://www.discogs.com/forum/thread/997880 |
| B1 | 2026-07-16 | Bandcamp blog: Discover can filter by artists you follow; Subsonic API (beta) for streaming your collection | https://blog.bandcamp.com/2026/07/16/discover-improvements-and-subsonic-implementation/ |
| B2 | 2025-05 | Bandcamp Playlists (beta), built from owned tracks, app first | https://blog.bandcamp.com/2025/ · https://www.hypebot.com/hypebot/2025/05/bandcamp-adds-shareable-playlists.html |
| B3 | 2026-10-24 (checked) | Bandcamp Daily articles have no reader comments | https://daily.bandcamp.com/features/bandcamp-fridays |
| X1 | 2026 | Competitor pages: Badger (accounts, crates, BPM and key) and crates.app (library kept locally; Bandcamp import by extension) | https://badger.greenlight.hr/ · https://crates.app/ |

## Appendix: Dighead inventory (as of v0.3.0)

Limits: a Chrome MV3 extension with no backend. All data stays local in IndexedDB, and the only inputs are Bandcamp's public pages and JSON, plus your own logged-in pages through the service worker.

**Shipping**

- **Sync me:** your collection, wishlist and follows, incrementally, on startup, daily, and after a purchase.
- **Scanner:** a polite queue (1.5–3 s pace, daily budget, backoff, survives worker suspension) that reads release supporters and fan collections.
- **Smarter supporter scanning:** ranks a release's supporters by "items in common" before reading their collections in full.
- **Also bought:** a release-page sidebar of what that release's supporters also own, with a small-release fallback and a crate mate boost.
- **Crate mates:** a leaderboard of fans whose collections overlap yours, with a label-cluster down-weight, *All time / Lately* boards and a trend column.
- **For you:** recommendations from your top crate mates, in All time, Fresh and Deep cuts modes, with reason lines and preview, wishlist and hide buttons.
- **Crate mates' latest:** a feed of what your top crate mates bought in the last 60 days.
- **Profile badges:** "your #4 crate mate · 37 in common" on other fans' pages.
- **Following tags:** the following tab redrawn as cards with tags, a filter bar, bulk tagging, unfollow tracking and crate mate rank.
- **Wishlist tags:** the wishlist tab redrawn as a grid of playable cards with tags, search, a filter and bulk tagging.
- **Tag on heart:** a tag picker opens when you wishlist a release.
- **Following as a signal:** followed artists and labels get a ×1.25 boost and a "you follow" reason.
- **Ignoring compilations:** VA releases are left out of crate mate overlap and down-weighted as picks.
- **Page badges** (off by default): owned, wishlisted and crate mate counts next to release links on any page.
- **Popup:** sync and scanner status, pause, budget, settings, full backup and restore (gzipped), tag export and import, clear data.
- **Error states** everywhere: offline, budget reached, backoff, parser broken.

**Planned or open** (ROADMAP)

- Try the wishlist takeover, page badges and tag-on-heart on live pages.
- Tune weights from real use, then 2–4 weeks of dogfooding.
- Deep cuts: an early-adopter boost, and β adapted to how mainstream you are.
- Queue followed fans' collections at seed priority, if they prove good crate mates.
- Web Store release: name, icon, screenshots, submission.
- Backlog: M3U export of picks, and a Firefox port.
- Built since this research (decisions §24): wishlist sort, notes and buy next (#3), collection tab takeover (#6), Bandcamp Friday shortlist (#8), CSV export (#9).
