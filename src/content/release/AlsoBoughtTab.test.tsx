// @vitest-environment jsdom
// The Also-bought tab with filters: the bar stays, and a list the filters emptied says so.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListFiltersState } from '../../hooks/useListFilters';
import type { ScanProgressView } from '../../hooks/useScanProgress';
import type { AlsoBoughtResult } from '../../shared/alsoBought';
import { NO_FILTERS } from '../../shared/listFilters';
import { AlsoBoughtTab } from './AlsoBoughtTab';

const listed: ScanProgressView = {
  state: 'ready',
  progress: { releaseKey: 'a1', scanned: 30, total: 30, listed: true },
};
const filters = { ...NO_FILTERS, physical: true };
const summary = { hidden: 9, unjudged: 0, limited: false };

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(result: AlsoBoughtResult, setFilters = vi.fn()) {
  const state: ListFiltersState = { filters, setFilters, ready: true, place: '' };
  act(() =>
    root.render(
      <AlsoBoughtTab
        view={{ state: 'ready', result }}
        filters={state}
        progress={listed}
        scanStopped={false}
        showEarly={false}
        onHide={() => {}}
      />,
    ),
  );
  return setFilters;
}

describe('AlsoBoughtTab', () => {
  it('says the filters emptied a finished list, and clears them on request', () => {
    const setFilters = render({
      releaseKey: 'a1',
      rows: [],
      warmup: null,
      filtered: { filters, summary },
    });

    expect(container.textContent).toContain('Nothing matches these filters');
    expect(container.textContent).toContain('9 hidden by filters');
    const clear = [...container.querySelectorAll('button')].filter(
      (b) => b.textContent === 'Clear filters',
    );
    act(() => clear.at(-1)?.click());
    expect(setFilters).toHaveBeenCalledWith(NO_FILTERS);
  });

  it('leaves an empty list during the warm-up to the warm-up', () => {
    render({
      releaseKey: 'a1',
      rows: [],
      warmup: { read: 3, readTarget: 20, confident: 0, confidentTarget: 5 },
      filtered: { filters, summary },
    });

    expect(container.textContent).not.toContain('Nothing matches these filters');
  });

  it('shows how many the filters hid, over the list', () => {
    render({
      releaseKey: 'a1',
      rows: [
        {
          matchKey: 'a2',
          title: 'Two',
          artist: 'Artist',
          label: null,
          url: 'https://artist.bandcamp.com/album/two',
          coverUrl: null,
          reason: { kind: 'same-artist' },
          followed: null,
        },
      ],
      warmup: null,
      filtered: { filters, summary },
    });

    expect(container.querySelector('[role="status"]')?.textContent).toBe('9 hidden by filters');
    expect(container.textContent).toContain('Two');
  });
});
