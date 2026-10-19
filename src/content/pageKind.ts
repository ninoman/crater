export type PageKind = 'release' | 'fan' | 'other';

/** Works out which Bandcamp page we're on from markers in the DOM, not the URL. */
export function detectPageKind(doc: Document): PageKind {
  if (doc.querySelector('[data-tralbum]')) return 'release';
  if (doc.querySelector('#pagedata') && doc.querySelector('#fan-banner, .fan-bio')) return 'fan';
  return 'other';
}
