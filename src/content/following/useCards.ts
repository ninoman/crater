import { useLayoutEffect, useState } from 'react';
import type { Following } from '../../shared/following';
import { type Card, type CardList, createCardList } from './cardList';

/**
 * Keeps `list` holding a card for each of `rows` (null while loading leaves it alone), and
 * answers with the cards to portal into. Cards are built before paint, so they never flash bare.
 */
export function useCards(
  list: HTMLOListElement,
  rows: readonly Following[] | null,
): { cardList: CardList; cards: Card[] } {
  const [cardList] = useState(() => createCardList(list));
  const [cards, setCards] = useState<Card[]>([]);

  useLayoutEffect(() => {
    if (rows) setCards(cardList.update(rows));
  }, [cardList, rows]);

  return { cardList, cards };
}
