// Where a release's preview starts (decisions §22). Pure.

import type { ItemKey, PreviewTrack } from '../bandcamp';

/**
 * The track the most fans bought on its own, since that's usually why the release was
 * recommended: on a compilation, the one artist its buyers came for. Ties go to the earlier
 * track. With no single-track buys, Bandcamp's featured track (`featured`).
 */
export function previewStartIndex(
  tracks: readonly Pick<PreviewTrack, 'itemKey'>[],
  buyers: ReadonlyMap<ItemKey, number>,
  featured: number,
): number {
  let best = featured;
  let bestCount = 0;
  tracks.forEach((track, index) => {
    const count = track.itemKey === null ? 0 : (buyers.get(track.itemKey) ?? 0);
    if (count > bestCount) {
      best = index;
      bestCount = count;
    }
  });
  return best;
}
