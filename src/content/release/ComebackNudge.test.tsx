// @vitest-environment jsdom
// The collapsed sidebar's comeback callout.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComebackNudge } from './ComebackNudge';

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

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((b) => b.textContent === label);
  if (!found) throw new Error(`No ${label} button`);
  return found;
}

describe('ComebackNudge', () => {
  it('says how many picks there are, politely', () => {
    act(() => root.render(<ComebackNudge picks={12} onOpen={() => {}} onDismiss={() => {}} />));
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      '12 strong picks for this release. Have a look?',
    );
  });

  it('opens with Open and steps aside with Not now', () => {
    const onOpen = vi.fn();
    const onDismiss = vi.fn();
    act(() => root.render(<ComebackNudge picks={7} onOpen={onOpen} onDismiss={onDismiss} />));

    act(() => button('Open').click());
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => button('Not now').click());
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('makes Open the primary action', () => {
    act(() => root.render(<ComebackNudge picks={5} onOpen={() => {}} onDismiss={() => {}} />));
    expect(button('Open').classList).toContain('dh-button--primary');
    expect(button('Not now').classList).not.toContain('dh-button--primary');
  });
});
