// @vitest-environment jsdom
// The whole tab against a fake worker: the React root, its portals into the bar and every card,
// filtering and unfollow tracking together.
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureText } from '../../../tests/fixtures';
import { flushObservers, followingTabDocument } from '../../../tests/followingTabDom';
import { parseFanPage } from '../../bandcamp';
import type { Following, FollowingKey, Tag } from '../../shared/following';
import { mountFollowing } from './mountFollowing';

const TAGS: Tag[] = [
  { id: 1, name: 'dub', nameKey: 'dub' },
  { id: 2, name: 'techno', nameKey: 'techno' },
];
let rows: Following[];
const unfollowCalls: { key: FollowingKey; unfollowed: boolean }[] = [];

/** Answers the messages the tab sends, like the worker would. */
function answer(message: { type: string; payload: Record<string, unknown> }): unknown {
  switch (message.type) {
    case 'listFollowing':
      return rows.filter((row) => row.kind === message.payload.kind);
    case 'listTags':
      return TAGS;
    case 'getTwinStandings':
      return {};
    case 'setUnfollowed': {
      const { key, unfollowed } = message.payload as { key: FollowingKey; unfollowed: boolean };
      unfollowCalls.push({ key, unfollowed });
      rows = rows.map((row) => (row.id === key[1] ? { ...row, unfollowed } : row));
      return null;
    }
    default:
      throw new Error(`not faked: ${message.type}`);
  }
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  rows = parseFanPage(fixtureText('me-fan-page.html'))
    .following.bands.firstRows.slice(0, 5)
    .map((row, index) => ({
      ...row,
      followedAt: row.followedAt ?? 0,
      tagIds: index === 0 ? [1, 2] : index === 1 ? [1] : [],
      unfollowed: false,
    }));
  unfollowCalls.length = 0;
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: async (message: { type: string; payload: Record<string, unknown> }) => {
        try {
          return { ok: true, data: answer(message) };
        } catch (error) {
          return { ok: false, error: String(error) };
        }
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Lets the fake worker answer and React commit. */
async function settle(): Promise<void> {
  await act(async () => {
    await flushObservers();
    await flushObservers();
  });
}

const ourCards = (doc: Document) => [
  ...doc.querySelectorAll<HTMLLIElement>('.dighead-following-list > li.followeer'),
];
const bar = (doc: Document) =>
  doc.querySelector('#following-bands-container dighead-following-bar')?.shadowRoot;

describe('the following tab', () => {
  it('shows every follow as a card with its tags, and filters by tag by hiding cards', async () => {
    const doc = followingTabDocument();
    await act(async () => mountFollowing(doc));
    await settle();

    const cards = ourCards(doc);
    expect(cards).toHaveLength(5);
    const chips = (card: Element) =>
      [...(card.querySelector('dighead-card')?.shadowRoot?.querySelectorAll('.dh-chip') ?? [])].map(
        (chip) => chip.textContent,
      );
    expect(chips(cards[0] as Element)).toEqual(['dub', 'techno']);
    expect(cards[0]?.querySelector('dighead-card')?.shadowRoot?.textContent).toContain('+ tag');

    const techno = [...(bar(doc)?.querySelectorAll('button[aria-pressed]') ?? [])].find(
      (button) => button.textContent === 'techno',
    ) as HTMLButtonElement | undefined;
    await act(async () => techno?.click());

    expect(ourCards(doc).map((card) => card.hidden)).toEqual([false, true, true, true, true]);
    expect(bar(doc)?.textContent).toContain('Showing 1 of 5');
  });

  it('says so when the filter matches nothing, and clears it', async () => {
    const doc = followingTabDocument();
    await act(async () => mountFollowing(doc));
    await settle();

    const search = bar(doc)?.querySelector('input[type="search"]') as HTMLInputElement;
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(search, 'no such name');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(ourCards(doc).every((card) => card.hidden)).toBe(true);
    expect(bar(doc)?.textContent).toContain('No follows match these filters');
    const clear = [...(bar(doc)?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent === 'Clear filters',
    );
    await act(async () => clear?.click());
    expect(ourCards(doc).some((card) => card.hidden)).toBe(false);
  });

  it('marks a card unfollowed when Bandcamp’s handler flips its button, keeping its tags', async () => {
    const doc = followingTabDocument();
    await act(async () => mountFollowing(doc));
    await settle();
    const [first] = rows;
    const button = doc.getElementById(`follow-unfollow-band_${first?.id}`);

    button?.classList.remove('following');
    await settle();
    await settle();

    expect(unfollowCalls).toEqual([{ key: ['band', first?.id], unfollowed: true }]);
    const card = ourCards(doc)[0];
    expect(card?.classList.contains('dighead-unfollowed')).toBe(true);
    expect(card?.querySelector('dighead-card')?.shadowRoot?.textContent).toContain('dub');
  });

  it('shows the bulk bar once a card is checked', async () => {
    const doc = followingTabDocument();
    await act(async () => mountFollowing(doc));
    await settle();

    const box = ourCards(doc)[1]
      ?.querySelector('.fan-image dighead-card-select')
      ?.shadowRoot?.querySelector('button[role="checkbox"]') as HTMLButtonElement | undefined;
    await act(async () => box?.click());

    expect(bar(doc)?.querySelector('.dh-bulk-bar')?.textContent).toContain('1 selected');
  });
});
