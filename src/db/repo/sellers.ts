import type { DigheadDb } from '../schema';

/**
 * Items read per account. A label's first few releases almost always name several artists, and
 * reading whole catalogs made Also bought three times slower (decisions §22).
 */
const SAMPLE = 25;

/**
 * Of these selling accounts, the ones stored items show selling more than one artist: a label's
 * own account rather than an artist's (decisions §6, §22). Compilations don't count, since an
 * artist may sell one. Only the first SAMPLE items of each account are looked at.
 */
export async function multiArtistSellers(
  db: DigheadDb,
  sellers: readonly { bandId: number; artist: string }[],
): Promise<Set<number>> {
  const byBand = new Map(sellers.map((seller) => [seller.bandId, seller.artist]));
  return db.transaction('r', db.items, async () => {
    const samples = await Promise.all(
      [...byBand.keys()].map((bandId) =>
        db.items.where('bandId').equals(bandId).limit(SAMPLE).toArray(),
      ),
    );
    return new Set(
      [...byBand].flatMap(([bandId, artist], i) =>
        samples[i]?.some((item) => !item.compilation && item.artist !== artist) ? [bandId] : [],
      ),
    );
  });
}
