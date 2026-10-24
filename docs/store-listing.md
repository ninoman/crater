# Chrome Web Store listing: compliance text

*"Dighead" is a placeholder for the final name (ROADMAP 8.1). Facts below were checked against `src/manifest.ts` and the code on 2026-10-20. Re-check them if the manifest changes.*

## Single purpose

Dighead helps you discover music on Bandcamp. It builds a local database of Bandcamp fans and their collections, and uses it to show who else bought a release, which fans share your taste, and what to buy next.

## Short description (manifest `description`)

Purchase-based discovery for Bandcamp. Everything stays in your browser.

## Detailed description (draft)

Dighead adds recommendations to Bandcamp, based on what people actually bought:

- **Also bought:** on an album or track page, the releases that other buyers of it also own.
- **Crate mates:** the fans whose collections overlap yours most, on a tab on your profile and as a rank on other fans' profiles.
- **For you:** releases your crate mates own that you don't.

Dighead reads public Bandcamp pages and your own collection, and keeps everything in your browser. There is no account, no server and no tracking. The popup shows scan progress, lets you pause, tune or reset the scanner, and has a **Clear all data** button.

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
