/** Bandcamp returned something we can't read. Usually means Bandcamp changed its markup or JSON. */
export class ParserError extends Error {
  override name = 'ParserError';
  constructor(
    readonly source: string,
    detail: string,
  ) {
    super(`${source}: ${detail}`);
  }
}

/**
 * The API answered HTTP 200 with {"error": true}. Bandcamp uses this for malformed tokens
 * and for hidden wishlists alike, so callers decide what it means in context.
 */
export class BandcampApiError extends Error {
  override name = 'BandcampApiError';
  constructor(readonly source: string) {
    super(`${source}: API returned an error`);
  }
}
