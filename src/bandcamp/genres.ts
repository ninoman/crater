// Bandcamp's top-level genres, with the ids collection items carry as `genre_id` (decisions §22).
// Source: the `genres` list in bandcamp.com/discover's #pagedata, saved in tests/fixtures/discover-genres.json
// (2026-10-24), which a test compares this table with. Bandcamp numbers them itself and we assume the
// ids hold: band-page.html's `genre_id` 10 is the electronic floatingpoints, as here.

export interface Genre {
  id: number;
  /** The path in bandcamp.com/discover/<slug>, which release pages link the selling account's genre by. */
  slug: string;
  label: string;
}

export const GENRES: readonly Genre[] = [
  { id: 1, slug: 'acoustic', label: 'acoustic' },
  { id: 2, slug: 'alternative', label: 'alternative' },
  { id: 3, slug: 'ambient', label: 'ambient' },
  { id: 4, slug: 'blues', label: 'blues' },
  { id: 5, slug: 'classical', label: 'classical' },
  { id: 6, slug: 'comedy', label: 'comedy' },
  { id: 7, slug: 'country', label: 'country' },
  { id: 9, slug: 'devotional', label: 'devotional' },
  { id: 10, slug: 'electronic', label: 'electronic' },
  { id: 11, slug: 'experimental', label: 'experimental' },
  { id: 12, slug: 'folk', label: 'folk' },
  { id: 13, slug: 'funk', label: 'funk' },
  { id: 14, slug: 'hip-hop-rap', label: 'hip-hop/rap' },
  { id: 15, slug: 'jazz', label: 'jazz' },
  { id: 16, slug: 'kids', label: 'kids' },
  { id: 17, slug: 'latin', label: 'latin' },
  { id: 18, slug: 'metal', label: 'metal' },
  { id: 19, slug: 'pop', label: 'pop' },
  { id: 20, slug: 'punk', label: 'punk' },
  { id: 21, slug: 'r-b-soul', label: 'r&b/soul' },
  { id: 22, slug: 'reggae', label: 'reggae' },
  { id: 23, slug: 'rock', label: 'rock' },
  { id: 24, slug: 'soundtrack', label: 'soundtrack' },
  { id: 25, slug: 'spoken-word', label: 'spoken word' },
  { id: 26, slug: 'world', label: 'world' },
  { id: 27, slug: 'podcasts', label: 'podcasts' },
  { id: 28, slug: 'audiobooks', label: 'audiobooks' },
];

const BY_ID = new Map(GENRES.map((genre) => [genre.id, genre]));
const BY_SLUG = new Map(GENRES.map((genre) => [genre.slug, genre]));

/** A genre's name, or null for an id we have no name for (Bandcamp may add genres). */
export function genreLabel(id: number): string | null {
  return BY_ID.get(id)?.label ?? null;
}

/** The genre id for a discover slug, or null when it isn't a top-level genre. */
export function genreIdFromSlug(slug: string): number | null {
  return BY_SLUG.get(slug)?.id ?? null;
}
