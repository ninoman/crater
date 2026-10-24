import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DigheadDb } from '../schema';
import { MAX_NOTE_LENGTH, normaliseNote, noteOf, saveItemNote } from './itemNotes';

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('normaliseNote', () => {
  it('trims the text and keeps a rating from 1 to 5', () => {
    expect(normaliseNote({ text: '  ask Sam  ', rating: 3 })).toEqual({
      text: 'ask Sam',
      rating: 3,
    });
  });

  it('turns a rating outside 1 to 5, or a fraction, into unrated', () => {
    for (const rating of [0, 6, 2.5, Number.NaN]) {
      expect(normaliseNote({ text: 'x', rating })).toEqual({ text: 'x', rating: null });
    }
  });

  it('is nothing when there is neither text nor a rating', () => {
    expect(normaliseNote({ text: '   ', rating: null })).toBeNull();
    expect(normaliseNote({ text: '', rating: 0 })).toBeNull();
  });

  it('keeps a bare rating', () => {
    expect(normaliseNote({ text: '', rating: 5 })).toEqual({ text: '', rating: 5 });
  });

  it('cuts a very long note', () => {
    const note = normaliseNote({ text: 'a'.repeat(MAX_NOTE_LENGTH + 50), rating: null });
    expect(note?.text).toHaveLength(MAX_NOTE_LENGTH);
  });
});

describe('saveItemNote', () => {
  it('stores a note and answers what was kept', async () => {
    const kept = await saveItemNote(db, 'a1', { text: ' hello ', rating: 4 }, 99);

    expect(kept).toEqual({ text: 'hello', rating: 4 });
    expect(await db.itemNotes.get('a1')).toEqual({
      itemKey: 'a1',
      text: 'hello',
      rating: 4,
      updatedAt: 99,
    });
    expect(noteOf(await db.itemNotes.get('a1'))).toEqual(kept);
  });

  it('replaces an earlier note, and deletes it when emptied', async () => {
    await saveItemNote(db, 'a1', { text: 'one', rating: 1 }, 1);
    await saveItemNote(db, 'a1', { text: 'two', rating: null }, 2);
    expect(await db.itemNotes.get('a1')).toMatchObject({ text: 'two', rating: null });

    expect(await saveItemNote(db, 'a1', { text: ' ', rating: null }, 3)).toBeNull();
    expect(await db.itemNotes.get('a1')).toBeUndefined();
  });
});
