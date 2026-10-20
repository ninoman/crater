// Keeps our list's light-DOM cards in step with the followings, one card per row, and reports
// when Bandcamp's handler flips a card's follow button. Cards are reused across updates and only
// moved when the order changes, so focus inside a card and Bandcamp's button state survive.

import { FAN_PAGE_DOM, followCardHtml } from '../../bandcamp';
import type { Following } from '../../shared/following';
import { createShadowSlot } from '../shared/shadowSlot';
import { followChange } from './followChange';
import { followingCss } from './followingStyles';
import { FOLLOWING_CLASSES } from './takeOverList';

export interface Card {
  id: number;
  item: HTMLLIElement;
  /** Inside the card's shadow root: where the checkbox, tags and twin rank render. */
  slot: HTMLElement;
}

export interface CardList {
  /** Makes the list hold exactly `rows`, in order. Answers with their cards, in the same order. */
  update: (rows: readonly Following[]) => Card[];
  /** Hides every card whose id isn't in `visible`. */
  show: (visible: ReadonlySet<number>) => void;
  /** Calls back when a follow button changes. Returns a function that stops watching. */
  watchFollows: (onChange: (id: number, following: boolean) => void) => () => void;
}

function buildCard(doc: Document, row: Following): Card {
  const template = doc.createElement('template');
  template.innerHTML = followCardHtml(row);
  const item = template.content.firstElementChild as HTMLLIElement;
  // Hundreds of avatars, most of them below the fold.
  item.querySelector('img')?.setAttribute('loading', 'lazy');
  // The markup says "following"; a row unfollowed since the last sync must offer "Follow",
  // or a click would send another unfollow.
  if (row.unfollowed) {
    item
      .querySelector(FAN_PAGE_DOM.followButton)
      ?.classList.remove(FAN_PAGE_DOM.followingButtonClass);
  }
  const { host, container } = createShadowSlot(doc, 'dighead-card', followingCss);
  item.append(host);
  return { id: row.id, item, slot: container };
}

export function createCardList(list: HTMLOListElement): CardList {
  const doc = list.ownerDocument;
  const cards = new Map<number, Card>();
  const ids = new WeakMap<Element, number>();

  return {
    update(rows) {
      const wanted = new Set(rows.map((row) => row.id));
      for (const [id, card] of cards) {
        if (wanted.has(id)) continue;
        card.item.remove();
        cards.delete(id);
      }

      let previous: Element | null = null;
      const ordered = rows.map((row) => {
        let card = cards.get(row.id);
        if (!card) {
          card = buildCard(doc, row);
          cards.set(row.id, card);
          ids.set(card.item, row.id);
        }
        const expected = previous ? previous.nextElementSibling : list.firstElementChild;
        if (card.item !== expected) {
          if (previous) previous.after(card.item);
          else list.prepend(card.item);
        }
        card.item.classList.toggle(FOLLOWING_CLASSES.unfollowed, row.unfollowed);
        previous = card.item;
        return card;
      });
      return ordered;
    },

    show(visible) {
      for (const [id, card] of cards) card.item.hidden = !visible.has(id);
    },

    watchFollows(onChange) {
      const observer = new MutationObserver((records) => {
        // A batch can hold several changes to one button: compare its class before the first
        // with its class now, so each button reports at most once.
        const before = new Map<Element, string | null>();
        for (const { target, oldValue } of records) {
          if (target instanceof Element && !before.has(target)) before.set(target, oldValue);
        }
        for (const [button, oldClass] of before) {
          if (!button.matches(FAN_PAGE_DOM.followButton)) continue;
          const card = button.closest(FAN_PAGE_DOM.followingCard);
          const id = card ? ids.get(card) : undefined;
          const change = followChange(oldClass, button.getAttribute('class'));
          if (id !== undefined && change) onChange(id, change === 'followed');
        }
      });
      observer.observe(list, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
        attributeOldValue: true,
      });
      return () => observer.disconnect();
    },
  };
}
