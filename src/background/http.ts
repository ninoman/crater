import { isBandcampUrl, type BandcampRequest } from '../bandcamp';

/** A hung request would hold the scan loop, and its lock, forever. */
const REQUEST_TIMEOUT_MS = 30_000;

export class HttpError extends Error {
  override name = 'HttpError';
  constructor(
    readonly status: number,
    url: string,
    /** Raw Retry-After header, if the server sent one. */
    readonly retryAfter: string | null = null,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

/** The request never got an answer: offline, DNS, timeout. */
export class NetworkError extends Error {
  override name = 'NetworkError';
  constructor(url: string, cause: unknown) {
    super(`No response from ${url}: ${String(cause)}`, { cause });
  }
}

/**
 * A custom domain (e.g. music.artist.com) 303s to the band's subdomain, and without host
 * permission for it the redirect fails CORS. It looks like being offline but never recovers.
 */
export class BlockedHostError extends Error {
  override name = 'BlockedHostError';
  constructor(url: string, cause: unknown) {
    super(`Can't reach ${url} (not a bandcamp.com host): ${String(cause)}`, { cause });
  }
}

async function send({ url, init }: BandcampRequest): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    if (!isBandcampUrl(url)) throw new BlockedHostError(url, error);
    throw new NetworkError(url, error);
  }
  if (!response.ok) throw new HttpError(response.status, url, response.headers.get('Retry-After'));
  return response;
}

export async function fetchJson(request: BandcampRequest): Promise<unknown> {
  return (await send(request)).json();
}

export async function fetchText(request: BandcampRequest): Promise<string> {
  return (await send(request)).text();
}
