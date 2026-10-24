import { useCallback } from 'react';
import type { ItemKey } from '../bandcamp';
import type { ItemNote } from '../shared/itemList';
import { sendMessage } from '../shared/messages';
import { notifyFollowingChanged } from './followingChanges';

/** Saves a note and tells the list hooks to refetch. Rejects if the worker does. */
export function useItemNotes(): (itemKey: ItemKey, note: ItemNote) => Promise<void> {
  return useCallback(async (itemKey, note) => {
    await sendMessage('saveItemNote', { itemKey, note });
    notifyFollowingChanged();
  }, []);
}
