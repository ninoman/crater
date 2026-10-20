import { describe, expect, it } from 'vitest';
import { tagPickerOptions } from './tagPickerOptions';

const tags = [
  { id: 1, name: 'Jazz' },
  { id: 2, name: 'Dub techno' },
  { id: 3, name: 'jazz-funk' },
];

describe('tagPickerOptions', () => {
  it('lists every tag for an empty query, with no Create row', () => {
    expect(tagPickerOptions(tags, '  ')).toEqual(tags.map((tag) => ({ kind: 'tag', tag })));
  });

  it('filters by a case-insensitive substring and offers Create last for a new name', () => {
    expect(tagPickerOptions(tags, 'JAZ')).toEqual([
      { kind: 'tag', tag: tags[0] },
      { kind: 'tag', tag: tags[2] },
      { kind: 'create', name: 'JAZ' },
    ]);
  });

  it('offers only Create when nothing matches, trimmed', () => {
    expect(tagPickerOptions(tags, '  ambient ')).toEqual([{ kind: 'create', name: 'ambient' }]);
  });

  it("doesn't offer Create when the name already exists", () => {
    expect(tagPickerOptions(tags, ' jazz ')).toEqual([
      { kind: 'tag', tag: tags[0] },
      { kind: 'tag', tag: tags[2] },
    ]);
  });
});
