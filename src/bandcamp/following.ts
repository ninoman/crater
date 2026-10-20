import { parseBandcampDate } from './keys';
import { followingRequest } from './requests';
import { rawFollowingResponse, type RawFollowee } from './schemas';
import type { FetchJson } from './collection';
import type { FollowingKind, FollowingPage, FollowingRow } from './types';
import { assertNotApiError, validate } from './validate';

/** Bandcamp's own cards link the subdomain even when the band has a custom domain (fixture). */
function bandUrl(raw: RawFollowee): string | null {
  const { custom_domain: domain, subdomain } = raw.url_hints ?? {};
  if (subdomain) return `https://${subdomain}.bandcamp.com`;
  return domain ? `https://${domain}` : null;
}

/** Maps one raw row. Returns null when the id or link it needs is missing. */
export function toFollowingRow(raw: RawFollowee, kind: FollowingKind): FollowingRow | null {
  const id = kind === 'band' ? raw.band_id : raw.fan_id;
  const url = kind === 'band' ? bandUrl(raw) : raw.trackpipe_url;
  if (id == null || !url) return null;
  return {
    kind,
    id,
    name: raw.name,
    url,
    imageId: raw.image_id ?? null,
    location: raw.location || null,
    followedAt: parseBandcampDate(raw.date_followed),
  };
}

export function toFollowingRows(raws: RawFollowee[], kind: FollowingKind): FollowingRow[] {
  return raws.flatMap((raw) => toFollowingRow(raw, kind) ?? []);
}

const SOURCES: Record<FollowingKind, string> = {
  band: 'following_bands',
  fan: 'following_fans',
};

/** Parses a following_bands or following_fans response. */
export function parseFollowingPage(json: unknown, kind: FollowingKind): FollowingPage {
  const source = SOURCES[kind];
  const data = assertNotApiError(validate(rawFollowingResponse, json, source), source);
  return {
    rows: toFollowingRows(data.followeers, kind),
    moreAvailable: data.more_available,
    // Like collection pages: last_token follows the 20th row whatever `count` was.
    nextToken: data.followeers.at(-1)?.token ?? data.last_token,
  };
}

/** Fetches and parses one page of the artists and labels, or the fans, a fan follows. */
export async function fetchFollowingPage(
  fetchJson: FetchJson,
  kind: FollowingKind,
  fanId: number,
  olderThanToken: string,
  count: number,
): Promise<FollowingPage> {
  return parseFollowingPage(
    await fetchJson(followingRequest(kind, fanId, olderThanToken, count)),
    kind,
  );
}
