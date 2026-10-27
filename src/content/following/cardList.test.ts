// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { fixtureJson, fixtureText } from '../../../tests/fixtures';
import { flushObservers, followingTabDocument, openSubTab } from '../../../tests/followingTabDom';
import { type FollowingRow, parseFanPage, parseFollowingPage } from '../../bandcamp';
import type { Following } from '../../shared/following';
import { createCardList } from './cardList';
import { watchFollowingTab } from './followingTab';
import { FOLLOWING_CLASSES, type TakenList } from './takeOverList';

const following = (row: FollowingRow, unfollowed = false): Following => ({
  ...row,
  followedAt: row.followedAt ?? 0,
  tagIds: [],
  unfollowed,
});

const BANDS = parseFanPage(fixtureText('me-fan-page.html')).following.bands.firstRows.map((row) =>
  following(row),
);
const FANS = parseFollowingPage(fixtureJson('following_fans.json'), 'fan').rows.map((row) =>
  following(row),
);

let doc: Document;

function takeOver(kind: 'band' | 'fan'): TakenList {
  const grid = doc.getElementById('following-grid');
  if (!grid) throw new Error('no grid');
  if (kind === 'fan') openSubTab(doc, 'following-fans');
  const taken = watchFollowingTab(doc, grid).getState().lists[0];
  if (!taken) throw new Error('not taken over');
  return taken;
}

const cardIds = (list: Element) =>
  [...list.querySelectorAll(':scope > li.followeer')].map((li) =>
    Number(
      li.querySelector('button')?.getAttribute('data-band-id') ??
        li.querySelector('button')?.getAttribute('data-fan-id'),
    ),
  );

beforeEach(() => {
  doc = followingTabDocument();
});

describe('createCardList', () => {
  it('fills our list with a Bandcamp card per row, in order', () => {
    const { list } = takeOver('band');
    const cards = createCardList(list).update(BANDS);

    expect(cards.map((card) => card.id)).toEqual(BANDS.map((row) => row.id));
    expect(cardIds(list)).toEqual(BANDS.map((row) => row.id));
    const first = list.querySelector('li.followeer');
    expect(first?.querySelector('button.follow-unfollow.following')).toBeTruthy();
    expect(first?.querySelector('img')?.getAttribute('loading')).toBe('lazy');
    // Our additions sit in a shadow root inside the light-DOM card.
    expect(cards[0]?.slot.getRootNode()).toBeInstanceOf(ShadowRoot);
    expect(cards[0]?.slot.classList.contains('dh-root')).toBe(true);
    // The select box gets its own, over the avatar.
    const selectHost = (cards[0]?.selectSlot.getRootNode() as ShadowRoot | undefined)?.host;
    expect(selectHost?.parentElement?.classList.contains('fan-image')).toBe(true);
  });

  it('wins the id lookup Bandcamp’s band handler does', () => {
    const { list } = takeOver('band');
    createCardList(list).update(BANDS);
    // The fixture's own (now hidden) list holds the same buttons.
    const id = BANDS[0]?.id;
    expect(doc.querySelectorAll(`[id="follow-unfollow-band_${id}"]`).length).toBe(2);

    expect(doc.getElementById(`follow-unfollow-band_${id}`)?.closest('ol')).toBe(list);
  });

  it('builds an unfollowed row with a "Follow" button and dims it', () => {
    const { list } = takeOver('band');
    const [row] = BANDS;
    if (!row) throw new Error('no rows');
    createCardList(list).update([{ ...row, unfollowed: true }]);

    const card = list.querySelector('li.followeer');
    expect(card?.querySelector('button')?.classList.contains('following')).toBe(false);
    expect(card?.classList.contains(FOLLOWING_CLASSES.unfollowed)).toBe(true);
  });

  it('keeps cards across updates, dropping and reordering without rebuilding', () => {
    const { list } = takeOver('band');
    const cardList = createCardList(list);
    const [a, b, c] = BANDS;
    if (!a || !b || !c) throw new Error('need three rows');
    const before = cardList.update([a, b, c]);

    const after = cardList.update([c, { ...a, unfollowed: true }]);

    expect(cardIds(list)).toEqual([c.id, a.id]);
    expect(after[0]?.item).toBe(before[2]?.item);
    expect(after[1]?.item).toBe(before[0]?.item);
    expect(before[1]?.item.isConnected).toBe(false);
    expect(after[1]?.item.classList.contains(FOLLOWING_CLASSES.unfollowed)).toBe(true);
  });

  it('hides cards Bandcamp’s paging appends to our list', () => {
    const { list } = takeOver('band');
    const cardList = createCardList(list);
    const [ours] = cardList.update(BANDS.slice(0, 1));
    // Bandcamp fills the first `ol.followeer-grid` it finds, which is ours.
    const foreign = doc.querySelector('ol.followeer-grid:not(.crater-following-list) li.followeer');
    if (!foreign) throw new Error('no Bandcamp card');
    list.append(foreign.cloneNode(true));

    const display = (el: Element) => doc.defaultView?.getComputedStyle(el).display;
    expect(display(ours?.item as Element)).not.toBe('none');
    expect(display(list.lastElementChild as Element)).toBe('none');
  });
});

describe('watchFollows', () => {
  it('sees Bandcamp’s handler unfollow and re-follow a band', async () => {
    const { list } = takeOver('band');
    const cardList = createCardList(list);
    cardList.update(BANDS);
    const changes: [number, boolean][] = [];
    cardList.watchFollows((id, isFollowing) => changes.push([id, isFollowing]));
    const id = BANDS[2]?.id;
    const button = doc.getElementById(`follow-unfollow-band_${id}`);

    button?.classList.remove('following');
    await flushObservers();
    button?.classList.add('following');
    await flushObservers();

    expect(changes).toEqual([
      [id, false],
      [id, true],
    ]);
  });

  it('sees a fan unfollow, and ignores other class changes', async () => {
    const { list } = takeOver('fan');
    const cardList = createCardList(list);
    cardList.update(FANS);
    const changes: [number, boolean][] = [];
    const stop = cardList.watchFollows((id, isFollowing) => changes.push([id, isFollowing]));
    const card = list.querySelector('li.followeer');
    const button = card?.querySelector('button');

    card?.classList.add('busy');
    button?.classList.add('busy');
    button?.classList.remove('following');
    await flushObservers();
    stop();
    button?.classList.add('following');
    await flushObservers();

    expect(changes).toEqual([[FANS[0]?.id, false]]);
  });
});
