import { isOwnFanPage, ParserError } from '../bandcamp';

/** `own-fan` is the logged-in fan's own profile; `fan` is anyone else's. */
export type PageKind = 'release' | 'own-fan' | 'fan' | 'other';

/** Works out which Bandcamp page we're on from markers in the DOM, not the URL. */
export function detectPageKind(doc: Document): PageKind {
  if (doc.querySelector('[data-tralbum]')) return 'release';
  const pagedata = doc.getElementById('pagedata');
  if (pagedata && doc.querySelector('#fan-banner, .fan-bio')) {
    return isOwnPage(pagedata) ? 'own-fan' : 'fan';
  }
  return 'other';
}

function isOwnPage(pagedata: Element): boolean {
  try {
    // Only the #pagedata element, not the whole page.
    return isOwnFanPage(pagedata.outerHTML);
  } catch (error) {
    if (error instanceof ParserError) {
      console.warn('dighead: cannot tell whether this is your own fan page', error);
      return false;
    }
    throw error;
  }
}
