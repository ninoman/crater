// How `items` and `ownership` rows are stored, and back (decisions §19): a release URL becomes its
// band's host plus a slug, and default values are left out. Pure; repos do the reads and writes.

import type { BandFacts, ReleaseFacts } from '../bandcamp';
import type {
  BandRecord,
  ItemFields,
  ItemRecord,
  OwnershipRecord,
  StoredItem,
  StoredOwnership,
} from './schema';

const RELEASE_URL = /^https:\/\/([^/?#]+)\/(album|track)\/([^/?#]+)$/;
const BANDCAMP = '.bandcamp.com';

/** A subdomain without `.bandcamp.com`. A custom domain stays whole: it's the one with dots. */
export function shortHost(host: string): string {
  if (!host.endsWith(BANDCAMP)) return host;
  const sub = host.slice(0, -BANDCAMP.length);
  return sub === '' || sub.includes('.') ? host : sub;
}

function fullHost(host: string): string {
  return host.includes('.') ? host : `${host}${BANDCAMP}`;
}

/** The host of a release URL as `bands.hosts` holds it, or null for any other URL. */
export function releaseUrlHost(url: string): string | null {
  const host = RELEASE_URL.exec(url)?.[1];
  return host === undefined ? null : shortHost(host);
}

const kindOf = (item: Pick<StoredItem, 'itemKey'>) =>
  item.itemKey.startsWith('a') ? 'album' : 'track';

/**
 * The row to store for an item, given its band's hosts so far. `band` is the band's record when
 * this item added a host to it (or created it), else undefined.
 */
export function storeItem(
  item: ItemRecord,
  known: BandRecord | undefined,
): { stored: StoredItem; band: BandRecord | undefined } {
  const stored: StoredItem = {
    itemKey: item.itemKey,
    title: item.title,
    artist: item.artist,
    bandId: item.bandId,
  };
  let band: BandRecord | undefined;
  const match = RELEASE_URL.exec(item.url);
  const [, rawHost, kind, slug] = match ?? [];
  if (rawHost !== undefined && slug !== undefined) {
    const host = shortHost(rawHost);
    if (!known?.hosts.includes(host)) {
      band = { bandId: item.bandId, hosts: [...(known?.hosts ?? []), host] };
    }
    const hosts = band?.hosts ?? known?.hosts ?? [];
    if (kind === kindOf(item)) {
      stored.slug = slug;
      if (host !== hosts[0]) stored.host = host;
    } else {
      stored.url = item.url;
    }
  } else {
    stored.url = item.url;
  }
  if (item.albumKey !== null) stored.albumKey = item.albumKey;
  if (item.label !== null) stored.label = item.label;
  if (item.labelId !== null) stored.labelId = item.labelId;
  if (item.artId !== null) stored.artId = item.artId;
  if (item.supporterCount !== null) stored.supporterCount = item.supporterCount;
  if (item.tags.length > 0) stored.tags = item.tags;
  if (item.compilation) stored.compilation = true;
  if (item.facts?.year != null) stored.year = item.facts.year;
  if (item.facts?.nameYourPrice != null) stored.nyp = item.facts.nameYourPrice;
  if (item.facts?.physical != null) stored.physical = item.facts.physical;
  return { stored, band };
}

/**
 * The band with a genre or location it didn't have, or its facts changed; undefined when
 * `facts` adds nothing. A null fact never erases one we know.
 */
export function withBandFacts(band: BandRecord, facts: BandFacts): BandRecord | undefined {
  const genre = facts.genre ?? band.genre;
  const location = facts.location ?? band.location;
  if (genre === band.genre && location === band.location) return undefined;
  return {
    ...band,
    ...(genre !== undefined && { genre }),
    ...(location !== undefined && { location }),
  };
}

/** A stored row's fields with defaults filled in, in either the v12 shape or the one before. */
export function readItemFields(row: StoredItem): ItemFields {
  const facts = readFacts(row);
  return {
    itemKey: row.itemKey,
    albumKey: row.albumKey ?? null,
    title: row.title,
    artist: row.artist,
    bandId: row.bandId,
    label: row.label ?? null,
    labelId: row.labelId ?? null,
    artId: row.artId ?? null,
    tags: row.tags ?? [],
    supporterCount: row.supporterCount ?? null,
    compilation: row.compilation ?? false,
    ...(facts && { facts }),
  };
}

/** The row's facts, or undefined when it has none, as rows from before v17 don't. */
export function readFacts(row: StoredItem): ReleaseFacts | undefined {
  if (row.year === undefined && row.nyp === undefined && row.physical === undefined) {
    return undefined;
  }
  return {
    year: row.year ?? null,
    nameYourPrice: row.nyp ?? null,
    physical: row.physical ?? null,
  };
}

/** An item record from its stored row and its band's hosts. */
export function readItem(row: StoredItem, band: BandRecord | undefined): ItemRecord {
  // Bands are written with their items, so a slug always has a host to go with it.
  const host = row.host ?? band?.hosts[0] ?? 'bandcamp.com';
  const url = row.url ?? `https://${fullHost(host)}/${kindOf(row)}/${row.slug}`;
  return { ...readItemFields(row), url };
}

export function storeOwnership(row: OwnershipRecord): StoredOwnership {
  if (row.source === 'wishlist') return row;
  const { source: _, ...rest } = row;
  return rest;
}

/** Rows stored before v12, or loaded by the eval without migrating, still say 'collection'. */
export function readOwnership(row: StoredOwnership): OwnershipRecord {
  return { ...row, source: row.source ?? 'collection' };
}
