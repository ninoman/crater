import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DiscographyRelease } from '../../bandcamp';
import {
  DigheadDb,
  hide,
  markHeard,
  markSynced,
  saveDiscography,
  saveReleaseDetails,
  saveViewer,
  setFollowMute,
  type FollowingRecord,
  type MeRecord,
} from '../../db';
import { computeFollowsDigest } from './digest';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 24);
const ME = 100;

function following(id: number, name: string): FollowingRecord {
  return {
    kind: 'band',
    id,
    name,
    url: `https://b${id}.bandcamp.com`,
    imageId: null,
    location: null,
    followedAt: 0,
    tagIds: [id],
    unfollowed: false,
  };
}

function release(id: number, daysAgo: number): DiscographyRelease {
  return {
    itemKey: `a${id}`,
    sellerId: 1,
    title: `Album ${id}`,
    artist: 'Artist',
    artId: id,
    releasedAt: NOW - daysAgo * DAY,
  };
}

async function readBand(bandId: number, releases: DiscographyRelease[], at: number) {
  await saveDiscography(db, { bandId, name: '', releases }, at);
  for (const { itemKey } of releases) {
    await saveReleaseDetails(db, bandId, {
      itemKey,
      albumKey: null,
      url: `https://b${bandId}.bandcamp.com/album/${itemKey}`,
      releasedAt: null,
      preorder: false,
    });
  }
}

let db: DigheadDb;
let me: MeRecord;
beforeEach(async () => {
  db = new DigheadDb(`digest-${crypto.randomUUID()}`);
  await db.open();
  me = await saveViewer(db, { fanId: ME, username: 'me' });
  await markSynced(db, NOW);
  me = { ...me, syncedAt: NOW };
});
afterEach(async () => {
  await db.delete();
});

describe('computeFollowsDigest', () => {
  it('says why it is empty before you are known', async () => {
    const result = await computeFollowsDigest(db, undefined, 30, null, NOW, false);
    expect(result).toMatchObject({ basis: 'no-viewer', rows: [] });
  });

  it('lists news of followed accounts, marks what is new and leaves out owned and hidden', async () => {
    await db.following.bulkPut([following(1, 'Artist'), following(2, 'Label')]);
    await readBand(1, [release(10, 30), release(11, 2)], NOW - 20 * DAY);
    await readBand(2, [release(20, 3), release(21, 1)], NOW - 20 * DAY);
    await readBand(2, [release(22, 0), release(20, 3), release(21, 1)], NOW);
    await db.ownership.put({ fanId: ME, itemKey: 'a21', matchKey: 'a21', addedAt: null });
    await hide(db, { kind: 'release', matchKey: 'a20' }, NOW);
    await setFollowMute(db, 1, true, NOW);

    const result = await computeFollowsDigest(db, me, 30, NOW - DAY, NOW, false);
    expect(result.rows.map((row) => [row.itemKey, row.isNew, row.muted])).toEqual([
      ['a22', true, false],
      ['a11', false, true],
      ['a10', false, true],
    ]);
    expect(result.rows[0]).toMatchObject({
      url: 'https://b2.bandcamp.com/album/a22',
      coverUrl: 'https://f4.bcbits.com/img/a22_7.jpg',
      bandIds: [2],
    });
    expect(result.accounts.map((account) => [account.name, account.muted])).toEqual([
      ['Artist', true],
      ['Label', false],
    ]);
    expect(result).toMatchObject({ basis: 'ready', readAccounts: 2, checking: 0 });
  });

  it('counts top crate mates who own an account’s music', async () => {
    await db.following.put(following(1, 'Artist'));
    await readBand(1, [release(10, 2), release(11, 300)], NOW - DAY);
    await db.crateMates.bulkPut(
      [7, 8, 9].map((fanId, i) => ({
        fanId,
        overlap: 1,
        jaccard: 0,
        score: 10 - i,
        labelCluster: false,
        lately: null,
        yearAgo: null,
        latelyOverlap: 0,
        computedAt: NOW,
      })),
    );
    const lists = { trackIds: new Float64Array(), partialIds: new Float64Array() };
    await db.fanMatches.bulkPut([
      { fanId: 7, matchIds: new Float64Array([11]), matchTimes: new Float64Array([0]), ...lists },
      { fanId: 8, matchIds: new Float64Array([11, 50]), matchTimes: new Float64Array(2), ...lists },
      { fanId: 9, matchIds: new Float64Array([11]), matchTimes: new Float64Array([0]), ...lists },
    ]);
    const [row] = (await computeFollowsDigest(db, me, 2, null, NOW, false)).rows;
    expect(row).toMatchObject({ itemKey: 'a10', crateMates: 2, isNew: false });
  });

  it('leaves out hidden artists and labels, and heard releases when asked', async () => {
    // Artist 1 sells everything; label 2 lists a22 of theirs.
    await db.following.bulkPut([following(1, 'Artist'), following(2, 'Label')]);
    await readBand(1, [release(10, 3), release(11, 2)], NOW - DAY);
    await readBand(2, [release(22, 1)], NOW - DAY);
    const keys = async (hideHeard: boolean) =>
      (await computeFollowsDigest(db, me, 30, null, NOW, hideHeard)).rows.map((row) => row.itemKey);

    const [labelled] = (await computeFollowsDigest(db, me, 30, null, NOW, false)).rows;
    expect(labelled).toMatchObject({
      itemKey: 'a22',
      heard: false,
      hide: {
        band: { kind: 'band', bandId: 1, name: 'Artist' },
        label: { kind: 'label', labelId: 2, name: 'Label' },
      },
    });

    await markHeard(db, 'a11', 'manual', NOW);
    expect(await keys(false)).toEqual(['a22', 'a11', 'a10']);
    expect(await keys(true)).toEqual(['a22', 'a10']);

    await hide(db, { kind: 'label', labelId: 2, name: 'Label' }, NOW);
    expect(await keys(false)).toEqual(['a11', 'a10']);
    await hide(db, { kind: 'band', bandId: 1, name: 'Artist' }, NOW);
    expect(await keys(false)).toEqual([]);
  });
});
