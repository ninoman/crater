// Reads what the list filters judge releases by (decisions §22), for the rows lists would show.

import type { ItemKey } from '../../bandcamp';
import type { ListFacts } from '../../shared/listFilters';
import type { BandRecord, DigheadDb, ItemFields } from '../schema';
import { readFacts, readItemFields } from '../storage';
import { shownRows } from './alsoBought';

/**
 * Bands already read by a request, by id (undefined: no record). A request that reads many chunks
 * of items keeps one, since the same bands come up again and again.
 */
export type BandFactsCache = Map<number, Pick<BandRecord, 'genre' | 'location'> | undefined>;

export interface ShownWithFacts {
  /** What getShownFields would give for the match, so a caller needn't read it twice. */
  item: ItemFields;
  facts: ListFacts;
}

/**
 * The record getDisplayItems would show for each matchKey, without its URL, with its facts. Its
 * band's genre and location are read only when a `bands` cache is given (it keeps what was read),
 * since they cost a lookup and only genre and location filters need them; they are null
 * otherwise. Matches with no record are left out: they can't be shown either.
 */
export async function getShownWithFacts(
  db: DigheadDb,
  matchKeys: readonly ItemKey[],
  { bands: cache }: { bands: BandFactsCache | null },
): Promise<Map<ItemKey, ShownWithFacts>> {
  return db.transaction('r', [db.items, db.bands], async () => {
    const shown = await shownRows(db, matchKeys);
    if (cache) {
      const unread = [...new Set([...shown.values()].map((row) => row.bandId))].filter(
        (bandId) => !cache.has(bandId),
      );
      const read = await db.bands.bulkGet(unread);
      unread.forEach((bandId, i) => cache.set(bandId, read[i]));
    }
    return new Map(
      [...shown].map(([key, row]) => {
        const band = cache?.get(row.bandId);
        const facts = readFacts(row);
        return [
          key,
          {
            item: readItemFields(row),
            facts: {
              genre: band?.genre ?? null,
              location: band?.location ?? null,
              nameYourPrice: facts?.nameYourPrice ?? null,
              physical: facts?.physical ?? null,
              year: facts?.year ?? null,
            },
          },
        ];
      }),
    );
  });
}
