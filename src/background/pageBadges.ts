// Answers a page's batch of release links with what its badges say (decisions §15).

import { type CraterDb, pageBadges } from '../db';
import type { PageBadge, ReleaseRef } from '../shared/pageBadges';
import { loadSettings } from '../shared/settings';

export async function getPageBadges(
  db: CraterDb,
  links: ReleaseRef[],
): Promise<(PageBadge | null)[]> {
  const { topCrateMatesK } = await loadSettings();
  return pageBadges(db, links, topCrateMatesK);
}
