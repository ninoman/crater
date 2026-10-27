import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CraterDb, type FollowingKey } from '../schema';
import { parseTagBackup, type TagBackup } from '../tagBackup';
import { getFollowing, putFollowing, setUnfollowed } from './following';
import {
  assignTag,
  createTag,
  deleteTag,
  exportTags,
  importTags,
  listTags,
  renameTag,
  tagNameKey,
} from './tags';

let db: CraterDb;

beforeEach(async () => {
  db = new CraterDb(`test-${crypto.randomUUID()}`);
  await db.open();
  await putFollowing(
    db,
    [1, 2, 3].map((id) => ({
      kind: 'band' as const,
      id,
      name: `Band ${id}`,
      url: `https://band${id}.bandcamp.com`,
      imageId: null,
      location: null,
      followedAt: id,
    })),
  );
});

afterEach(async () => {
  await db.delete();
});

async function tagId(name: string): Promise<number> {
  const result = await createTag(db, name);
  if (!result.ok) throw new Error(result.reason);
  return result.tag.id;
}

async function tagIdsOf(key: FollowingKey): Promise<number[] | undefined> {
  return (await getFollowing(db, key))?.tagIds;
}

describe('createTag', () => {
  it('keys names by their trimmed, lowercased form', async () => {
    expect(tagNameKey('  Deep House ')).toBe('deep house');
    const result = await createTag(db, '  Deep House ');
    expect(result).toMatchObject({ ok: true, tag: { name: 'Deep House', nameKey: 'deep house' } });
  });

  it('returns the existing tag for the same name key', async () => {
    const id = await tagId('Ambient');

    expect(await tagId('ambient ')).toBe(id);
    expect(await listTags(db)).toHaveLength(1);
  });

  it('rejects an empty name', async () => {
    expect(await createTag(db, '   ')).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('renameTag', () => {
  it('renames, including a change of case', async () => {
    const id = await tagId('ambient');

    expect(await renameTag(db, id, 'Ambient')).toEqual({
      ok: true,
      tag: { id, name: 'Ambient', nameKey: 'ambient' },
    });
  });

  it('refuses a name another tag has, and a missing tag', async () => {
    const id = await tagId('ambient');
    await tagId('dub');

    expect(await renameTag(db, id, 'Dub')).toEqual({ ok: false, reason: 'taken' });
    expect(await renameTag(db, 999, 'new')).toEqual({ ok: false, reason: 'missing' });
  });
});

describe('deleteTag', () => {
  it('takes the tag off every following and keeps the others', async () => {
    const ambient = await tagId('ambient');
    const dub = await tagId('dub');
    await assignTag(
      db,
      ambient,
      [
        ['band', 1],
        ['band', 2],
      ],
      'add',
    );
    await assignTag(db, dub, [['band', 1]], 'add');

    await deleteTag(db, ambient);

    expect(await listTags(db)).toEqual([{ id: dub, name: 'dub', nameKey: 'dub' }]);
    expect(await tagIdsOf(['band', 1])).toEqual([dub]);
    expect(await tagIdsOf(['band', 2])).toEqual([]);
    expect(await db.following.where('tagIds').equals(ambient).count()).toBe(0);
  });
});

describe('assignTag', () => {
  it('adds one tag to many followings, once each, skipping unknown keys', async () => {
    const id = await tagId('ambient');
    await assignTag(db, id, [['band', 1]], 'add');

    const changed = await assignTag(
      db,
      id,
      [
        ['band', 1],
        ['band', 2],
        ['fan', 9],
      ],
      'add',
    );

    expect(changed).toBe(1);
    expect(await tagIdsOf(['band', 1])).toEqual([id]);
    expect(await tagIdsOf(['band', 2])).toEqual([id]);
    expect(await tagIdsOf(['band', 3])).toEqual([]);
  });

  it('removes one tag from many followings', async () => {
    const ambient = await tagId('ambient');
    const dub = await tagId('dub');
    await assignTag(
      db,
      ambient,
      [
        ['band', 1],
        ['band', 2],
      ],
      'add',
    );
    await assignTag(db, dub, [['band', 1]], 'add');

    expect(
      await assignTag(
        db,
        ambient,
        [
          ['band', 1],
          ['band', 2],
          ['band', 3],
        ],
        'remove',
      ),
    ).toBe(2);
    expect(await tagIdsOf(['band', 1])).toEqual([dub]);
    expect(await tagIdsOf(['band', 2])).toEqual([]);
  });

  it('adds nothing for a tag that does not exist', async () => {
    expect(await assignTag(db, 999, [['band', 1]], 'add')).toBe(0);
    expect(await tagIdsOf(['band', 1])).toEqual([]);
  });
});

describe('tag backup', () => {
  it('exports every tag with its assignments', async () => {
    const ambient = await tagId('Ambient');
    await tagId('dub');
    await assignTag(
      db,
      ambient,
      [
        ['band', 2],
        ['band', 1],
      ],
      'add',
    );

    expect(await exportTags(db)).toEqual({
      version: 2,
      tags: [
        {
          name: 'Ambient',
          assignments: [
            ['band', 1],
            ['band', 2],
          ],
          items: [],
        },
        { name: 'dub', assignments: [], items: [] },
      ],
    });
  });

  it('merges by name key and skips accounts you no longer follow', async () => {
    const ambient = await tagId('Ambient');
    await assignTag(db, ambient, [['band', 1]], 'add');
    await setUnfollowed(db, ['band', 3], true);
    const backup: TagBackup = {
      version: 1,
      tags: [
        {
          name: 'ambient',
          assignments: [
            ['band', 1],
            ['band', 2],
            ['fan', 9],
          ],
          items: [],
        },
        { name: 'Dub', assignments: [['band', 3]], items: [] },
      ],
    };

    const summary = await importTags(db, backup, null);

    expect(summary).toEqual({ tagsCreated: 1, assigned: 1, skipped: 2 });
    const tags = await listTags(db);
    expect(tags.map((tag) => tag.name)).toEqual(['Ambient', 'Dub']);
    expect(await tagIdsOf(['band', 1])).toEqual([ambient]);
    expect(await tagIdsOf(['band', 2])).toEqual([ambient]);
    expect(await tagIdsOf(['band', 3])).toEqual([]);
  });

  it('round-trips through JSON', async () => {
    const id = await tagId('ambient');
    await assignTag(db, id, [['band', 1]], 'add');
    const json: unknown = JSON.parse(JSON.stringify(await exportTags(db)));

    expect(parseTagBackup(json)).toEqual(await exportTags(db));
  });

  it('reads a version 1 file, from before wishlist tags', () => {
    expect(
      parseTagBackup({ version: 1, tags: [{ name: 'x', assignments: [['band', 1]] }] }),
    ).toEqual({
      version: 1,
      tags: [{ name: 'x', assignments: [['band', 1]], items: [] }],
    });
  });

  it('reads a version 3 file, ignoring the notes it had', () => {
    const note = { itemKey: 'a5', text: 'ask Sam', rating: 4 };
    expect(
      parseTagBackup({
        version: 3,
        tags: [{ name: 'x', assignments: [], items: ['a5'] }],
        notes: [note],
      }),
    ).toEqual({
      version: 3,
      tags: [{ name: 'x', assignments: [], items: ['a5'] }],
    });
  });

  it('rejects a file that is not a tags backup', () => {
    expect(parseTagBackup({ version: 4, tags: [] })).toBeNull();
    expect(
      parseTagBackup({ version: 2, tags: [{ name: 'x', assignments: [], items: ['x1'] }] }),
    ).toBeNull();
    expect(
      parseTagBackup({ version: 1, tags: [{ name: 'x', assignments: [['label', 1]] }] }),
    ).toBeNull();
  });
});
