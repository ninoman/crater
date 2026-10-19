import { readBlobById } from './html';
import { rawViewerPagedata } from './schemas';
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
