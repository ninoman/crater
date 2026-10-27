// @vitest-environment jsdom
// Our tabs in Bandcamp's tab bar: opening them from anywhere on the tab, and handing back.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { injectProfileTabs } from './profileTabs';

const SPECS = [
  { id: 'crate-mates', label: 'crate mates' },
  { id: 'for-you', label: 'for you', routes: ['latest', 'follows'] },
] as const;

function tabBar(): string {
  return `<div id="grids">
    <div class="grid-tabs-anchor">
      <ol id="grid-tabs" class="tabs">
        <li data-tab="collection" class="active"><span class="tab-title">collection</span></li>
        <li data-tab="wishlist"><span class="tab-title">wishlist</span></li>
      </ol>
    </div>
  </div>`;
}

function ourTab(id: string): HTMLLIElement {
  const link = document.querySelector(`.crater-tab a[href="#${id}"]`);
  if (!(link?.parentElement instanceof HTMLLIElement)) throw new Error(`no tab ${id}`);
  return link.parentElement;
}

function hashChanged(): Promise<void> {
  return new Promise((resolve) =>
    window.addEventListener('hashchange', () => resolve(), { once: true }),
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
    },
  );
  history.replaceState(null, '', '/');
  document.body.innerHTML = tabBar();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('injectProfileTabs', () => {
  it('opens a tab clicked on its padding, not just its text', async () => {
    const tabs = injectProfileTabs(document, SPECS);
    const changed = hashChanged();
    ourTab('for-you').click();
    await changed;
    expect(tabs?.getActive()).toBe('for-you');
  });

  it('switches between our tabs and back to Bandcamp’s', async () => {
    const tabs = injectProfileTabs(document, SPECS);
    let changed = hashChanged();
    ourTab('crate-mates').click();
    await changed;
    changed = hashChanged();
    ourTab('for-you').click();
    await changed;
    expect(tabs?.getActive()).toBe('for-you');

    document.querySelector<HTMLElement>('li[data-tab="wishlist"]')?.click();
    expect(tabs?.getActive()).toBeNull();
    expect(location.hash).toBe('');
    expect(document.querySelector('li[data-tab="collection"]')?.classList).toContain('active');
  });

  it('injects one tab per spec, whatever routes it owns', () => {
    injectProfileTabs(document, SPECS);
    expect(document.querySelectorAll('.crater-tab')).toHaveLength(2);
  });

  it('marks a tab open for any of its routes', () => {
    history.replaceState(null, '', '/#follows');
    const tabs = injectProfileTabs(document, SPECS);

    expect(tabs?.getActive()).toBe('follows');
    expect(ourTab('for-you').classList).toContain('active');
    expect(ourTab('crate-mates').classList).not.toContain('active');
    expect(document.querySelector('li[data-tab="collection"]')?.classList).not.toContain('active');
  });

  it('follows a switch between routes of the same tab', async () => {
    history.replaceState(null, '', '/#for-you');
    const tabs = injectProfileTabs(document, SPECS);
    const changed = hashChanged();
    location.hash = 'latest';
    await changed;

    expect(tabs?.getActive()).toBe('latest');
    expect(ourTab('for-you').classList).toContain('active');
  });
});
