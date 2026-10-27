# Chrome Web Store listing: compliance text

*Facts below were checked against `src/manifest.ts` and the code on 2026-10-24. Re-check them if the manifest changes.*

## Single purpose

Crater helps you discover music on Bandcamp. It builds a local database of Bandcamp fans and their collections, and uses it to show who else bought a release, which fans share your taste, and what to buy next.

## Short description (manifest `description`)

Purchase-based discovery for Bandcamp. Everything stays in your browser.

## Detailed description (draft)

Paste as is. The store shows plain text and doesn't render Markdown, hence the capitals and • bullets.

```text
Find your next favourite record through what real Bandcamp fans actually bought.

Crater looks at the collections of people who bought the music you love, and turns them into recommendations right inside Bandcamp. No algorithms trained on streams, no sponsored picks: just purchases.

WHAT YOU GET

• Also bought: on any album or track page, a sidebar shows what other buyers of that release also own, ranked by how strongly they're connected, not just by popularity. Small releases fall back to the same label and artist.

• Crate mates: a new tab on your profile ranks the fans whose collections overlap yours most. Switch between All time and Lately to see who shares your taste right now, with trends and "this year" counts. On other fans' pages you'll see where they rank ("your #4 crate mate · 37 in common").

• For you: a second tab on your profile, with three parts:
  – Picks: releases your crate mates own that you don't, in three modes. All time gives the strongest picks from your closest crate mates, Fresh what they've been buying recently, and Deep cuts rare releases with only a handful of owners.
  – Crate mates' latest: a feed of what your top crate mates just bought.
  – New from follows: new releases from the artists and labels you follow, with what's new since your last visit at the top. Filter by your follow tags, mute any account, and turn on a desktop notification for new releases if you like.

• Listen as you dig: preview any pick from its cover, or press Play all and work through a whole list with next, previous and keyboard shortcuts. Anything you've listened to gets a "heard" mark, and you can hide heard releases from any list.

• Tags for follows and wishlist: tag the artists, labels and fans you follow, and the releases on your wishlist, then filter by tag and tag many at once. Tag as you go: heart a release and the tag picker opens right next to the heart; follow an artist, label or fan and their tags are ready on their page straight away. Tags also show on each artist's and release's own page, and stay with a release after you buy it.

• Your wishlist and follows, fast: both tabs fill in while your first sync is still running, and stay quick with thousands of items, loading more as you scroll.

• Page badges (optional): small markers next to release links show what you already own, what's on your wishlist and how many crate mates have it.

• Smarter picks: artists and labels you follow get a gentle boost, compilations are down-weighted, and you can preview, wishlist or hide any suggestion in one click, or hide everything by an artist or label.

PRIVATE BY DESIGN

Everything stays in your browser. There's no account, no server, no analytics and no tracking. Crater only talks to Bandcamp, at a slow, polite pace, with a daily request limit.

YOU'RE IN CONTROL

The popup shows scan progress and lets you pause or resume. You can tune the scanner, turn the tag picker on or off, unhide anything you've hidden, export your wishlist, collection or For you list as CSV, back up or restore your database, export and import your tags, and clear all data at any time.

HOW IT WORKS

Open Bandcamp while signed in. Crater syncs your collection, wishlist and follows, then gradually reads the public collections of fans who bought the same releases. Recommendations get better the more you browse: every release page you open is scanned first.

Crater is an independent project and isn't affiliated with Bandcamp.
```

## Manifest permissions

| Permission | Used for | Justification (for the store form) |
| --- | --- | --- |
| `storage` | `chrome.storage.local` for settings, scanner pacing/back-off state and UI preferences; `chrome.storage.session` for the list of release pages open in tabs | Stores the user's settings and the scanner's small working state on their device. The large database lives in IndexedDB, which needs no permission. |
| `alarms` | `chrome.alarms` in the service worker | Wakes the service worker to continue the background scan queue at a polite pace (a service worker can't keep timers alive between wake-ups) and to check for a due re-sync. |

Optional, asked for at runtime:

| Permission | Used for | Justification (for the store form) |
| --- | --- | --- |
| `notifications` | `chrome.notifications` in the service worker, only when the user turns on "Notify me about new releases" in the popup | Shows one desktop notification when the weekly check of the artists and labels the user follows finds new releases. Off by default; Chrome asks for the permission when the user turns it on, and it's never needed otherwise (decisions §23). |

Not requested: `tabs`, `cookies`, `activeTab`, `scripting`, `webRequest`, `history`, `downloads`, `identity`. `chrome.tabs.query` and `tabs.sendMessage` are used only on Bandcamp URLs, which the host permission already covers, so the `tabs` permission isn't needed. Cookies are never read; the browser attaches them to the worker's fetches to Bandcamp (`credentials: 'include'`).

## Host permissions

Declared as `https://bandcamp.com/*` and `https://*.bandcamp.com/*`. The same patterns are the content-script matches.

| Host | Justification |
| --- | --- |
| `https://bandcamp.com/*` | The service worker calls Bandcamp's collection, wishlist and supporters endpoints, reads the public release lists of the artists and labels the user follows (`/api/mobile/24/band_details` and `tralbum_details`), and loads fan pages. Without this permission those cross-origin requests fail. It also lets the worker send the user's own Bandcamp session cookies, so their private wishlist can be synced. The content script runs here to show the profile tabs and fan-page rank. |
| `https://*.bandcamp.com/*` | Artists and labels host their release pages on subdomains. The content script runs here to show the *Also bought* sidebar, and the worker fetches release pages from these hosts to read tags, label and supporter tokens. |

No other host is contacted by script. Images from `f4.bcbits.com` and Bandcamp's embedded player are loaded by the page like any other image or frame, which needs no host permission. Custom-domain Bandcamp sites are out of scope.

## Remote code

None. All code ships in the package.

## Data usage disclosures (for the Privacy tab)

- **Data collected:** website content (Bandcamp release and public fan/collection data); personally identifiable information in the form of Bandcamp fan ids and usernames; web history in the sense of the user's Bandcamp purchases. All of it is stored locally only.
- **Not collected:** health, financial or payment info, authentication information (cookies are not read or stored), personal communications, location, user activity beyond the pages above.
- **Certifications:** data is not sold; not used for anything unrelated to the single purpose; not used for creditworthiness or lending.
- **Privacy policy URL:** host `docs/privacy.html` (e.g. GitHub Pages) and enter its address here.
