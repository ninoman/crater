import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureText } from '../../../tests/fixtures';
import { parseReleasePage, type ReleasePageItem } from '../../bandcamp';
import { closeReleaseTab, openRelease } from './index';
import { releasesInTabs } from './releaseTabs';
import { watchedReleases } from './watched';

// Keeps the scan loop from running; only the tab bookkeeping is under test.
vi.mock('./scheduler', () => ({ drainQueue: async () => {} }));

const album = parseReleasePage(fixtureText('album-page.html')).item;
const release = (n: number): ReleasePageItem => ({
  ...album,
  itemKey: `a${n}`,
  url: `https://artist.bandcamp.com/album/r${n}`,
});

beforeEach(() => {
  const session = new Map<string, unknown>();
  // A real storage call yields to other messages, so reads must not resolve instantly.
  const tick = () => new Promise((resolve) => setTimeout(resolve, 1));
  vi.stubGlobal('chrome', {
    storage: {
      session: {
        get: async (key: string) => {
          const found = session.has(key) ? { [key]: session.get(key) } : {};
          await tick();
          return found;
        },
        set: async (items: Record<string, unknown>) => {
          await tick();
          for (const [key, value] of Object.entries(items)) session.set(key, value);
        },
      },
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('overlapping release tabs', () => {
  it('records both tabs and watches both releases when two open at once', async () => {
    await Promise.all([openRelease(release(1), 1), openRelease(release(2), 2)]);

    expect((await releasesInTabs()).sort()).toEqual(['a1', 'a2']);
    expect((await watchedReleases()).sort()).toEqual(['a1', 'a2']);
  });

  it('keeps an open that overlaps a close', async () => {
    await openRelease(release(1), 1);

    await Promise.all([closeReleaseTab(1), openRelease(release(2), 2)]);

    expect(await releasesInTabs()).toEqual(['a2']);
    expect(await watchedReleases()).toEqual(['a2']);
  });
});
