// Saving the order of your collection, the way dragging a card on your own fan page does
// (decisions §29).

import type { FetchJson } from './collection';
import { BandcampApiError } from './errors';
import { readDataAttribute } from './html';
import type { FetchText } from './release';
import { collectionReorderRequest, signedInFanPageRequest } from './requests';
import { rawCrumbs, rawReorderResponse } from './schemas';
import { validate } from './validate';

const ENDPOINT = 'collection_reorder_cb';

/** Bandcamp's own grid refuses to save the order of a bigger collection. */
export const MAX_REORDER_ITEMS = 1000;

/** Bandcamp's own script retries an expired crumb twice, with the one the answer hands back. */
const CRUMB_RETRIES = 2;

/** The reorder crumb on a signed-in fan page, or null when the page has none (signed out). */
export function parseReorderCrumb(html: string): string | null {
  const json = readDataAttribute(html, 'crumbs');
  if (json === null) return null;
  return validate(rawCrumbs, json, 'data-crumbs')[ENDPOINT] ?? null;
}

export type CollectionReorder =
  | { status: 'done' }
  | { status: 'signed-out' }
  | { status: 'too-many'; limit: number };

/**
 * Reads your fan page signed in for its crumb, then saves `itemIds` as your collection's order.
 * They're Bandcamp's entry ids, every entry, in the new order.
 */
export async function saveCollectionOrder(
  fetchers: { fetchText: FetchText; fetchJson: FetchJson },
  order: { username: string; fanId: number; itemIds: readonly number[] },
): Promise<CollectionReorder> {
  if (order.itemIds.length > MAX_REORDER_ITEMS) {
    return { status: 'too-many', limit: MAX_REORDER_ITEMS };
  }
  let crumb = parseReorderCrumb(await fetchers.fetchText(signedInFanPageRequest(order.username)));
  for (let attempt = 0; crumb !== null; attempt++) {
    const json = await fetchers.fetchJson(
      collectionReorderRequest({ fanId: order.fanId, itemIds: order.itemIds, crumb }),
    );
    const response = validate(rawReorderResponse, json, ENDPOINT);
    if (response.error === undefined || response.error === false) return { status: 'done' };
    if (response.error !== 'invalid_crumb' || !response.crumb || attempt >= CRUMB_RETRIES) {
      throw new BandcampApiError(ENDPOINT);
    }
    crumb = response.crumb;
  }
  return { status: 'signed-out' };
}
