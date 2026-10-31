// Reads the item cards on a fan page and their wishlist control (decisions §21).

import { FAN_PAGE_DOM as DOM } from './fanPageDom';
import { itemKey } from './keys';
import { actionChange } from './pageActions';
import type { FanItemCard } from './types';

function isWishlisted(classes: string): boolean | null {
  const names = classes.split(/\s+/);
  if (names.includes(DOM.itemActionsOn)) return true;
  if (names.includes(DOM.itemActionsOff)) return false;
  // On your own profile, or you own it.
  return null;
}

/** What a class change on `element` means, given its old class attribute. */
export function cardWishlistChange(element: Element, oldClasses: string): 'on' | 'off' | null {
  if (!element.matches(DOM.itemActions)) return null;
  return actionChange(isWishlisted(oldClasses), isWishlisted(element.className));
}

function artIdOf(card: Element): number | null {
  const src = card.querySelector(DOM.itemArt)?.getAttribute('src') ?? '';
  const match = /\/img\/a(\d+)_/.exec(src);
  return match ? Number(match[1]) : null;
}

/** The release on the card holding `element`, and the card. Null when it lacks anything needed. */
export function readFanItemCard(element: Element): { card: Element; item: FanItemCard } | null {
  const card = element.closest(DOM.itemCard);
  if (!card) return null;

  const type = card.getAttribute('data-tralbumtype');
  const id = Number(card.getAttribute('data-tralbumid'));
  const bandId = Number(card.getAttribute('data-bandid'));
  const title = card.querySelector(DOM.itemTitle)?.textContent?.trim();
  const artist = card
    .querySelector(DOM.itemArtist)
    ?.textContent?.trim()
    .replace(/^by\s+/, '');
  const href = card.querySelector(DOM.itemLink)?.getAttribute('href');
  if ((type !== 'a' && type !== 't') || !(id > 0) || !(bandId > 0)) return null;
  if (!title || !artist || !href) return null;

  const url = new URL(href);
  return {
    card,
    item: {
      itemKey: itemKey(type, id),
      bandId,
      title,
      artist,
      url: url.origin + url.pathname,
      artId: artIdOf(card),
    },
  };
}
