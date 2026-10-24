// @vitest-environment jsdom
// The follows tab against a fake worker: its states, the new / earlier split, filters and mutes.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFollowsDigestVisit } from '../../../hooks/useFollowsDigest';
import type { FollowsDigestResult, FollowsDigestRow } from '../../../shared/followsDigest';
import { PortalContainerProvider } from '../../../ui';
import { FollowsTab } from './FollowsTab';

const NOW = Date.now();

function row(n: number, patch: Partial<FollowsDigestRow> = {}): FollowsDigestRow {
  return {
    itemKey: `a${n}`,
    matchKey: `a${n}`,
    title: `Album ${n}`,
    artist: `Artist ${n}`,
    url: `https://b${n}.bandcamp.com/album/x`,
    coverUrl: null,
    newsAt: NOW,
    preorder: false,
    isNew: false,
    bandIds: [n],
    crateMates: 0,
    muted: false,
    ...patch,
  };
}

function digest(patch: Partial<FollowsDigestResult> = {}): FollowsDigestResult {
  return {
    basis: 'ready',
    rows: [row(1, { isNew: true }), row(2, { crateMates: 3 }), row(3, { muted: true })],
    accounts: [1, 2, 3].map((n) => ({
      bandId: n,
      name: n === 2 ? 'Label Two' : `Artist ${n}`,
      url: `https://b${n}.bandcamp.com`,
      tagIds: n === 2 ? [7] : [],
      muted: n === 3,
    })),
    readAccounts: 3,
    checking: 0,
    windowDays: 60,
    ...patch,
  };
}

let answer: () => FollowsDigestResult | Error;
let sent: { type: string; payload: unknown }[];

function stubWorker() {
  sent = [];
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: async (message: { type: string; payload: unknown }) => {
        sent.push(message);
        if (message.type === 'followsDigestOpened') {
          return { ok: true, data: { previousVisitAt: NOW - 1000 } };
        }
        if (message.type === 'getFollowsDigest') {
          const result = answer();
          return result instanceof Error
            ? { ok: false, error: result.message }
            : { ok: true, data: result };
        }
        if (message.type === 'listTags') {
          return { ok: true, data: [{ id: 7, name: 'labels', nameKey: 'labels' }] };
        }
        if (message.type === 'setFollowMute') return { ok: true, data: null };
        return { ok: false, error: `not faked: ${message.type}` };
      },
      onMessage: { addListener: () => {}, removeListener: () => {} },
    },
  });
}

let container: HTMLDivElement;
let root: Root;

async function render() {
  await act(async () => {
    root.render(
      <PortalContainerProvider container={container}>
        <FollowsTab />
      </PortalContainerProvider>,
    );
  });
  await act(async () => {});
}

const text = () => container.textContent ?? '';
const titles = () => [...container.querySelectorAll('a[title]')].map((a) => a.textContent);
const button = (label: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent === label);

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  resetFollowsDigestVisit();
  stubWorker();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('FollowsTab', () => {
  it('splits what is new since your last visit from the rest and folds muted accounts away', async () => {
    answer = () => digest();
    await render();
    expect(sent.slice(0, 2).map((message) => message.type)).toEqual([
      'followsDigestOpened',
      'getFollowsDigest',
    ]);
    expect(sent[1]?.payload).toEqual({ previousVisitAt: NOW - 1000 });
    expect(text()).toContain('New since your last visit');
    expect(text()).toContain('Earlier');
    expect(titles()).toEqual(['Album 1', 'Album 2']);
    expect(text()).toContain('Artist 2 · Label Two');
    expect(text()).toContain('3 of your top crate mates buy from them');
    expect(text()).toContain('Muted accounts (1)');
  });

  it("filters by the accounts' tags", async () => {
    answer = () => digest();
    await render();
    const chip = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('labels'),
    );
    await act(async () => chip?.click());
    expect(titles()).toEqual(['Album 2']);
  });

  it('mutes an account at once and tells the worker', async () => {
    answer = () => digest();
    await render();
    // What the worker answers once the mute is stored.
    const after = digest();
    answer = () => ({
      ...after,
      rows: after.rows.map((r) => (r.itemKey === 'a1' ? { ...r, muted: true } : r)),
    });
    await act(async () => button('Mute')?.click());
    expect(titles()).toEqual(['Album 2']);
    expect(sent.find((message) => message.type === 'setFollowMute')?.payload).toEqual({
      bandId: 1,
      muted: true,
    });
  });

  it('shows progress while the first reads run', async () => {
    answer = () => digest({ rows: [], readAccounts: 0, checking: 3 });
    await render();
    expect(text()).toContain('Reading the releases of the 3 accounts you follow');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuemax')).toBe(
      '3',
    );
  });

  it('says when you follow no one, and when nothing is new', async () => {
    answer = () => digest({ rows: [], accounts: [] });
    await render();
    expect(text()).toContain("You don't follow any artists or labels yet");

    answer = () => digest({ rows: [row(3, { muted: true })] });
    act(() => root.unmount());
    root = createRoot(container);
    await render();
    expect(text()).toContain('Nothing new from your follows');
  });

  it('offers to try again when the worker does not answer', async () => {
    answer = () => new Error('no worker');
    await render();
    expect(text()).toContain("Couldn't load New from your follows");
    answer = () => digest();
    await act(async () => button('Try again')?.click());
    await act(async () => {});
    expect(titles()).toEqual(['Album 1', 'Album 2']);
  });
});
