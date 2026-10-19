import { purchasedAtFromToken } from './keys';
import { rawSupportersResponse, type RawSupporter } from './schemas';
import type { Supporter, SupportersPage } from './types';
import { assertNotApiError, validate } from './validate';

export function toSupporter(raw: RawSupporter, isReviewer: boolean): Supporter {
  return {
    fanId: raw.fan_id,
    username: raw.username,
    name: raw.name || raw.username,
    imageId: raw.image_id ?? null,
    token: raw.token,
    purchasedAt: purchasedAtFromToken(raw.token),
    isReviewer,
  };
}

/** Parses a tralbumcollectors/2/thumbs or /reviews response. */
export function parseSupportersPage(json: unknown, kind: 'thumbs' | 'reviews'): SupportersPage {
  const source = `tralbumcollectors/${kind}`;
  const data = assertNotApiError(validate(rawSupportersResponse, json, source), source);
  return {
    supporters: data.results.map((raw) => toSupporter(raw, kind === 'reviews')),
    moreAvailable: data.more_available,
  };
}
