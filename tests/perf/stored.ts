// Perf seeds write rows straight into tables, so they must be in the stored shape: items as v12
// keeps them (decisions §19) and ownership packed as v21 does (§27). Otherwise the checks would
// time the old layout.

import {
  type BandRecord,
  buildPackedOwnership,
  type ItemRecord,
  type OwnershipRecord,
  storeItem,
} from '../../src/db';

export function storedRows(items: ItemRecord[], rows: OwnershipRecord[]) {
  const bands = new Map<number, BandRecord>();
  const stored = items.map((item) => {
    const { stored, band } = storeItem(item, bands.get(item.bandId));
    if (band) bands.set(band.bandId, band);
    return stored;
  });
  return { items: stored, bands: [...bands.values()], ...buildPackedOwnership(rows) };
}
