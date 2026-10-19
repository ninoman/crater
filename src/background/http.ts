import type { BandcampRequest } from '../bandcamp';

export class HttpError extends Error {
  override name = 'HttpError';
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

export async function fetchJson({ url, init }: BandcampRequest): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok) throw new HttpError(response.status, url);
  return response.json();
}
