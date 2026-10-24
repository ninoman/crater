import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem, ItemKey } from '../../bandcamp';
import { DigheadDb } from '../schema';
import { heardKeys, markHeard, unmarkHeard } from './heard';
import { hiddenSets, hide, hideTarget, listHides, unhide } from './hidden';
import { upsertCollectionItems } from './items';
import { multiArtistSellers } from './sellers';

function item(
  itemKey: ItemKey,
  { bandId = 1, artist = 'Artist', albumKey = null as ItemKey | null, compilation = false } = {},
): CollectionItem {
  return {
    itemKey,
    albumKey,
    title: `Title ${itemKey}`,
    artist,
    bandId,
    url: `https://seller${bandId}.bandcamp.com/album/${itemKey}`,
    artId: null,
    purchaseKind: albumKey ? 'track' : 'album',
    label: null,
    labelId: null,
    otherOwners: null,
    addedAt: null,
    compilation,
  };
}

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('hides', () => {
  it('keeps releases, artists and labels apart, even under the same id', async () => {
    await hide(db, { kind: 'release', matchKey: 'a1' }, 10);
    await hide(db, { kind: 'band', bandId: 5, name: 'Artist' }, 20);
    await hide(db, { kind: 'label', labelId: 5, name: 'Label' }, 30);
    await hide(db, { kind: 'band', bandId: 5, name: 'Renamed' }, 40);

    expect(await hiddenSets(db)).toEqual({
      releases: new Set(['a1']),
      bands: new Set([5]),
      labels: new Set([5]),
    });
    // Newest first, and hiding again keeps the first time and name.
    expect((await listHides(db)).map(hideTarget)).toEqual([
      { kind: 'label', labelId: 5, name: 'Label' },
      { kind: 'band', bandId: 5, name: 'Artist' },
      { kind: 'release', matchKey: 'a1' },
    ]);
  });

  it('unhides one target and leaves the rest', async () => {
    await hide(db, { kind: 'band', bandId: 5, name: 'Artist' }, 20);
    await hide(db, { kind: 'label', labelId: 5, name: 'Label' }, 30);

    await unhide(db, { kind: 'band', bandId: 5, name: 'Artist' });

    expect(await hiddenSets(db)).toEqual({
      releases: new Set(),
      bands: new Set(),
      labels: new Set([5]),
    });
  });

  it('leaves the heard mark alone when unhiding, so it comes back as it was', async () => {
    await markHeard(db, 'a1', 'preview', 5);
    await hide(db, { kind: 'release', matchKey: 'a1' }, 10);
    await unhide(db, { kind: 'release', matchKey: 'a1' });

    expect(await db.heard.get('a1')).toEqual({ matchKey: 'a1', heardAt: 5, source: 'preview' });
  });
});

describe('heard', () => {
  it('marks the album when a track of it is heard, and keeps the first mark', async () => {
    await upsertCollectionItems(db, [item('t11', { albumKey: 'a10' })]);

    await markHeard(db, 't11', 'bandcamp', 5);
    await markHeard(db, 'a10', 'manual', 9);

    expect(await heardKeys(db)).toEqual(new Set(['a10']));
    expect(await db.heard.get('a10')).toEqual({ matchKey: 'a10', heardAt: 5, source: 'bandcamp' });
  });

  it('marks an unknown key as it is, and unmarks', async () => {
    await markHeard(db, 'a3', 'manual', 1);
    expect(await heardKeys(db)).toEqual(new Set(['a3']));

    await unmarkHeard(db, 'a3');
    expect(await heardKeys(db)).toEqual(new Set());
  });
});

describe('multiArtistSellers', () => {
  it('finds accounts selling other artists, not counting compilations', async () => {
    await upsertCollectionItems(db, [
      item('a1', { bandId: 1, artist: 'Solo' }),
      item('a2', { bandId: 1, artist: 'Various Artists', compilation: true }),
      item('a3', { bandId: 2, artist: 'One' }),
      item('a4', { bandId: 2, artist: 'Two' }),
    ]);

    const sellers = await multiArtistSellers(db, [
      { bandId: 1, artist: 'Solo' },
      { bandId: 2, artist: 'One' },
      { bandId: 3, artist: 'Unknown' },
    ]);

    expect(sellers).toEqual(new Set([2]));
  });
});
