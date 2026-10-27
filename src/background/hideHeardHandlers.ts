// Message handlers for hiding from recommendations and heard marks (decisions §22). The rules
// live in the repos and in scoring/exclusions.ts.

import {
  getDisplayItems,
  hide,
  hideTarget,
  listHides,
  markHeard,
  unhide,
  unmarkHeard,
  type CraterDb,
} from '../db';
import type { HiddenEntry } from '../shared/hide';
import type { MessageHandlers } from '../shared/messages';

export type HideHeardHandlers = Pick<
  MessageHandlers,
  'hide' | 'unhide' | 'listHidden' | 'markHeard' | 'unmarkHeard'
>;

export function hideHeardHandlers(db: CraterDb): HideHeardHandlers {
  return {
    hide: async ({ target }) => {
      await hide(db, target, Date.now());
      return null;
    },
    unhide: async ({ target }) => {
      await unhide(db, target);
      return null;
    },
    listHidden: () => listHidden(db),
    markHeard: async ({ itemKey, source }) => {
      await markHeard(db, itemKey, source, Date.now());
      return null;
    },
    unmarkHeard: async ({ matchKey }) => {
      await unmarkHeard(db, matchKey);
      return null;
    },
  };
}

/** Hides newest first, releases named from their records. One whose record is gone shows its key. */
async function listHidden(db: CraterDb): Promise<HiddenEntry[]> {
  const rows = await listHides(db);
  const releases = await getDisplayItems(
    db,
    rows.flatMap((row) => (row.kind === 'release' ? [row.key] : [])),
  );
  return rows.map((row) => {
    const target = hideTarget(row);
    if (row.kind !== 'release') {
      return { target, name: row.name, url: null, hiddenAt: row.hiddenAt };
    }
    const item = releases.get(row.key);
    return {
      target,
      name: item ? `${item.artist} – ${item.title}` : row.key,
      url: item?.url ?? null,
      hiddenAt: row.hiddenAt,
    };
  });
}
