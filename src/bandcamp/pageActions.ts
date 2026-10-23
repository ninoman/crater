// Reads whether you've wishlisted or followed what this page is about, from Bandcamp's own
// controls (decisions §21). Null means the control isn't there or isn't rendered yet.

import { BAND_PAGE_DOM } from './bandPageDom';
import { PAGE_ACTIONS_DOM as DOM } from './pageActionsDom';

/** One of Bandcamp's controls: the element to point at, and whether it's on. */
export interface PageAction {
  button: (doc: ParentNode) => Element | null;
  isOn: (doc: ParentNode) => boolean | null;
}

/** The heart on a release page. */
export const WISHLIST_ACTION: PageAction = {
  button: (doc) => doc.querySelector(DOM.heart),
  isOn: (doc) => {
    const heart = doc.querySelector(DOM.heart);
    if (heart?.classList.contains(DOM.heartOn)) return true;
    if (heart?.classList.contains(DOM.heartOff)) return false;
    // Not rendered yet, or neither: you own it.
    return null;
  },
};

/** The follow button on a band, release or fan page. */
export const FOLLOW_ACTION: PageAction = {
  button: (doc) => doc.querySelector(`${DOM.followArea} ${DOM.followButton}`),
  isOn: (doc) => {
    const button = FOLLOW_ACTION.button(doc);
    if (!button) return null;
    if (DOM.followOn.some((name) => button.classList.contains(name))) return true;
    // The server-rendered placeholder has no id; reading it as "not following" would turn
    // Bandcamp's first render into a fake follow.
    return button.id ? false : null;
  },
};

/** What a state change means. Changes from or to "not there" mean nothing. */
export function actionChange(before: boolean | null, after: boolean | null): 'on' | 'off' | null {
  if (before === null || after === null || before === after) return null;
  return after ? 'on' : 'off';
}

/** The band's name and location from the block on its home and release pages. */
export function readBandHeader(doc: ParentNode): { name: string; location: string | null } | null {
  const block = doc.querySelector(BAND_PAGE_DOM.name);
  const name = block?.querySelector(BAND_PAGE_DOM.title)?.textContent?.trim();
  if (!block || !name) return null;
  const location = block.querySelector(BAND_PAGE_DOM.location)?.textContent?.trim();
  return { name, location: location || null };
}

/** A fan's profile URL from any page of theirs: bandcamp.com/<username>. */
export function fanProfileUrl(pageUrl: string): string {
  const url = new URL(pageUrl);
  const username = url.pathname.split('/')[1] ?? '';
  return `${url.origin}/${username}`;
}
