import { isCompilation } from './compilation';
import {
  cleanLocation,
  genreOfDiscoverUrl,
  nameYourPriceOf,
  physicalFromPackages,
  yearOf,
} from './facts';
import { ParserError } from './errors';
import { readBlobById, readDataAttribute, readLdJson } from './html';
import { itemKey } from './keys';
import { releasePageRequest, type BandcampRequest } from './requests';
import { rawCollectorsBlob, rawLdJson, rawTralbum } from './schemas';
import { toSupporter } from './supporters';
import type { ReleasePage } from './types';
import { validate } from './validate';
import type { z } from 'zod';

type LdJson = z.infer<typeof rawLdJson>;

function readLd(html: string): LdJson {
  const ld = readLdJson(html);
  return ld === null ? {} : validate(rawLdJson, ld, 'ld+json');
}

function readTags({ keywords }: LdJson): string[] {
  const list = typeof keywords === 'string' ? keywords.split(',') : (keywords ?? []);
  return [...new Set(list.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

/** Parses an album or track page. */
export function parseReleasePage(html: string): ReleasePage {
  const tralbumJson = readDataAttribute(html, 'tralbum');
  if (tralbumJson === null) throw new ParserError('release page', 'no data-tralbum attribute');
  const tralbum = validate(rawTralbum, tralbumJson, 'data-tralbum');
  const type = tralbum.item_type === 'album' ? 'a' : 't';
  const albumId = type === 't' ? tralbum.current.album_id : null;

  // A release with no supporters yet has no collectors blob.
  const collectorsJson = readBlobById(html, 'collectors-data');
  const collectors =
    collectorsJson === null
      ? null
      : validate(rawCollectorsBlob, collectorsJson, '#collectors-data');

  const ld = readLd(html);
  return {
    item: {
      itemKey: itemKey(type, tralbum.id),
      albumKey: albumId == null ? null : itemKey('a', albumId),
      title: tralbum.current.title,
      artist: tralbum.artist,
      bandId: tralbum.current.band_id,
      url: tralbum.url,
      artId: tralbum.art_id ?? null,
      tags: readTags(ld),
      compilation: isCompilation({
        artist: tralbum.artist,
        title: tralbum.current.title,
        trackArtists: (tralbum.trackinfo ?? []).map((track) => track.artist ?? null),
      }),
      facts: {
        year: yearOf(tralbum.current.release_date ?? ld.datePublished),
        nameYourPrice: nameYourPriceOf(tralbum.current.is_set_price ?? false),
        physical: physicalFromPackages(tralbum.packages ?? []),
      },
      band: {
        genre: genreOfDiscoverUrl(ld.publisher?.genre),
        location: cleanLocation(ld.publisher?.foundingLocation?.name),
      },
    },
    supporters: collectors
      ? [
          ...collectors.reviews.map((raw) => toSupporter(raw, true)),
          ...collectors.thumbs.map((raw) => toSupporter(raw, false)),
        ]
      : [],
    moreThumbsAvailable: collectors?.more_thumbs_available ?? false,
    moreReviewsAvailable: collectors?.more_reviews_available ?? false,
  };
}

/** Performs a request and returns the body as text. The service worker supplies this. */
export type FetchText = (request: BandcampRequest) => Promise<string>;

export async function fetchReleasePage(fetchText: FetchText, url: string): Promise<ReleasePage> {
  return parseReleasePage(await fetchText(releasePageRequest(url)));
}
