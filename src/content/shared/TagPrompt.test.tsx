// @vitest-environment jsdom
// Against a fake worker: Bandcamp flips its button, we save the change, and a heart opens the
// picker next to it.
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureText } from '../../../tests/fixtures';
import type { Tag } from '../../shared/following';
import { mountShadow } from './mountShadow';
import { FollowRecorder, WishlistTagPrompt } from './TagPrompt';

const TAGS: Tag[] = [{ id: 1, name: 'dub', nameKey: 'dub' }];
let sent: { type: string; payload: unknown }[];
let followed: boolean;
let wishlisted: boolean;
let promptSetting: boolean;

/** Answers like the worker would, remembering what was marked. */
function answer(message: { type: string; payload: Record<string, unknown> }): unknown {
  sent.push(message);
  switch (message.type) {
    case 'listTags':
      return TAGS;
    case 'getFollowTags':
      return followed ? [] : null;
    case 'getItemTags':
      return wishlisted ? [] : null;
    case 'markFollowed':
      followed = true;
      return null;
    case 'setUnfollowed':
      followed = false;
      return null;
    case 'markWishlisted':
      wishlisted = true;
      return true;
    default:
      throw new Error(`not faked: ${message.type}`);
  }
}

const ACCOUNT = {
  kind: 'band' as const,
  id: 2009518365,
  name: 'Floating Points',
  url: 'https://floatingpoints.bandcamp.com',
  imageId: null,
  location: 'UK',
};

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const page = new DOMParser()
    .parseFromString(fixtureText('page-actions.html'), 'text/html')
    .getElementById('release');
  document.body.innerHTML = page?.innerHTML ?? '';
  sent = [];
  followed = false;
  wishlisted = false;
  promptSetting = true;
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
    storage: { local: { get: async () => ({ settings: { tagPrompt: promptSetting } }) } },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

/** Lets observers fire, the fake worker answer and React commit. */
async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const picker = () =>
  document.querySelector('dighead-root')?.shadowRoot?.querySelector('.dh-tag-picker');
const followButton = () => document.getElementById('follow-unfollow');
const heart = () => document.getElementById('collect-item');

describe('FollowRecorder', () => {
  it('saves a follow at once and opens no picker', async () => {
    await act(async () => mountShadow(document.body, <FollowRecorder account={ACCOUNT} />));
    followButton()?.classList.add('following');
    await settle();

    expect(sent.find((m) => m.type === 'markFollowed')?.payload).toMatchObject({
      account: { kind: 'band', id: ACCOUNT.id },
    });
    expect(picker()).toBeFalsy();
  });

  it('marks an unfollow', async () => {
    followButton()?.classList.add('following');
    followed = true;
    await act(async () => mountShadow(document.body, <FollowRecorder account={ACCOUNT} />));
    await settle();

    followButton()?.classList.remove('following');
    await settle();

    expect(sent.find((m) => m.type === 'setUnfollowed')?.payload).toEqual({
      key: ['band', ACCOUNT.id],
      unfollowed: true,
    });
  });
});

describe('WishlistTagPrompt', () => {
  it('saves a heart and opens the picker', async () => {
    const release = { itemKey: 'a3149089081' as const, albumKey: null };
    await act(async () =>
      mountShadow(document.body, <WishlistTagPrompt release={release} name="FP – Promises" />),
    );
    heart()?.classList.replace('wishlist', 'wishlisted');
    await settle();

    expect(sent.find((m) => m.type === 'markWishlisted')?.payload).toEqual({ release });
    expect(picker()?.textContent).toContain('Tag FP – Promises');
  });

  it('focuses the picker, and Escape closes it', async () => {
    const release = { itemKey: 'a3149089081' as const, albumKey: null };
    await act(async () =>
      mountShadow(document.body, <WishlistTagPrompt release={release} name="FP – Promises" />),
    );
    heart()?.classList.replace('wishlist', 'wishlisted');
    await settle();

    const input = picker()?.querySelector('input');
    expect((input?.getRootNode() as ShadowRoot | undefined)?.activeElement).toBe(input);
    await act(async () => {
      input?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
      );
    });
    expect(picker()).toBeFalsy();
  });

  it('saves the heart but stays closed when the setting is off', async () => {
    promptSetting = false;
    const release = { itemKey: 'a3149089081' as const, albumKey: null };
    await act(async () =>
      mountShadow(document.body, <WishlistTagPrompt release={release} name="FP – Promises" />),
    );
    heart()?.classList.replace('wishlist', 'wishlisted');
    await settle();

    expect(sent.some((m) => m.type === 'markWishlisted')).toBe(true);
    expect(picker()).toBeFalsy();
  });
});
