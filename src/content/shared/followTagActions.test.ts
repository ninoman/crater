import { describe, expect, it, vi } from 'vitest';
import type { FollowingKey, TagResult } from '../../shared/following';
import { followTagHandlers, type TagMutations } from './followTagActions';

const KEYS: FollowingKey[] = [
  ['band', 1],
  ['band', 2],
];

function fakes(created: TagResult = { ok: true, tag: { id: 9, name: 'dub', nameKey: 'dub' } }) {
  const mutations = {
    create: vi.fn<TagMutations['create']>(async () => created),
    assign: vi.fn<TagMutations['assign']>(async () => 2),
  };
  const onError = vi.fn<(message: string) => void>();
  return { mutations, onError };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('followTagHandlers', () => {
  it('adds a tag not every account has, in one call for all of them', () => {
    const { mutations, onError } = fakes();
    followTagHandlers(mutations, KEYS, [3], onError).onToggle(4);
    expect(mutations.assign).toHaveBeenCalledExactlyOnceWith(4, KEYS, 'add');
  });

  it('removes a tag every account has', () => {
    const { mutations, onError } = fakes();
    followTagHandlers(mutations, KEYS, [3], onError).onToggle(3);
    expect(mutations.assign).toHaveBeenCalledExactlyOnceWith(3, KEYS, 'remove');
  });

  it('creates a tag, then puts it on every account', async () => {
    const { mutations, onError } = fakes();
    followTagHandlers(mutations, KEYS, [], onError).onCreate('dub');
    await settle();
    expect(mutations.create).toHaveBeenCalledWith('dub');
    expect(mutations.assign).toHaveBeenCalledExactlyOnceWith(9, KEYS, 'add');
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports a refused or failed change', async () => {
    const refused = fakes({ ok: false, reason: 'empty' });
    followTagHandlers(refused.mutations, KEYS, [], refused.onError).onCreate(' ');
    const failed = fakes();
    failed.mutations.assign.mockRejectedValueOnce(new Error('worker gone'));
    followTagHandlers(failed.mutations, KEYS, [], failed.onError).onToggle(1);
    await settle();
    expect(refused.mutations.assign).not.toHaveBeenCalled();
    expect(refused.onError).toHaveBeenCalledWith("Couldn't create the tag (empty).");
    expect(failed.onError).toHaveBeenCalledWith('worker gone');
  });
});
