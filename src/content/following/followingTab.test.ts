// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { flushObservers, followingTabDocument, openSubTab } from '../../../tests/followingTabDom';
import { openFollowingKind, watchFollowingTab } from './followingTab';
import { FOLLOWING_CLASSES } from './takeOverList';

let doc: Document;
let grid: Element;

beforeEach(() => {
  doc = followingTabDocument();
  const found = doc.getElementById('following-grid');
  if (!found) throw new Error('no grid');
  grid = found;
});

const container = (kind: 'bands' | 'fans') => doc.getElementById(`following-${kind}-container`);
const nativeList = (kind: 'bands' | 'fans') =>
  container(kind)?.querySelector(`ol.followeer-grid:not(.${FOLLOWING_CLASSES.list})`);
const ourList = (kind: 'bands' | 'fans') =>
  container(kind)?.querySelector(`ol.${FOLLOWING_CLASSES.list}`);
const display = (element: Element | null | undefined) =>
  element ? doc.defaultView?.getComputedStyle(element).display : undefined;

describe('openFollowingKind', () => {
  it('reads the open sub-tab from the active classes', () => {
    expect(openFollowingKind(grid)).toBe('band');
    openSubTab(doc, 'following-fans');
    expect(openFollowingKind(grid)).toBe('fan');
  });

  it('is null on the genres sub-tab and while the following tab is closed', () => {
    openSubTab(doc, 'following-genres');
    expect(openFollowingKind(grid)).toBeNull();
    openSubTab(doc, 'following-bands');
    grid.classList.remove('active');
    expect(openFollowingKind(grid)).toBeNull();
  });
});

describe('watchFollowingTab', () => {
  it('puts our list and filter bar before Bandcamp’s list', () => {
    const tab = watchFollowingTab(doc, grid);
    const [taken] = tab.getState().lists;

    expect(tab.getState().open).toBe('band');
    expect(taken?.list).toBe(ourList('bands'));
    expect(taken?.list.classList.contains('followeer-grid')).toBe(true);
    expect(taken?.bar.host.nextElementSibling).toBe(taken?.list);
    const native = nativeList('bands');
    if (!taken || !native) throw new Error('missing a list');
    expect(taken.list.compareDocumentPosition(native) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('hides Bandcamp’s list and "view all" only in the sub-tabs it has taken over', async () => {
    const tab = watchFollowingTab(doc, grid);
    expect(display(nativeList('bands'))).toBe('none');
    expect(display(container('bands')?.querySelector('.expand-container'))).toBe('none');
    expect(display(ourList('bands'))).not.toBe('none');
    // Fans hasn't been opened, so it's still Bandcamp's.
    expect(ourList('fans')).toBeNull();
    expect(display(nativeList('fans'))).not.toBe('none');

    openSubTab(doc, 'following-fans');
    await flushObservers();
    expect(tab.getState().open).toBe('fan');
    expect(tab.getState().lists.map((list) => list.kind)).toEqual(['band', 'fan']);
    expect(display(nativeList('fans'))).toBe('none');
    expect(display(container('fans')?.querySelector('.expand-container'))).toBe('none');

    openSubTab(doc, 'following-genres');
    await flushObservers();
    expect(tab.getState().open).toBeNull();
    expect(tab.getState().lists).toHaveLength(2);
    expect(
      doc.querySelectorAll(`#following-genres-container .${FOLLOWING_CLASSES.list}`),
    ).toHaveLength(0);
  });

  it('gives Bandcamp’s list back when ours can’t stand in', () => {
    const [taken] = watchFollowingTab(doc, grid).getState().lists;
    taken?.showBandcampList(true);
    expect(display(nativeList('bands'))).not.toBe('none');
    taken?.showBandcampList(false);
    expect(display(nativeList('bands'))).toBe('none');
  });

  it('notifies on sub-tab switches and takes each list over once', async () => {
    const tab = watchFollowingTab(doc, grid);
    let calls = 0;
    tab.subscribe(() => calls++);

    openSubTab(doc, 'following-fans');
    await flushObservers();
    openSubTab(doc, 'following-bands');
    await flushObservers();

    expect(calls).toBe(2);
    expect(doc.querySelectorAll(`.${FOLLOWING_CLASSES.list}`)).toHaveLength(2);
  });
});
