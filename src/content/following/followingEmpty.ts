import type { FollowKind } from '../../shared/following';

/** The sub-tab's name for a kind, as Bandcamp words it. */
export function kindLabel(kind: FollowKind): string {
  return kind === 'band' ? 'artists or labels' : 'fans';
}
