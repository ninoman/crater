import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureJson, fixtureText } from '../../tests/fixtures';
import { type ItemKey, parseApiRelease, parseReleasePreview, type Supporter } from '../bandcamp';
import { addSupporterOwnership, CraterDb, upsertReleasePageItem } from '../db';
import { BlockedHostError } from './http';
import { getReleasePreview } from './preview';

const URL_ON_DOMAIN = 'https://craigieknowes.com/album/sidewinder-ep';
const response = () => fixtureJson('tralbum_details-custom-domain.json');
const COMP_URL = 'https://label.bandcamp.com/album/comp';
const compPage = () => fixtureText('album-page-compilation.html');

function supporter(fanId: number): Supporter {
  return {
    fanId,
    username: `fan${fanId}`,
    name: `Fan ${fanId}`,
    imageId: null,
    token: `1:${fanId}`,
    purchasedAt: null,
    isReviewer: false,
  };
}

async function boughtTrack(index: number, fanIds: number[]) {
  const { tracks, matchKey } = parseReleasePreview(compPage());
  const itemKey = tracks[index]?.itemKey as ItemKey;
  await addSupporterOwnership(db, { itemKey, albumKey: matchKey }, fanIds.map(supporter));
}

function compPreview() {
  return getReleasePreview(db, { fetchJson: vi.fn(), fetchText: async () => compPage() }, COMP_URL);
}

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

  it('starts at the track the most fans bought on its own', async () => {
    await boughtTrack(1, [1]);
    await boughtTrack(3, [2, 3]);

    expect((await compPreview()).startIndex).toBe(3);
  });

  it('starts at the featured track when nobody bought one on its own', async () => {
    expect((await compPreview()).startIndex).toBe(parseReleasePreview(compPage()).startIndex);
  });
});
