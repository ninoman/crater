# Dighead privacy policy

*"Dighead" is a placeholder for the final name (ROADMAP 8.1). Replace it, the contact address and the date before publishing. Keep `docs/privacy.html` in step with this file.*

**Last updated:** 2026-10-20

Dighead is a Chrome extension that builds a database of Bandcamp fans and their collections, then uses it to suggest music (*Also bought*, *Taste twins*, *For you*). This policy says what it reads, where that data goes, and how to delete it.

## The short version

- Everything Dighead collects stays **on your computer**, in your browser's local storage (IndexedDB and `chrome.storage`).
- Dighead has **no server**. It does not send data to us or to anyone else.
- There are **no analytics**, telemetry, crash reporting, ads or trackers.
- Its only network traffic goes to Bandcamp, and is the same kind of request Bandcamp's own pages make.
- You can delete everything at any time (see "Deleting your data").

## What Dighead reads from Bandcamp

Dighead only runs on `bandcamp.com` and its subdomains.

- **The page you are viewing.** On Bandcamp pages the extension reads the page's own data: the release you are looking at (title, artist, label, tags, id), and who is logged in (your Bandcamp fan id and username), so it can tell which collection is yours.
- **Public data about other fans and releases.** To find the people who bought a release, and what else they bought, Dighead requests public Bandcamp data: a release's list of supporters, each supporter's public collection and wishlist, and the release pages themselves. For each fan it stores their fan id, username, display name, avatar id and the items in their public collection. These requests are sent without your login where Bandcamp doesn't need it (release pages).
- **Your own collection and wishlist.** To sync your own collection, Dighead's background service worker calls Bandcamp's collection API **with your Bandcamp session cookies** (the browser attaches them, as it does for Bandcamp's own pages). This lets it read a wishlist you've set to private. The cookies are sent only to `bandcamp.com`. Dighead cannot read their values and does not store them.

The same session cookies are attached to the requests that read other fans' public collections. They go to Bandcamp only, as with any Bandcamp page.

Dighead does not read your payment details, email address, messages or anything else on Bandcamp, and never changes your Bandcamp account.

## What is stored, and where

Everything below is stored locally on your device:

- Scanned fans and their collections, release and supporter lists, the recommendation index and the taste-twin leaderboard.
- Your own synced collection and wishlist, your Bandcamp fan id and username, and the time of your last sync.
- Releases you hid, and the scan queue.
- Your settings, plus the scanner's pacing state (back-off, daily request count) and small interface preferences, in `chrome.storage.local`.
- A short-lived list of release pages open in tabs, in `chrome.storage.session` (cleared when the browser closes).

All recommendations are computed on your device from this data.

## What is sent to third parties

Nothing. Dighead does not transmit stored data anywhere. Cover art and avatars are loaded from Bandcamp's image servers (`bcbits.com`), and the optional preview player is Bandcamp's own embedded player. Both are loaded by your browser from Bandcamp, as on Bandcamp itself.

We do not sell, share or use your data for advertising or credit decisions, and we do not use it for anything other than the extension's single purpose.

## Deleting your data

- **Clear all data:** open the Dighead popup and use **Clear all data**. It deletes scanned fans and collections, your synced collection, taste twins, hidden releases and the scan queue. Your settings are kept.
- **Uninstall:** removing the extension from `chrome://extensions` deletes all of its stored data, including settings.

Because the data never leaves your device, we can't see it and have nothing to delete on our side.

## Children

Dighead is not directed at children.

## Changes

If this policy changes, the new version will be published at the same address with a new date.

## Contact

[contact email: to be added]
