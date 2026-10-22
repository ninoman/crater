// Tells compilations (label samplers, Various Artists comps) from albums, from what release data
// already carries (decisions §15). High precision: a wrongly flagged album would lose real overlap.

/** Artist lines that stand for "many artists", after `normalize`. Exact matches only. */
const VARIOUS_ARTISTS = new Set([
  'various artists',
  'various artist',
  'various',
  'va',
  'v.a',
  'v/a',
  'v-a',
  'varios artistas',
  'vários artistas',
  'artistes variés',
  'artisti vari',
  'verschiedene künstler',
  'diverse artiesten',
  'vv.aa',
]);

/**
 * "VA - Title", "V/A: Title", "Various Artists – Title", optionally after "[CAT001] ". A dash
 * needs spaces around it, so "Va-Va-Voom" stays an album.
 */
const VA_TITLE_PREFIX =
  /^(?:\[[^\]]*\]\s*)?(?:v\.?\s?a\.?|v\/a|various\s+artists?)(?:\s+[-–—|]\s+|\s*:\s*)\S/i;

/** Remix albums list remixers per track but are bought by the original artist's fans. */
const REMIX_TITLE = /\b(?:remix(?:es|ed)?|rework(?:s|ed)?|edits|versions|reimagined)\b/i;

/** Distinct track artists other than the album artist needed to call a release a compilation... */
export const MIN_TRACK_ARTISTS = 3;
/** ...on at least this share of its tracks. */
export const MIN_FOREIGN_TRACK_SHARE = 0.5;

export interface CompilationEvidence {
  artist: string;
  title: string;
  /**
   * Each track's own artist line, null where it has none (`data-tralbum.trackinfo[].artist`).
   * Only release pages carry it.
   */
  trackArtists?: readonly (string | null)[];
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.+$/, '');
}

/** Whether the artist line is a various-artists placeholder. */
export function isVariousArtists(artist: string): boolean {
  return VARIOUS_ARTISTS.has(normalize(artist));
}

/**
 * Whether enough tracks name artists of their own. A track artist that contains the album
 * artist, or is contained in it, doesn't count: "Artist feat. Guest", or one side of a split.
 */
export function hasCompilationTracks(
  albumArtist: string,
  title: string,
  trackArtists: readonly (string | null)[],
): boolean {
  if (trackArtists.length === 0 || REMIX_TITLE.test(title)) return false;
  const album = normalize(albumArtist);
  const foreign = trackArtists
    .map((artist) => (artist === null ? '' : normalize(artist)))
    .filter((artist) => artist !== '' && !artist.includes(album) && !album.includes(artist));
  return (
    new Set(foreign).size >= MIN_TRACK_ARTISTS &&
    foreign.length >= trackArtists.length * MIN_FOREIGN_TRACK_SHARE
  );
}

/** Whether a release is a compilation, from its artist, title and (when known) track artists. */
export function isCompilation(release: CompilationEvidence): boolean {
  return (
    isVariousArtists(release.artist) ||
    VA_TITLE_PREFIX.test(release.title) ||
    hasCompilationTracks(release.artist, release.title, release.trackArtists ?? [])
  );
}
