// The hearts on a list's rows and their player: add to or take off your Bandcamp wishlist, and
// open the tag picker on an add, as Bandcamp's own heart does (decisions §21). Optimistic: the
// heart and the picker show at once, and a refusal or failure undoes both.

import { useCallback, useState } from 'react';
import type { ItemKey, ReleaseInfo } from '../bandcamp';
import { sendMessage } from '../shared/messages';
import { loadSettings } from '../shared/settings';
import type { WishlistHeart } from '../ui';
import { notifyFollowingChanged } from './followingChanges';

/** What a heart wishlists. */
export interface HeartTarget {
  /** The row it's on, which shows the tag picker. */
  rowKey: ItemKey;
  /** A page of the release, its album or one of its tracks, for the request's crumb. */
  url: string;
  release: Pick<ReleaseInfo, 'itemKey' | 'albumKey'>;
  /** "Artist – Title", for the picker's title. */
  name: string;
}

/** The tag picker an add opened, next to its heart. */
export interface WishlistPrompt {
  rowKey: ItemKey;
  itemKey: ItemKey;
  name: string;
  anchor: Element;
}

export interface WishlistHearts {
  /** By the item's key: a row's matchKey, or a track's key. */
  heart: (itemKey: ItemKey) => WishlistHeart;
  toggle: (target: HeartTarget, anchor: HTMLElement) => void;
  prompt: WishlistPrompt | null;
  closePrompt: () => void;
}

const OFF: WishlistHeart = { on: false, status: 'idle' };

/**
 * An add is saved locally before Bandcamp is asked, so the picker has an item to tag; a failed
 * add takes it out again, leaving any tags for a re-add (decisions §14). A removal is saved only
 * once Bandcamp confirms it.
 */
async function save(target: HeartTarget, wishlisted: boolean, onAdded: () => void) {
  if (wishlisted && (await sendMessage('markWishlisted', { release: target.release }))) {
    notifyFollowingChanged();
    onAdded();
  }
  try {
    const { status } = await sendMessage('setWishlisted', {
      url: target.url,
      release: target.release,
      wishlisted,
    });
    if (status === 'done') return status;
    await undoAdd(target, wishlisted);
    return status;
  } catch (error) {
    await undoAdd(target, wishlisted);
    throw error;
  }
}

async function undoAdd(target: HeartTarget, wishlisted: boolean) {
  if (!wishlisted) return;
  await sendMessage('markUnwishlisted', { itemKey: target.release.itemKey });
  notifyFollowingChanged();
}

/** Hearts start off: lists leave out what's already in your wishlist. */
export function useWishlistHearts(): WishlistHearts {
  const [hearts, setHearts] = useState<ReadonlyMap<ItemKey, WishlistHeart>>(new Map());
  const [prompt, setPrompt] = useState<WishlistPrompt | null>(null);

  const setHeart = useCallback((key: ItemKey, heart: WishlistHeart) => {
    setHearts((current) => new Map(current).set(key, heart));
  }, []);

  const heart = useCallback((key: ItemKey) => hearts.get(key) ?? OFF, [hearts]);

  const toggle = useCallback(
    (target: HeartTarget, anchor: HTMLElement) => {
      const key = target.release.itemKey;
      const { on, status } = hearts.get(key) ?? OFF;
      if (status === 'saving') return;
      const wishlisted = !on;
      setHeart(key, { on: wishlisted, status: 'saving' });
      if (!wishlisted) setPrompt(null);
      const closeOwnPrompt = () =>
        setPrompt((current) => (current?.itemKey === key ? null : current));

      const openPrompt = () =>
        loadSettings().then((settings) => {
          if (!settings.tagPrompt) return;
          setPrompt({ rowKey: target.rowKey, itemKey: key, name: target.name, anchor });
        });

      save(target, wishlisted, () => void openPrompt()).then(
        (result) => {
          if (result === 'done') {
            setHeart(key, { on: wishlisted, status: 'idle' });
            return;
          }
          closeOwnPrompt();
          setHeart(key, { on, status: 'signed-out' });
        },
        (error: unknown) => {
          console.warn('crater: could not change your wishlist', error);
          closeOwnPrompt();
          setHeart(key, { on, status: 'error' });
        },
      );
    },
    [hearts, setHeart],
  );

  const closePrompt = useCallback(() => setPrompt(null), []);
  return { heart, toggle, prompt, closePrompt };
}
