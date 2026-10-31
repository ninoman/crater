// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fixtureText } from '../../tests/fixtures';
import { cardWishlistChange, readFanItemCard } from './fanItemCard';

function cardActions(id: number): Element {
  const page = new DOMParser().parseFromString(fixtureText('fan-page-in-common.html'), 'text/html');
  const actions = page.querySelector(`#collection-item-container_${id} .collection-item-actions`);
  if (!actions) throw new Error('no such card');
  return actions;
}

describe('readFanItemCard', () => {
  it('reads a track card, which links to its album', () => {
    expect(readFanItemCard(cardActions(104837503))?.item).toEqual({
      itemKey: 't104837503',
      bandId: 675327826,
      title: 'Claudio PRC - Grainphase',
      artist: 'Reeko & Claudio PRC',
      url: 'https://technokunst.bandcamp.com/album/split-series-02',
      artId: 3027111621,
    });
  });

  it('is null outside a card', () => {
    expect(readFanItemCard(document.createElement('div'))).toBeNull();
  });
});

describe('cardWishlistChange', () => {
  it('reads a heart and an un-heart', () => {
    const actions = cardActions(104837503);
    const before = actions.className;
    actions.classList.replace('wishlist', 'wishlisted');
    expect(cardWishlistChange(actions, before)).toBe('on');
    expect(cardWishlistChange(actions, actions.className)).toBeNull();

    const hearted = actions.className;
    actions.classList.replace('wishlisted', 'wishlist');
    expect(cardWishlistChange(actions, hearted)).toBe('off');
  });

  it('ignores other elements and what you own', () => {
    const actions = cardActions(104837503);
    actions.classList.replace('wishlist', 'purchased');
    expect(cardWishlistChange(actions, 'collection-item-actions wishlist')).toBeNull();

    const other = document.createElement('div');
    other.className = 'wishlisted';
    expect(cardWishlistChange(other, 'wishlist')).toBeNull();
  });
});
