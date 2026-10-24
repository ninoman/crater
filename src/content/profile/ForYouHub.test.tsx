// @vitest-environment jsdom
// For you's sub-tabs: the route picks the open one, and choosing another asks for its route.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalContainerProvider } from '../../ui';
import { ForYouHub, type ForYouRoute } from './ForYouHub';

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  // The views stay loading: the worker never answers.
  vi.stubGlobal('chrome', {
    storage: { local: { get: async () => ({}), set: async () => {} } },
    runtime: {
      sendMessage: () => new Promise(() => {}),
      onMessage: { addListener() {}, removeListener() {} },
    },
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function render(route: ForYouRoute, openRoute: (route: ForYouRoute) => void = () => {}) {
  act(() =>
    root.render(
      <PortalContainerProvider container={host}>
        <ForYouHub route={route} openRoute={openRoute} />
      </PortalContainerProvider>,
    ),
  );
}

const trigger = (label: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
    (tab) => tab.textContent === label,
  );

describe('ForYouHub', () => {
  it('shows the three sub-tabs with the route’s one open', () => {
    render('latest');

    const tabs = [...host.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Picks',
      "Crate mates' latest",
      'New from follows',
    ]);
    expect(trigger("Crate mates' latest")?.getAttribute('aria-selected')).toBe('true');
    // Only the open view is mounted, so the others don't load.
    const filled = [...host.querySelectorAll('[role="tabpanel"]')].filter(
      (panel) => panel.childElementCount > 0,
    );
    expect(filled).toHaveLength(1);
  });

  it('asks for the chosen sub-tab’s route', () => {
    const openRoute = vi.fn();
    render('for-you', openRoute);

    act(() => {
      trigger('New from follows')?.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0 }),
      );
    });

    expect(openRoute).toHaveBeenCalledWith('follows');
  });
});
