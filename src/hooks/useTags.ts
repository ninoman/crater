import { useMemo } from 'react';
import type {
  FollowingKey,
  Tag,
  TagAction,
  TagBackup,
  TagImportSummary,
  TagResult,
} from '../shared/following';
import { sendMessage } from '../shared/messages';
import { notifyFollowingChanged } from './followingChanges';
import { type QueryView, useFollowingQuery } from './useFollowingQuery';

export type TagsView = QueryView<Tag[]>;

export interface TagActions {
  create: (name: string) => Promise<TagResult>;
  rename: (id: number, name: string) => Promise<TagResult>;
  remove: (id: number) => Promise<void>;
  /** Adds or removes a tag on many followings. Answers with how many changed. */
  assign: (tagId: number, keys: FollowingKey[], action: TagAction) => Promise<number>;
  exportBackup: () => Promise<TagBackup>;
  importBackup: (backup: TagBackup) => Promise<TagImportSummary>;
}

/** Runs a mutation, then tells every following hook to refetch. Rejects if the worker does. */
async function changing<T>(run: Promise<T>): Promise<T> {
  const result = await run;
  notifyFollowingChanged();
  return result;
}

const actions: TagActions = {
  create: (name) => changing(sendMessage('createTag', { name })),
  rename: (id, name) => changing(sendMessage('renameTag', { id, name })),
  remove: async (id) => {
    await changing(sendMessage('deleteTag', { id }));
  },
  assign: (tagId, keys, action) => changing(sendMessage('assignTag', { tagId, keys, action })),
  exportBackup: () => sendMessage('exportTags', {}),
  importBackup: (backup) => changing(sendMessage('importTags', { backup })),
};

/** Your tags by name, with the mutations. Every following hook refetches after one. */
export function useTags(): { view: TagsView } & TagActions {
  const view = useFollowingQuery('tags', () => sendMessage('listTags', {}));
  return useMemo(() => ({ view, ...actions }), [view]);
}
