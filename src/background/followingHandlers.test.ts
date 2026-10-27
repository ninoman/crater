import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CraterDb, putFollowing } from '../db';
import { followingHandlers, type FollowingHandlers } from './followingHandlers';

const sender = {} as chrome.runtime.MessageSender;

let db: CraterDb;
let h: FollowingHandlers;

beforeEach(async () => {
  db = new CraterDb(`test-${crypto.randomUUID()}`);
  await db.open();
  h = followingHandlers(db);
  await putFollowing(db, [
    { kind: 'band', id: 1, name: 'A', url: 'a', imageId: null, location: null, followedAt: 1 },
    { kind: 'band', id: 2, name: 'B', url: 'b', imageId: null, location: null, followedAt: 2 },
    { kind: 'fan', id: 1, name: 'F', url: 'f', imageId: null, location: null, followedAt: 3 },
  ]);
});

afterEach(async () => {
  await db.delete();
});

async function newTag(name: string): Promise<number> {
  const result = await h.createTag({ name }, sender);
  if (!result.ok) throw new Error(result.reason);
  return result.tag.id;
}

describe('tag handlers', () => {
  it('creates, renames, lists and deletes tags', async () => {
    const id = await newTag('Ambient');
    expect(await h.createTag({ name: ' ambient' }, sender)).toMatchObject({
      ok: true,
      tag: { id },
    });
    expect(await h.renameTag({ id, name: 'Drone' }, sender)).toMatchObject({ ok: true });
    expect((await h.listTags({}, sender)).map((tag) => tag.name)).toEqual(['Drone']);
    expect(await h.deleteTag({ id }, sender)).toBeNull();
    expect(await h.listTags({}, sender)).toEqual([]);
  });

  it('answers a bad name with a reason, not an error', async () => {
    expect(await h.createTag({ name: '  ' }, sender)).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('assignTag and listFollowing', () => {
  it('adds a tag to many keys and filters by kind and tags', async () => {
    const tagId = await newTag('x');
    const changed = await h.assignTag(
      {
        tagId,
        keys: [
          ['band', 1],
          ['fan', 1],
          ['band', 99],
        ],
        action: 'add',
      },
      sender,
    );
    expect(changed).toBe(2);

    const ids = async (kind: 'band' | 'fan', tagIds: number[], mode: 'all' | 'any') =>
      (await h.listFollowing({ kind, tagIds, mode }, sender)).map((row) => row.id);
    expect(await ids('band', [], 'all')).toEqual([2, 1]);
    expect(await ids('band', [tagId], 'all')).toEqual([1]);
    expect(await ids('fan', [tagId], 'any')).toEqual([1]);

    await h.assignTag({ tagId, keys: [['band', 1]], action: 'remove' }, sender);
    expect(await ids('band', [tagId], 'all')).toEqual([]);
  });

  it('filters by all or any of several tags', async () => {
    const a = await newTag('a');
    const b = await newTag('b');
    await h.assignTag(
      {
        tagId: a,
        keys: [
          ['band', 1],
          ['band', 2],
        ],
        action: 'add',
      },
      sender,
    );
    await h.assignTag({ tagId: b, keys: [['band', 1]], action: 'add' }, sender);
    const ids = async (mode: 'all' | 'any') =>
      (await h.listFollowing({ kind: 'band', tagIds: [a, b], mode }, sender))
        .map((row) => row.id)
        .sort();
    expect(await ids('all')).toEqual([1]);
    expect(await ids('any')).toEqual([1, 2]);
  });
});

describe('getFollowTags and setUnfollowed', () => {
  it('is null when you do not follow the account', async () => {
    expect(await h.getFollowTags({ kind: 'band', id: 99 }, sender)).toBeNull();
  });

  it('gives the tag ids, and null again while unfollowed', async () => {
    const tagId = await newTag('x');
    await h.assignTag({ tagId, keys: [['band', 1]], action: 'add' }, sender);
    expect(await h.getFollowTags({ kind: 'band', id: 1 }, sender)).toEqual([tagId]);

    await h.setUnfollowed({ key: ['band', 1], unfollowed: true }, sender);
    expect(await h.getFollowTags({ kind: 'band', id: 1 }, sender)).toBeNull();

    await h.setUnfollowed({ key: ['band', 1], unfollowed: false }, sender);
    expect(await h.getFollowTags({ kind: 'band', id: 1 }, sender)).toEqual([tagId]);
  });

  it('makes an account followed on its page taggable at once', async () => {
    const account = {
      kind: 'fan' as const,
      id: 7,
      name: 'G',
      url: 'g',
      imageId: null,
      location: null,
      followedAt: 4,
    };
    await h.markFollowed({ account }, sender);
    expect(await h.getFollowTags({ kind: 'fan', id: 7 }, sender)).toEqual([]);
  });
});

describe('exportTags and importTags', () => {
  it('round-trips through a fresh tag set', async () => {
    const tagId = await newTag('Keep');
    await h.assignTag({ tagId, keys: [['band', 2]], action: 'add' }, sender);
    const backup = await h.exportTags({}, sender);
    expect(backup.tags).toEqual([{ name: 'Keep', assignments: [['band', 2]], items: [] }]);

    await h.deleteTag({ id: tagId }, sender);
    const summary = await h.importTags({ backup }, sender);
    expect(summary).toEqual({ tagsCreated: 1, assigned: 1, skipped: 0 });
  });
});
