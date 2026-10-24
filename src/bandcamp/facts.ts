// What list filters judge releases and bands by (decisions §22): the raw fields of collection rows
// and release pages, read into ReleaseFacts and BandFacts. Null always means "not stated".

import { genreIdFromSlug } from './genres';
import { parseBandcampDate } from './keys';
import type { BandFacts, ReleaseFacts } from './types';

const DISCOVER_GENRE = /^https:\/\/bandcamp\.com\/discover\/([a-z0-9-]+)\/?$/;

/** A band's location line, or null when it left it blank. */
export function cleanLocation(location: string | null | undefined): string | null {
  const trimmed = location?.trim();
  return trimmed ? trimmed : null;
}

/** The UTC year of a Bandcamp date such as "26 Mar 2021 00:00:00 GMT". */
export function yearOf(date: string | null | undefined): number | null {
  const ms = parseBandcampDate(date);
  return ms === null ? null : new Date(ms).getUTCFullYear();
}

/** `is_set_price` true is a fixed price; false lets fans pay the price or more. */
export function nameYourPriceOf(isSetPrice: boolean | null | undefined): boolean | null {
  return isSetPrice == null ? null : !isSetPrice;
}

/**
 * From a collection row: no `merch_ids` means no physical edition (known), and `merch_sold_out`
 * says whether every edition has gone.
 */
export function physicalFromMerch(
  merchIds: readonly unknown[] | null | undefined,
  soldOut: boolean | null | undefined,
): boolean {
  return (merchIds?.length ?? 0) > 0 && soldOut !== true;
}

/** From a release page's packages: any public, non-ticket edition not sold out. */
export function physicalFromPackages(
  packages: readonly {
    quantity_available?: number | null;
    is_live_ticket?: boolean | null;
    private?: boolean | null;
  }[],
): boolean {
  return packages.some(
    (pack) => !pack.is_live_ticket && !pack.private && pack.quantity_available !== 0,
  );
}

/** The genre id behind a `https://bandcamp.com/discover/<slug>` link, or null. */
export function genreOfDiscoverUrl(url: string | null | undefined): number | null {
  const slug = url === null || url === undefined ? undefined : DISCOVER_GENRE.exec(url)?.[1];
  return slug === undefined ? null : genreIdFromSlug(slug);
}

export const NO_BAND_FACTS: BandFacts = { genre: null, location: null };
export const NO_RELEASE_FACTS: ReleaseFacts = { year: null, nameYourPrice: null, physical: null };
