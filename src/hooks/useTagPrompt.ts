import { useCallback, useState } from 'react';
import { type ReleaseInfo, WISHLIST_ACTION } from '../bandcamp';
import { sendMessage } from '../shared/messages';
import { loadSettings } from '../shared/settings';
import { notifyFollowingChanged } from './followingChanges';
import { usePageActionChange } from './usePageActionChange';

export type TagPromptView = { open: false } | { open: true; anchor: Element };

/** Saves the change so the page's tag editor shows at once. False when there's nothing to tag. */
async function record(
  release: Pick<ReleaseInfo, 'itemKey' | 'albumKey'>,
  change: 'on' | 'off',
): Promise<boolean> {
  if (change === 'on') return sendMessage('markWishlisted', { release });
  await sendMessage('markUnwishlisted', { itemKey: release.itemKey });
  return false;
}

/**
 * Watches Bandcamp's heart for `release`. A heart is saved at once and opens the tag picker
 * next to it (decisions §21); an un-heart closes the picker.
 */
export function useTagPrompt(
  doc: Document,
  release: Pick<ReleaseInfo, 'itemKey' | 'albumKey'>,
): { view: TagPromptView; close: () => void } {
  const [view, setView] = useState<TagPromptView>({ open: false });

  usePageActionChange(doc, WISHLIST_ACTION, (change) => {
    if (change === 'off') setView({ open: false });
    Promise.all([record(release, change), loadSettings()])
      .then(([taggable, settings]) => {
        notifyFollowingChanged();
        const anchor = WISHLIST_ACTION.button(doc);
        if (change === 'on' && taggable && settings.tagPrompt && anchor) {
          setView({ open: true, anchor });
        }
      })
      .catch((error: unknown) => console.warn('crater: could not save the change', error));
  });

  const close = useCallback(() => setView({ open: false }), []);
  return { view, close };
}
