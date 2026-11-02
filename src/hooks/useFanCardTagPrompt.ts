import { useCallback, useState } from 'react';
import { type FanItemCard, type ItemKey, readFanItemCard } from '../bandcamp';
import { sendMessage } from '../shared/messages';
import { loadSettings } from '../shared/settings';
import { notifyFollowingChanged } from './followingChanges';
import { useFanCardWishlistChange } from './useFanCardWishlistChange';

export type FanCardPromptView =
  | { open: false }
  | { open: true; anchor: Element; itemKey: ItemKey; name: string };

const CLOSED: FanCardPromptView = { open: false };

/** Saves the change. False when there's nothing to tag. */
async function record(item: FanItemCard, change: 'on' | 'off'): Promise<boolean> {
  if (change === 'on') return sendMessage('markCardWishlisted', { card: item });
  await sendMessage('markUnwishlisted', { itemKey: item.itemKey });
  return false;
}

/**
 * Watches the hearts on the item cards of someone's profile. A heart is saved at once and opens
 * the tag picker next to its card (decisions §21); an un-heart closes that card's picker.
 */
export function useFanCardTagPrompt(doc: Document): {
  view: FanCardPromptView;
  close: () => void;
} {
  const [view, setView] = useState<FanCardPromptView>(CLOSED);

  useFanCardWishlistChange(doc, (change, actions) => {
    const found = readFanItemCard(actions);
    if (!found) {
      console.warn('crater: could not read a wishlisted card', actions);
      return;
    }
    const { card, item } = found;
    if (change === 'off') {
      setView((open) => (open.open && open.itemKey === item.itemKey ? CLOSED : open));
    }
    Promise.all([record(item, change), loadSettings()])
      .then(([taggable, settings]) => {
        notifyFollowingChanged();
        if (change === 'on' && taggable && settings.tagPrompt) {
          setView({
            open: true,
            anchor: card,
            itemKey: item.itemKey,
            name: `${item.artist} – ${item.title}`,
          });
        }
      })
      .catch((error: unknown) => console.warn('crater: could not save the change', error));
  });

  const close = useCallback(() => setView(CLOSED), []);
  return { view, close };
}
