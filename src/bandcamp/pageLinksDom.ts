// Where Bandcamp pages keep release links and the ids next to them (decisions §15).

export const PAGE_LINKS_DOM = {
  /** Cards that carry the release's id, and how to read it. */
  fanItem: 'li.collection-item-container[data-tralbumid][data-tralbumtype]',
  bandItem: 'li.music-grid-item[data-item-id]',
  recommendedAlbum: 'li.recommended-album[data-albumid]',
  /** Links that are never badged: the release's own tracklist and "go to album" buttons. */
  skip: '#track_table, .go-to-album',
} as const;
