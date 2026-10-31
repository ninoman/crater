import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { CollectionItem, FetchJson } from '../bandcamp';
import {
  createTag,
  CraterDb,
  markHeard,
  putOwnership,
  saveViewer,
  upsertCollectionItems,
} from '../db';
import { itemListHandlers, type ItemListHandlers } from './itemListHandlers';

const sender = {} as chrome.runtime.MessageSender;
const ME = 5;

const ITEM: CollectionItem = {
  itemKey: 'a1',
  albumKey: null,
  title: 'Promises',
  artist: 'Floating Points',
  bandId: 1,
  url: 'https://floatingpoints.bandcamp.com/album/promises',
  artId: 123,
  purchaseKind: 'album',
  label: null,
  labelId: null,
  otherOwners: null,
  addedAt: 1000,
  compilation: false,
};

let db: CraterDb;
let h: ItemListHandlers;
let fetchJson: Mock<FetchJson>;

beforeEach(async () => {
  db = new CraterDb(`test-${crypto.randomUUID()}`);
  await db.open();
  fetchJson = vi.fn<FetchJson>();
  h = itemListHandlers(db, async () => 30, fetchJson);
  await upsertCollectionItems(db, [ITEM]);
  await putOwnership(db, ME, [ITEM], 'wishlist');
});

afterEach(async () => {
  await db.delete();
});

describe('item list handlers', () => {
  it('answers nothing before Crater has seen you', async () => {
    expect(await h.listItems({ source: 'wishlist' }, sender)).toEqual([]);
    expect(await h.getItemTags({ itemKey: 'a1' }, sender)).toBeNull();
  });

  it('lists your wishlist with covers and tags, and tags items', async () => {
    await saveViewer(db, { fanId: ME, username: 'me' });
    const created = await createTag(db, 'dub');
    if (!created.ok) throw new Error(created.reason);

    expect(
      await h.assignItemTag({ tagId: created.tag.id, itemKeys: ['a1'], action: 'add' }, sender),
    ).toBe(1);

    const [row] = await h.listItems({ source: 'wishlist' }, sender);
    expect(row).toMatchObject({ itemKey: 'a1', title: 'Promises', addedAt: 1000 });
    expect(row?.coverUrl).toBe('https://f4.bcbits.com/img/a123_7.jpg');
    expect(row?.tagIds).toEqual([created.tag.id]);
    expect(await h.getItemTags({ itemKey: 'a1' }, sender)).toEqual([created.tag.id]);
  });

  it('says which items you have heard', async () => {
    await saveViewer(db, { fanId: ME, username: 'me' });
    expect((await h.listItems({ source: 'wishlist' }, sender))[0]?.heard).toBe(false);
    await markHeard(db, 'a1', 'preview', 2000);
    expect((await h.listItems({ source: 'wishlist' }, sender))[0]?.heard).toBe(true);
  });

  it('records hearts and un-hearts made on a release page once it knows you', async () => {
    const release = { itemKey: 'a2' as const, albumKey: null };
    expect(await h.markWishlisted({ release }, sender)).toBe(false);

    await saveViewer(db, { fanId: ME, username: 'me' });
    expect(await h.markWishlisted({ release }, sender)).toBe(true);
    expect(await h.getItemTags({ itemKey: 'a2' }, sender)).toEqual([]);

    await h.markUnwishlisted({ itemKey: 'a2' }, sender);
    expect(await h.getItemTags({ itemKey: 'a2' }, sender)).toBeNull();
  });

  describe('hearts on a fan page card', () => {
    const card = {
      itemKey: 't5' as const,
      bandId: 7,
      title: 'Grainphase',
      artist: 'Claudio PRC',
      url: 'https://x.bandcamp.com/album/split',
      artId: 9,
    };

    it('answers false before it knows you', async () => {
      expect(await h.markCardWishlisted({ card }, sender)).toBe(false);
      expect(fetchJson).not.toHaveBeenCalled();
    });

    it('saves an unknown release, with its album from Bandcamp', async () => {
      await saveViewer(db, { fanId: ME, username: 'me' });
      fetchJson.mockResolvedValue({
        id: 5,
        type: 't',
        album_id: 6,
        bandcamp_url: 'https://x.bandcamp.com/track/grainphase',
      });

      expect(await h.markCardWishlisted({ card }, sender)).toBe(true);

      const row = (await h.listItems({ source: 'wishlist' }, sender)).find(
        (item) => item.itemKey === 't5',
      );
      expect(row).toMatchObject({
        title: 'Grainphase',
        url: 'https://x.bandcamp.com/track/grainphase',
      });
      expect((await db.ownership.get([ME, 't5']))?.matchKey).toBe('a6');
    });

    it('saves it from the card alone when Bandcamp fails', async () => {
      await saveViewer(db, { fanId: ME, username: 'me' });
      fetchJson.mockRejectedValue(new Error('offline'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(await h.markCardWishlisted({ card }, sender)).toBe(true);

      expect(await h.getItemTags({ itemKey: 't5' }, sender)).toEqual([]);
      const row = (await h.listItems({ source: 'wishlist' }, sender)).find(
        (item) => item.itemKey === 't5',
      );
      expect(row?.url).toBe(card.url);
    });

    it('asks Bandcamp nothing about a release it knows', async () => {
      await saveViewer(db, { fanId: ME, username: 'me' });
      expect(await h.markCardWishlisted({ card: { ...card, itemKey: 'a1' } }, sender)).toBe(true);
      expect(fetchJson).not.toHaveBeenCalled();
    });
  });
});
