import { GENRES } from '../../bandcamp';

/** The genres a list can be filtered by, named as Bandcamp names them. */
export const FILTER_GENRES = GENRES.map(({ id, label }) => ({ id, label }));
