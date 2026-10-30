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
    heard: false,
    hide: { band: null, label: null },
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

function render(
  result: AlsoBoughtResult,
  progress: ScanProgressView = listed,
  stopped = false,
  firstWaitOver = false,
) {
  const view: AlsoBoughtView = { state: 'ready', result };
  act(() =>
    root.render(
      <AlsoBoughtList
        view={view}
        progress={progress}
        scanStopped={stopped}
        firstWaitOver={firstWaitOver}
        actions={{ hide: () => {}, setHeard: () => {} }}
        hideHeard={false}
        onHideHeardChange={() => {}}
      />,
    ),
  );
}

describe('AlsoBoughtList', () => {
  it('shows early picks under the warm-up progress once the first wait is over', () => {
    const rows = [
      row('a3', { kind: 'co-owned', owners: 2, crateMates: 0 }),
      row('a2', { kind: 'same-artist' }),
    ];
    render({ releaseKey: 'a1', warmup, rows }, listed, false, true);

    expect(container.querySelector('.dh-warmup__title')?.textContent).toBe('Early picks');
    expect(container.textContent).toContain('12 of 20 supporters read');
    expect(container.querySelector('ul')?.getAttribute('aria-label')).toBe('Early picks');
    expect(container.textContent).toContain('More from this artist');
    expect(container.querySelector('.dh-skeleton')).toBeNull();
  });

  it("doesn't hold early picks back while the scanner is stopped", () => {
    const rows = [row('a3', { kind: 'co-owned', owners: 2, crateMates: 0 })];
    const notListed: ScanProgressView = {
      state: 'ready',
      progress: { releaseKey: 'a1', scanned: 0, total: 0, listed: false },
    };
    render({ releaseKey: 'a1', warmup, rows }, notListed, true);

    expect(container.querySelector('.dh-warmup__title')?.textContent).toBe('Early picks');
    expect(container.querySelector('ul')?.getAttribute('aria-label')).toBe('Early picks');
    expect(container.textContent).not.toContain('No recommendations yet');
  });

  it('keeps the loader after the first wait while there are no picks', () => {
    render({ releaseKey: 'a1', warmup, rows: [] }, listed, false, true);

    expect(container.querySelector('.dh-warmup__title')?.textContent).toBe(
      'Reading supporters before picking',
    );
    expect(container.querySelector('.dh-skeleton')).not.toBeNull();
  });

  it('shows warm-up progress over placeholder rows, and no picks, during the first wait', () => {
    render({ releaseKey: 'a1', warmup, rows: [row('a2', { kind: 'same-artist' })] });

    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toContain('12 of 20 supporters read · 3 of 5 strong picks');
    expect(status?.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(
      '15',
    );
    expect(container.querySelectorAll('.dh-skeleton__row')).toHaveLength(4);
    expect(container.textContent).not.toContain('More from this artist');
  });

  it('stills the placeholders when the scanner is stopped', () => {
    render({ releaseKey: 'a1', warmup, rows: [] }, listed, true);

    expect(container.textContent).toContain('The scanner is stopped for now');
    expect(container.querySelector('.dh-skeleton--paused')).not.toBeNull();
  });

  it('shows placeholders while the first result loads', () => {
    act(() =>
      root.render(
        <AlsoBoughtList
          view={{ state: 'loading' }}
          progress={listed}
          scanStopped={false}
          firstWaitOver={false}
          actions={{ hide: () => {}, setHeard: () => {} }}
          hideHeard={false}
          onHideHeardChange={() => {}}
        />,
      ),
    );

    expect(container.textContent).toContain('Loading recommendations…');
    expect(container.querySelector('.dh-skeleton')).not.toBeNull();
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
      rows: [row('a3', { kind: 'co-owned', owners: 6, crateMates: 0 })],
    });

    expect(container.querySelector('ul')?.getAttribute('aria-label')).toBe('Also bought');
    expect(container.textContent).toContain('6 supporters have this so far');
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
