// Pass 1 of supporter ranking (decisions §12): a fan's profile page, read signed in, carries
// Bandcamp's own "N items in common" count. It's only in the rendered header, not in #pagedata.

import { ParserError } from './errors';
import { decodeEntities, readBlobById } from './html';
import type { FetchText } from './release';
import { fanProfileRequest } from './requests';
import { rawFanProfilePagedata } from './schemas';
import type { FanProfile } from './types';
import { validate } from './validate';

const INFO_ITEMS = /<ol class="info-items"\s*>([\s\S]*?)<\/ol>/;
const GENRE_LINE = /<li class="genre-wrapper">([\s\S]*?)<\/li>/;
/** "Electronic, 8 items in common", or without the genre. */
const IN_COMMON = /^(?:.+?,\s*)?(\d{1,3}(?:,\d{3})+|\d+) items? in common$/;

function text(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reads the count from the header's genre line. Bandcamp leaves the count out when it's 0, so
 * a line that is only a genre means 0. Anything else with a number in it is text we don't
 * know (changed or localized), and must not be read as 0.
 */
function inCommonFromHeader(html: string): number {
  const items = html.match(INFO_ITEMS);
  if (!items?.[1]) throw new ParserError('fan page', 'no info-items in the header');
  const line = items[1].match(GENRE_LINE);
  if (!line?.[1]) return 0;
  const value = text(line[1]);
  const count = value.match(IN_COMMON)?.[1];
  if (count !== undefined) return Number(count.replace(/,/g, ''));
  if (/\d/.test(value) || /common/i.test(value)) {
    throw new ParserError('fan page', `unrecognised in-common line "${value}"`);
  }
  return 0;
}

/** Parses a fan profile page (bandcamp.com/<username>) for pass 1. */
export function parseFanProfile(html: string): FanProfile {
  const json = readBlobById(html, 'pagedata');
  if (json === null) throw new ParserError('fan page', 'no #pagedata blob');
  const data = validate(rawFanProfilePagedata, json, '#pagedata');
  const { fan_data: fan } = data;
  const signedIn = data.identities.fan !== null;
  const compared = signedIn && fan.is_own_page !== true;
  return {
    fanId: fan.fan_id,
    username: fan.username,
    itemCount: data.collection_data.item_count,
    inCommon: compared ? inCommonFromHeader(html) : null,
    favouriteGenre: fan.fav_genre || null,
    location: fan.location || null,
    signedIn,
  };
}

export async function fetchFanProfile(fetchText: FetchText, username: string): Promise<FanProfile> {
  return parseFanProfile(await fetchText(fanProfileRequest(username)));
}
