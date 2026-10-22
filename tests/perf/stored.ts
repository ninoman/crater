// Perf seeds write rows straight into tables, so they must be in the stored (v12) shape:
// otherwise the checks would time the old one (decisions §19).

import {
  type BandRecord,
  type ItemRecord,
  type OwnershipRecord,
  storeItem,
  storeOwnership,
} from '../../src/db';

export function storedRows(items: ItemRecord[], rows: OwnershipRecord[]) {
  const bands = new Map<number, BandRecord>();
  const stored = items.map((item) => {
    const { stored, band } = storeItem(item, bands.get(item.bandId));
    if (band) bands.set(band.bandId, band);
    return stored;
  });
  return { items: stored, bands: [...bands.values()], ownership: rows.map(storeOwnership) };
}
