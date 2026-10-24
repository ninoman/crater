import type { ItemKey } from '../../bandcamp';
import type { HideTarget } from '../../shared/hide';
import type { DigheadDb, HideRecord } from '../schema';

/** Everything hidden, by kind: what every recommender filters with (decisions §22). */
export interface HiddenSets {
  /** matchKeys */
  releases: Set<ItemKey>;
  /** Band account ids of hidden artists. */
  bands: Set<number>;
  /** Band account ids of hidden labels. */
  labels: Set<number>;
}

function recordFor(target: HideTarget, now: number): HideRecord {
  switch (target.kind) {
    case 'release':
      return { kind: 'release', key: target.matchKey, hiddenAt: now };
    case 'band':
      return { kind: 'band', key: target.bandId, name: target.name, hiddenAt: now };
    case 'label':
      return { kind: 'label', key: target.labelId, name: target.name, hiddenAt: now };
  }
}

function keyOf(target: HideTarget): [HideRecord['kind'], HideRecord['key']] {
  switch (target.kind) {
    case 'release':
      return ['release', target.matchKey];
    case 'band':
      return ['band', target.bandId];
    case 'label':
      return ['label', target.labelId];
  }
}

/** Hides a release, artist or label from every recommender. Hiding again keeps the first time. */
export async function hide(db: DigheadDb, target: HideTarget, now: number): Promise<void> {
  await db.transaction('rw', db.hides, async () => {
    if (!(await db.hides.get(keyOf(target)))) await db.hides.put(recordFor(target, now));
  });
}

/** Undoes a hide. A heard mark on the release is left as it was. */
export async function unhide(db: DigheadDb, target: HideTarget): Promise<void> {
  await db.hides.delete(keyOf(target));
}

export async function hiddenSets(db: DigheadDb): Promise<HiddenSets> {
  const sets: HiddenSets = { releases: new Set(), bands: new Set(), labels: new Set() };
  for (const row of await db.hides.toArray()) {
    if (row.kind === 'release') sets.releases.add(row.key);
    else if (row.kind === 'band') sets.bands.add(row.key);
    else sets.labels.add(row.key);
  }
  return sets;
}

/** Every hide, newest first. */
export async function listHides(db: DigheadDb): Promise<HideRecord[]> {
  const rows = await db.hides.toArray();
  return rows.sort((a, b) => b.hiddenAt - a.hiddenAt);
}

/** A stored hide as the target the UI sends back to unhide it. */
export function hideTarget(row: HideRecord): HideTarget {
  if (row.kind === 'release') return { kind: 'release', matchKey: row.key };
  return row.kind === 'band'
    ? { kind: 'band', bandId: row.key, name: row.name }
    : { kind: 'label', labelId: row.key, name: row.name };
}
