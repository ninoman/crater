// Where a band's home page keeps its name (see band-page.html). The same block sits in the
// sidebar of release pages, so tell the two apart with `hasTralbumItem`.

export const BAND_PAGE_DOM = {
  /** Holds the band's name and location; our tags go at its end. */
  name: '#band-name-location',
  /** The name itself, inside `name`. */
  title: '.title',
  /** Where the band is, inside `name`; not every band says. */
  location: '.location',
} as const;
