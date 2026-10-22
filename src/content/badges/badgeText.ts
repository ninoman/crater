import type { PageBadge } from '../../shared/pageBadges';

export interface BadgeText {
  label: string;
  /** The long form, for the hover hint. */
  hint: string;
}

/** "owned", "wishlist", "3 crate mates" or "wishlist · 3 crate mates"; null when there's nothing to say. */
export function badgeText(badge: PageBadge): BadgeText | null {
  if (badge.owned) return { label: 'owned', hint: 'In your collection' };
  const labels: string[] = [];
  const hints: string[] = [];
  if (badge.wishlisted) {
    labels.push('wishlist');
    hints.push('In your wishlist');
  }
  if (badge.crateMates > 0) {
    labels.push(badge.crateMates === 1 ? '1 crate mate' : `${badge.crateMates} crate mates`);
    hints.push(`${badge.crateMates} of your top ${badge.topCrateMates} crate mates own this`);
  }
  return labels.length > 0 ? { label: labels.join(' · '), hint: hints.join('. ') } : null;
}
