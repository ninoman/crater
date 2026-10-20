import { readBlobById } from './html';
import { rawViewedFanPagedata } from './schemas';
import { validate } from './validate';

/**
 * The fan whose profile this is (`fan_data.fan_id`). Accepts a whole page or just the
 * `#pagedata` element's outerHTML, so the content script needn't parse the full collection.
 * Throws ParserError when the blob has no fan; null when there is no `#pagedata`.
 */
export function parseViewedFanId(html: string): number | null {
  const json = readBlobById(html, 'pagedata');
  if (json === null) return null;
  return validate(rawViewedFanPagedata, json, '#pagedata').fan_data.fan_id;
}
