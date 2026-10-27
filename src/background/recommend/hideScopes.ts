// What a row's "Hide from recommendations" menu offers beyond the release (decisions §22).

import { type CraterDb, type ItemRecord, multiArtistSellers, releaseUrlHost } from '../../db';
import type { HideScopes } from '../../shared/hide';

type ScopeFacts = Pick<ItemRecord, 'bandId' | 'labelId' | 'label' | 'artist' | 'url'>;

/**
 * The artist and label behind an item. A `labelId` is only set on releases sold from the
 * artist's own account (decisions §3.3), so then `bandId` is the artist's. Without one, the
 * selling account is the artist's unless it's seen selling other artists too: then it's a
 * label's, whose name we don't know, so its host stands in. Offering "everything by" a label's
 * account would hide its whole catalog.
 */
export function hideScopes(item: ScopeFacts, sellsManyArtists: boolean): HideScopes {
  const band =
    item.labelId === null && sellsManyArtists
      ? null
      : { kind: 'band' as const, bandId: item.bandId, name: item.artist };
  if (item.labelId !== null) {
    return {
      band,
      label: { kind: 'label', labelId: item.labelId, name: item.label ?? 'this label' },
    };
  }
  if (!sellsManyArtists) return { band, label: null };
  const name = releaseUrlHost(item.url) ?? 'this label';
  return { band, label: { kind: 'label', labelId: item.bandId, name } };
}

/** hideScopes for the rows about to be shown, keyed like `items`. */
export async function loadHideScopes<K>(
  db: CraterDb,
  items: ReadonlyMap<K, ScopeFacts>,
): Promise<Map<K, HideScopes>> {
  const unlabelled = [...items.values()].filter((item) => item.labelId === null);
  const many = await multiArtistSellers(db, unlabelled);
  return new Map(
    [...items].map(([key, item]) => [key, hideScopes(item, many.has(item.bandId))] as const),
  );
}
