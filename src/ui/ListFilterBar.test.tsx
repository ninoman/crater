// @vitest-environment jsdom
// The filter bar: what it shows, and what each control reports.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ListFilters, NO_FILTERS } from '../shared/listFilters';
import { ListFilterBar, type ListFilterBarProps } from './ListFilterBar';

const GENRES = [
  { id: 3, label: 'ambient' },
  { id: 10, label: 'electronic' },
];

let container: HTMLElement;
let root: Root;
let changes: ListFilters[];

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  changes = [];
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

function render(props: Partial<ListFilterBarProps> = {}) {
  act(() =>
    root.render(
      <ListFilterBar
        filters={NO_FILTERS}
        onChange={(next) => changes.push(next)}
        genres={GENRES}
        place=""
        summary={null}
        {...props}
      />,
    ),
  );
}

const button = (name: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(name));

function open() {
  act(() => button('Filters')?.click());
}

describe('ListFilterBar', () => {
  it('shows only the Filters button while nothing is on', () => {
    render();

    expect(button('Filters')?.textContent).toBe('Filters');
    expect(button('Clear filters')).toBeUndefined();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('counts the filters that are on, and says how many picks they hid', () => {
    render({
      filters: { ...NO_FILTERS, genres: [10], physical: true, yearFrom: 2020 },
      summary: { hidden: 7, unjudged: 2, limited: false },
    });

    expect(button('Filters')?.textContent).toBe('Filters · 3');
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "7 hidden by filters · 2 of them couldn't be judged: Dighead hasn't seen that detail yet",
    );
  });

  it('clears every filter at once', () => {
    render({ filters: { ...NO_FILTERS, nameYourPrice: true } });

    act(() => button('Clear filters')?.click());

    expect(changes).toEqual([NO_FILTERS]);
  });

  it('reports a genre picked and unpicked', () => {
    render({ filters: { ...NO_FILTERS, genres: [3] } });
    open();

    const boxes = [...document.querySelectorAll<HTMLElement>('[role="checkbox"]')];
    act(() => boxes[1]?.click());
    act(() => boxes[0]?.click());

    expect(changes).toEqual([
      { ...NO_FILTERS, genres: [3, 10] },
      { ...NO_FILTERS, genres: [] },
    ]);
  });

  it('turns near me off, with the reason, while no place is set', () => {
    render();
    open();

    // The box after the genres.
    const near = [...document.querySelectorAll<HTMLButtonElement>('[role="checkbox"]')][
      GENRES.length
    ];
    expect(near?.disabled).toBe(true);
    expect(document.body.textContent).toContain('Set your place in Dighead');
  });

  it('names the place on near me once it is set, and reports the switch', () => {
    render({ place: 'Leipzig, Germany' });
    open();

    const near = [...document.querySelectorAll<HTMLButtonElement>('[role="checkbox"]')][
      GENRES.length
    ];
    expect(near?.disabled).toBe(false);
    expect(document.body.textContent).toContain('Near me (Leipzig, Germany)');
    act(() => near?.click());

    expect(changes).toEqual([{ ...NO_FILTERS, nearMe: true }]);
  });

  it('reports a year once it is four digits, and an emptied box as no limit', () => {
    const onChange = vi.fn();
    render({ onChange, filters: { ...NO_FILTERS, yearTo: 2024 } });
    open();
    const from = document.querySelector<HTMLInputElement>('input[aria-label="From year"]');
    const to = document.querySelector<HTMLInputElement>('input[aria-label="To year"]');

    type(from, '20');
    type(from, '2019');
    type(to, '');

    expect(to?.value).toBe('');
    expect(onChange.mock.calls).toEqual([
      [{ ...NO_FILTERS, yearFrom: 2019, yearTo: 2024 }],
      [{ ...NO_FILTERS, yearTo: null }],
    ]);
  });
});

/** Types into a controlled input the way a user does: set the value, then fire `input`. */
function type(input: HTMLInputElement | null, value: string) {
  if (!input) throw new Error('no input');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
