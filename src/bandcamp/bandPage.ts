import { readDataAttribute } from './html';
import { rawBandData, rawTralbumMarker } from './schemas';
import { validate } from './validate';

/**
 * The band whose page this is (`data-band.id`, set on the page's script tag on band home pages
 * and release pages alike). Accepts a whole page or just the tag's outerHTML.
 * Null when the page has no `data-band`; throws ParserError when it changed shape.
 */
export function parseBandId(html: string): number | null {
  const json = readDataAttribute(html, 'band');
  return json === null ? null : validate(rawBandData, json, 'data-band').id;
}

/**
 * True when `data-tralbum` describes a release. A band's home page carries the attribute too,
 * but with only a url, so its presence alone doesn't make a page a release page.
 */
export function hasTralbumItem(html: string): boolean {
  const json = readDataAttribute(html, 'tralbum');
  return json !== null && validate(rawTralbumMarker, json, 'data-tralbum').id != null;
}
