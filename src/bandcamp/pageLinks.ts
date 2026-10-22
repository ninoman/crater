// Finds release links on any Bandcamp page and what they point at, without fetching (decisions §15).

import { itemKey } from './keys';
import { PAGE_LINKS_DOM } from './pageLinksDom';
import type { ItemKey } from './types';

/** A link to a release, keyed by its id when the page carries one, else by its URL. */
export interface PageReleaseLink {
  anchor: HTMLAnchorElement;
  /** Normalised: `https://host/album|track/slug`, the shape of a stored item's url. */
  url: string;
  itemKey: ItemKey | null;
}

const RELEASE_PATH = /^\/(album|track)\/([^/]+)\/?$/;

/**
 * `https://<host>/<album|track>/<slug>` for a release link, or null for anything else.
 * Relative hrefs resolve against `base`. Query, hash and a trailing slash are dropped.
 */
export function releaseUrl(href: string, base: string): string | null {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const match = RELEASE_PATH.exec(url.pathname);
  if (!match) return null;
  return `https://${url.hostname.toLowerCase()}/${match[1]}/${match[2]}`;
}

const ID_CARDS = [
  PAGE_LINKS_DOM.fanItem,
  PAGE_LINKS_DOM.bandItem,
  PAGE_LINKS_DOM.recommendedAlbum,
].join(', ');

/** The release id a card carries, if the anchor sits in one. */
function cardItemKey(anchor: Element): ItemKey | null {
  const fan = anchor.closest(PAGE_LINKS_DOM.fanItem);
  if (fan) {
    const type = fan.getAttribute('data-tralbumtype');
    const id = Number(fan.getAttribute('data-tralbumid'));
    return (type === 'a' || type === 't') && id > 0 ? itemKey(type, id) : null;
  }
  const band = anchor.closest(PAGE_LINKS_DOM.bandItem);
  if (band) {
    const match = /^(album|track)-(\d+)$/.exec(band.getAttribute('data-item-id') ?? '');
    return match ? itemKey(match[1] === 'album' ? 'a' : 't', Number(match[2])) : null;
  }
  const recommended = anchor.closest(PAGE_LINKS_DOM.recommendedAlbum);
  if (recommended) {
    const id = Number(recommended.getAttribute('data-albumid'));
    return id > 0 ? itemKey('a', id) : null;
  }
  return null;
}

function hasText(anchor: Element): boolean {
  return (anchor.textContent ?? '').trim() !== '';
}

/** Buy and gift links point at a release too, but they're buttons, not the release. */
function isAction(anchor: HTMLAnchorElement): boolean {
  return /[?&]action=/.test(anchor.getAttribute('href') ?? '');
}

/**
 * Release links under `root` worth a badge. `pageUrl` is the page they're on: relative links
 * resolve against it, and links back to it are left out. One link per release per card (`<li>`),
 * so a card's title and its "more" link don't both get one.
 *
 * Every anchor looked at goes into `seen` and is skipped on later calls, so re-running this as
 * the page grows only returns new links.
 */
export function findReleaseLinks(
  root: ParentNode,
  pageUrl: string,
  seen: WeakSet<Element> = new WeakSet(),
): PageReleaseLink[] {
  const self = releaseUrl(pageUrl, pageUrl);
  const links: PageReleaseLink[] = [];
  const perCard = new Map<Element, Set<string>>();
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (seen.has(anchor)) continue;
    seen.add(anchor);
    if (!hasText(anchor) || isAction(anchor)) continue;
    if (anchor.closest(PAGE_LINKS_DOM.skip)) continue;
    const url = releaseUrl(anchor.getAttribute('href') ?? '', pageUrl);
    if (!url || url === self) continue;
    // The id card first: cards nest small lists of their own ("buy now", "hear more").
    const card = anchor.closest(ID_CARDS) ?? anchor.closest('li');
    if (card) {
      const urls = perCard.get(card) ?? new Set();
      if (urls.has(url)) continue;
      perCard.set(card, urls.add(url));
    }
    links.push({ anchor, url, itemKey: cardItemKey(anchor) });
  }
  return links;
}
