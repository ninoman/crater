import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureJson } from '../../tests/fixtures';
import { parseApiRelease } from '../bandcamp';
import { CraterDb, upsertReleasePageItem } from '../db';
import { BlockedHostError } from './http';
import { getReleasePreview } from './preview';

const URL_ON_DOMAIN = 'https://craigieknowes.com/album/sidewinder-ep';
const response = () => fixtureJson('tralbum_details-custom-domain.json');

let db: CraterDb;

beforeEach(async () => {
  db = new CraterDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('getReleasePreview', () => {
  it('reads a stored custom-domain release from the API, never the domain', async () => {
    await upsertReleasePageItem(db, parseApiRelease(response()).item);
    const fetchText = vi.fn();

    const preview = await getReleasePreview(
      db,
      { fetchJson: async () => response(), fetchText },
      URL_ON_DOMAIN,
    );

    expect(preview.tracks).toHaveLength(4);
    expect(fetchText).not.toHaveBeenCalled();
  });

  it('gives up without a request on a custom domain it knows nothing of', async () => {
    const fetchJson = vi.fn();
    const fetchText = vi.fn();

    await expect(getReleasePreview(db, { fetchJson, fetchText }, URL_ON_DOMAIN)).rejects.toThrow(
      BlockedHostError,
    );
    expect(fetchJson).not.toHaveBeenCalled();
    expect(fetchText).not.toHaveBeenCalled();
  });
});
