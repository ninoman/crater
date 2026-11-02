// Where Bandcamp's fan page keeps its collection tabs and grids (see me-fan-page.html).
// The profile integration injects its own tabs among these, so this is the one place that knows
// the markup.

export const FAN_PAGE_DOM = {
  /** The name block of the profile header; the crate mate badge goes at its end, under the `<h1>`. */
  name: '.fan-bio:not(.edit) .fan-bio-inner .name',
  /** Wraps the tab bar and every grid. */
  grids: '#grids',
  /** The `<ol>` of tabs: collection, playlists, wishlist, followers, following. */
  tabList: '#grid-tabs',
  /** Bandcamp's own tabs inside the list. */
  tab: 'li[data-tab]',
  /** Class on the selected tab. Bandcamp's CSS draws the underline from it. */
  activeTabClass: 'active',
  /** Sticky bar holding the tabs and search; content shown for a tab goes right after it. */
  tabBar: '.grid-tabs-anchor',
  /** Bandcamp's tab contents and their search and visibility controls. */
  tabContents: ['.grid', '.owner-controls'],
  /** Bandcamp's wishlist tab; `active` while open, like every grid (me-fan-page.html). */
  wishlistGrid: '#wishlist-grid',
  /** Inside it: what holds Bandcamp's paged list of items and its "view all" button. */
  wishlistItems: '#wishlist-items',
  /** Bandcamp's search over its paged wishlist, in the tab bar; ours replaces it (decisions §14). */
  wishlistSearch: '#wishlist-search',
  /**
   * Bandcamp's collection tab, open when the page loads. Its items holder has the same parts as
   * the wishlist's, but the first 20 items are already rendered, in an `ol` marked `editable`
   * followed by a second, empty one (me-fan-page.html, decisions §24).
   */
  collectionGrid: '#collection-grid',
  collectionItems: '#collection-items',
  collectionSearch: '#collection-search',
  /** In either holder: Bandcamp's own lists and "view all", hidden while ours stands in (§14). */
  itemsNativeList: 'ol.collection-grid',
  itemsExpand: '.expand-container',
  /** An item card in a fan's collection or wishlist, with the release's ids as data attributes. */
  itemCard: 'li.collection-item-container',
  /**
   * The card's wishlist control. Bandcamp swaps these classes on it when you click, and `purchased`
   * replaces them on what you own (fan-page-in-common.html, decisions §21).
   */
  itemActions: '.collection-item-actions',
  itemActionsOn: 'wishlisted',
  itemActionsOff: 'wishlist',
  /** The card's second copy of its title, without the first's hidden "(gift given)" note. */
  itemTitle: '.item-link-alt .collection-item-title',
  itemArtist: '.item-link-alt .collection-item-artist',
  itemLink: 'a.item-link',
  itemArt: 'img.collection-item-art',
  /** Bandcamp's following tab; it has `active` while open (me-following-tab.html). */
  followingGrid: '#following-grid',
  /** The sub-tabs inside it: artists & labels, fans, genres. `active` marks the open one. */
  followingSubTab: '#following-tabs li[data-tab]',
  followingSubTabs: {
    band: 'li[data-tab="following-bands"]',
    fan: 'li[data-tab="following-fans"]',
  },
  /** Each sub-tab's container, also `active` while open. */
  followingContainers: {
    band: '#following-bands-container',
    fan: '#following-fans-container',
  },
  /** Inside a container: Bandcamp's own paged list and "view all" button, both hidden for ours. */
  followingNativeList: 'ol.followeer-grid',
  /** The class Bandcamp's CSS lays a list of cards out by; our own list carries it too. */
  followingListClass: 'followeer-grid',
  followingExpand: '.expand-container',
  /** A card and its follow button, which Bandcamp's own handler listens on. */
  followingCard: 'li.followeer',
  /** A card's avatar box; our select box sits over its corner. */
  followingImage: '.fan-image',
  followButton: 'button.follow-unfollow',
  /** Class on a follow button while you follow; Bandcamp's handler toggles it. */
  followingButtonClass: 'following',
} as const;
