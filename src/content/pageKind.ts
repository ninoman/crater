import { BAND_PAGE_DOM, hasTralbumItem, isOwnFanPage, ParserError } from '../bandcamp';

/**
 * `own-fan` is the logged-in fan's own profile; `fan` is anyone else's; `band` is an artist's or
 * label's home page (`/` and `/music` on its subdomain).
 */
export type PageKind = 'release' | 'band' | 'own-fan' | 'fan' | 'other';

/** Works out which Bandcamp page we're on from markers in the DOM, not the URL. */
export function detectPageKind(doc: Document): PageKind {
  // Band home pages carry `data-tralbum` too, with a url and no item.
  const tralbum = doc.querySelector('[data-tralbum]');
  if (tralbum && isReleaseTralbum(tralbum)) return 'release';
  const pagedata = doc.getElementById('pagedata');
  if (pagedata && doc.querySelector('#fan-banner, .fan-bio')) {
    return isOwnPage(pagedata) ? 'own-fan' : 'fan';
  }
  if (tralbum && doc.querySelector(BAND_PAGE_DOM.name)) return 'band';
  return 'other';
}

function isReleaseTralbum(tag: Element): boolean {
  try {
    return hasTralbumItem(tag.outerHTML);
  } catch (error) {
    // A release page whose blob changed shape: let the sidebar report "parser broken".
    if (error instanceof ParserError) return true;
    throw error;
  }
}

function isOwnPage(pagedata: Element): boolean {
  try {
    // Only the #pagedata element, not the whole page.
    return isOwnFanPage(pagedata.outerHTML);
  } catch (error) {
    if (error instanceof ParserError) {
      console.warn('crater: cannot tell whether this is your own fan page', error);
      return false;
    }
    throw error;
  }
}
