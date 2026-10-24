// Adds our own tabs (Crate mates, For you) to Bandcamp's tab bar on your profile. The tab handles
// are plain <li>s in Bandcamp's own markup so its CSS styles them natively; what a tab shows is
// rendered by React in a shadow root inside `contentSlot`. A tab can own more than one hash
// (routes), e.g. For you's sub-tabs, so each keeps its own address.

import { FAN_PAGE_DOM } from '../../bandcamp';
import { tabFromHash, withoutHash } from './hash';

export interface ProfileTabSpec<Route extends string> {
  /** The tab's own hash, where its link points. */
  id: Route;
  /** Lowercase, like Bandcamp's own tab titles. */
  label: string;
  /** Other hashes that open this tab, e.g. its sub-tabs. */
  routes?: readonly Route[];
}

/** Which of our routes is open, as an external store for useSyncExternalStore. */
export interface ProfileTabs<Route extends string> {
  /** Where the open tab's content goes: right under Bandcamp's tab bar. */
  contentSlot: HTMLElement;
  getActive: () => Route | null;
  subscribe: (listener: () => void) => () => void;
}

const OPEN_CLASS = 'dighead-tab-open';
const TAB_CLASS = 'dighead-tab';
const SLOT_CLASS = 'dighead-tab-content';
const STYLE_ID = 'dighead-profile-tabs';
/** The tab list's width, so tab content lines up with it at every Bandcamp breakpoint. */
const WIDTH_VAR = '--dighead-tabs-width';

/**
 * While one of our tabs is open, Bandcamp's grids and their controls are hidden. Our tab link
 * takes the colour of Bandcamp's tab titles instead of the page's link colour, and our content
 * is centred at the tab list's width, as the tab list is.
 */
function pageCss(): string {
  const { grids, tabList, tabContents } = FAN_PAGE_DOM;
  const hidden = tabContents.map((selector) => `${grids}.${OPEN_CLASS} ${selector}`).join(',\n');
  return `${hidden} { display: none !important; }
${tabList} .${TAB_CLASS} a { color: inherit; text-decoration: none; }
.${SLOT_CLASS} { width: var(${WIDTH_VAR}, auto); margin: 0 auto; }`;
}

function addPageStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = pageCss();
  doc.head.append(style);
}

/** A tab in Bandcamp's markup. A real link, so it's keyboard reachable and sets the hash itself. */
function createTab(doc: Document, { id, label }: ProfileTabSpec<string>): HTMLLIElement {
  const item = doc.createElement('li');
  item.className = TAB_CLASS;
  const link = doc.createElement('a');
  link.className = 'tab-title';
  link.href = `#${id}`;
  link.textContent = label;
  item.append(link);
  item.addEventListener('click', (event) => {
    // Bandcamp's own tab switching must never see clicks on ours.
    event.stopImmediatePropagation();
    // Bandcamp pads the <li> and gives it a pointer, so the whole tab looks clickable, not
    // just the link's text.
    if (event.target instanceof Node && !link.contains(event.target)) link.click();
  });
  return item;
}

function findTabBar(doc: Document): { grids: Element; list: Element; bar: Element } | null {
  const grids = doc.querySelector(FAN_PAGE_DOM.grids);
  const list = grids?.querySelector(FAN_PAGE_DOM.tabList);
  const bar = grids?.querySelector(FAN_PAGE_DOM.tabBar);
  return grids && list && bar ? { grids, list, bar } : null;
}

/** The routes a tab answers to: its own id, then its other routes. */
export function routesOf<Route extends string>(spec: ProfileTabSpec<Route>): readonly Route[] {
  return [spec.id, ...(spec.routes ?? [])];
}

/**
 * Injects `specs` after Bandcamp's tabs and keeps the open route in sync with the URL hash.
 * Returns null, with a warning, when the fan page's markup isn't what we expect.
 */
export function injectProfileTabs<Route extends string>(
  doc: Document,
  specs: readonly ProfileTabSpec<Route>[],
): ProfileTabs<Route> | null {
  const page = findTabBar(doc);
  if (!page) {
    console.warn('dighead: fan page tabs not found; Bandcamp may have changed its layout');
    return null;
  }
  const { grids, list, bar } = page;

  addPageStyle(doc);
  const ids = specs.flatMap(routesOf);
  const tabs = specs.map((spec) => ({ routes: routesOf(spec), item: createTab(doc, spec) }));
  list.append(...tabs.map((tab) => tab.item));
  const contentSlot = doc.createElement('div');
  contentSlot.className = SLOT_CLASS;
  bar.after(contentSlot);
  new ResizeObserver(() => {
    contentSlot.style.setProperty(WIDTH_VAR, `${list.getBoundingClientRect().width}px`);
  }).observe(list);

  const { activeTabClass } = FAN_PAGE_DOM;
  const listeners = new Set<() => void>();
  let active: Route | null = null;
  /** Bandcamp's tab that was selected before ours opened, to hand the underline back to. */
  let bandcampTab: Element | null = null;

  function setActive(next: Route | null): void {
    if (next === active) return;
    if (active === null) {
      bandcampTab = list.querySelector(`${FAN_PAGE_DOM.tab}.${activeTabClass}`);
      bandcampTab?.classList.remove(activeTabClass);
    } else if (next === null) {
      bandcampTab?.classList.add(activeTabClass);
      bandcampTab = null;
    }
    active = next;
    for (const { routes, item } of tabs) {
      const open = next !== null && routes.includes(next);
      item.classList.toggle(activeTabClass, open);
      item.firstElementChild?.toggleAttribute('aria-current', open);
    }
    grids.classList.toggle(OPEN_CLASS, next !== null);
    for (const listener of listeners) listener();
  }

  const view = doc.defaultView;
  view?.addEventListener('hashchange', () => setActive(tabFromHash(view.location.hash, ids)));

  // Leaving ours for one of Bandcamp's tabs: drop the hash (no history entry), then let
  // Bandcamp switch as usual. Capture phase, so this runs before Bandcamp's own handler.
  list.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (active === null || !target?.closest(FAN_PAGE_DOM.tab) || !view) return;
      view.history.replaceState(view.history.state, '', withoutHash(view.location.href));
      setActive(null);
    },
    { capture: true },
  );

  setActive(view ? tabFromHash(view.location.hash, ids) : null);

  return {
    contentSlot,
    getActive: () => active,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
