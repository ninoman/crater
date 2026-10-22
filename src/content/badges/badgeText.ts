import type { PageBadge } from '../../shared/pageBadges';

export interface BadgeText {
  label: string;
  /** The long form, for the hover hint. */
  hint: string;
}

/** "owned", "wishlist", "3 twins" or "wishlist · 3 twins"; null when there's nothing to say. */
export function badgeText(badge: PageBadge): BadgeText | null {
  if (badge.owned) return { label: 'owned', hint: 'In your collection' };
  const labels: string[] = [];
  const hints: string[] = [];
  if (badge.wishlisted) {
    labels.push('wishlist');
    hints.push('In your wishlist');
  }
  if (badge.twins > 0) {
    labels.push(badge.twins === 1 ? '1 twin' : `${badge.twins} twins`);
    hints.push(`${badge.twins} of your top ${badge.topTwins} twins own this`);
  }
  return labels.length > 0 ? { label: labels.join(' · '), hint: hints.join('. ') } : null;
}
