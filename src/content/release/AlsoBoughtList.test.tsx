// @vitest-environment jsdom
// The Also-bought tab's states during and after the warm-up.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AlsoBoughtView } from '../../hooks/useAlsoBought';
import type { ScanProgressView } from '../../hooks/useScanProgress';
import type { AlsoBoughtResult, AlsoBoughtRow } from '../../shared/alsoBought';
import { AlsoBoughtList } from './AlsoBoughtList';

const listed: ScanProgressView = {
  state: 'ready',
  progress: { releaseKey: 'a1', scanned: 12, total: 300, listed: true },
};
const warmup = { read: 12, readTarget: 20, confident: 3, confidentTarget: 5 };

function row(matchKey: `a${number}`, reason: AlsoBoughtRow['reason']): AlsoBoughtRow {
  return {
    matchKey,
    title: `Title ${matchKey}`,
    artist: 'Artist',
    label: null,
    url: `https://artist.bandcamp.com/album/${matchKey}`,
    coverUrl: null,
    reason,
    followed: null,
  };
}

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

function render(result: AlsoBoughtResult, progress: ScanProgressView = listed, stopped = false) {
  const view: AlsoBoughtView = { state: 'ready', result };
  act(() =>
    root.render(
      <AlsoBoughtList view={view} progress={progress} scanStopped={stopped} onHide={() => {}} />,
    ),
  );
}

describe('AlsoBoughtList', () => {
  it('shows warm-up progress with labelled same-artist picks below', () => {
    render({ releaseKey: 'a1', warmup, rows: [row('a2', { kind: 'same-artist' })] });

    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      '12 of 20 supporters read · 3 of 5 strong picks',
    );
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(
      '15',
    );
    expect(container.querySelector('h3')?.textContent).toBe(
      'Meanwhile, from the same artist and label',
    );
    expect(container.querySelector('ul')?.getAttribute('aria-label')).toBe('Same artist and label');
    expect(container.textContent).toContain('More from this artist');
  });

  it('shows only the progress when there are no picks to fill the wait', () => {
    render({ releaseKey: 'a1', warmup, rows: [] }, listed, true);

    expect(container.textContent).toContain('The scanner is stopped for now');
    expect(container.querySelector('h3')).toBeNull();
  });

  it('says it is queued before the supporter list is in', () => {
    const unlisted: ScanProgressView = {
      state: 'ready',
      progress: { releaseKey: 'a1', scanned: 0, total: 0, listed: false },
    };
    render({ releaseKey: 'a1', warmup: { ...warmup, read: 0 }, rows: [] }, unlisted);

    expect(container.textContent).toContain('Queued for scanning');
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('lists co-owned picks once warmed up', () => {
    render({
      releaseKey: 'a1',
      warmup: null,
      rows: [row('a3', { kind: 'co-owned', owners: 6, twins: 0 })],
    });

    expect(container.querySelector('ul')?.getAttribute('aria-label')).toBe('Also bought');
    expect(container.textContent).toContain('6 supporters have this so far');
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
