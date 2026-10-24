// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReleaseRow, type ReleaseRowProps } from './ReleaseRow';

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

function render(props: Partial<ReleaseRowProps> = {}) {
  const all: ReleaseRowProps = {
    release: {
      title: 'Title',
      artist: 'Artist',
      label: null,
      url: 'https://artist.bandcamp.com/album/title',
      coverUrl: null,
    },
    reason: 'Owned by 3 of your top crate mates',
    previewing: false,
    preview: null,
    onPreview: () => {},
    heard: false,
    onHeardChange: () => {},
    hideScopes: { band: 'Artist', label: null },
    onHide: () => {},
    ...props,
  };
  act(() => root.render(<ReleaseRow {...all} />));
}

const button = (label: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

describe('ReleaseRow', () => {
  it('badges a heard release, dims its cover and offers to unmark it', () => {
    const onHeardChange = vi.fn();
    render({ heard: true, onHeardChange });

    expect(container.textContent).toContain('Heard');
    expect(container.querySelector('.dh-cover--dimmed')).not.toBeNull();
    const toggle = button('Heard Artist – Title');
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
    act(() => toggle?.click());
    expect(onHeardChange).toHaveBeenCalledWith(false);
  });

  it('shows no badge and a full cover until heard', () => {
    render();

    expect(container.querySelector('.dh-heard-badge')).toBeNull();
    expect(container.querySelector('.dh-cover--dimmed')).toBeNull();
  });

  it('opens a hide menu with the scopes the row knows, and hides the one picked', () => {
    const onHide = vi.fn();
    render({ onHide });

    const trigger = button('Hide Artist – Title from recommendations');
    act(() => {
      trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    expect(items.map((item) => item.textContent)).toEqual(['This release', 'Everything by Artist']);

    act(() => items[1]?.click());
    expect(onHide).toHaveBeenCalledWith('band');
  });
});
