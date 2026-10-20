import { readBlobById } from './html';
import { rawOwnPagePagedata, rawViewerPagedata } from './schemas';
import type { Viewer } from './types';
import { validate } from './validate';

/**
 * Reads the logged-in fan from `#pagedata` (`identities.fan`), present on fan, album and track
 * pages. Accepts a whole page or just the `#pagedata` element's outerHTML.
 * Returns null when logged out or when the page has no `#pagedata`.
 */
export function parseViewer(html: string): Viewer | null {
  const json = readBlobById(html, 'pagedata');
  if (json === null) return null;
  const fan = validate(rawViewerPagedata, json, '#pagedata').identities?.fan;
  return fan ? { fanId: fan.id, username: fan.username } : null;
}

/**
 * True on the logged-in fan's own profile (`fan_data.is_own_page`). Accepts a whole page or just
 * the `#pagedata` element's outerHTML. False on other pages and other fans' profiles.
 */
export function isOwnFanPage(html: string): boolean {
  const json = readBlobById(html, 'pagedata');
  if (json === null) return false;
  return validate(rawOwnPagePagedata, json, '#pagedata').fan_data?.is_own_page === true;
}
