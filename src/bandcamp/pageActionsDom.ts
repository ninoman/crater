// Bandcamp's own wishlist and follow controls on release, band and fan pages (decisions §21).
// Its JS renders them after load and flips their classes when you click (page-actions.html).

export const PAGE_ACTIONS_DOM = {
  /** The heart on a release page. `#collect-item-placeholder` until Bandcamp's JS renders it. */
  heart: '#collect-item',
  /** Classes Bandcamp swaps on the heart: optimistic, and reverted if the request fails. */
  heartOn: 'wishlisted',
  heartOff: 'wishlist',
  /**
   * Holds the follow button on band, release and fan pages. Bandcamp re-renders the button
   * inside it (after a mailing-list sign-up, say), so watch this, not the button.
   */
  followArea: '#following-actions',
  followButton: 'button.follow-unfollow',
  /** On the button while you follow; `subscribed` replaces it once you join the mailing list. */
  followOn: ['following', 'subscribed'],
} as const;
