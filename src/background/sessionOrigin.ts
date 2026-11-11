// Bandcamp refuses a wishlist or cart POST whose Origin is the extension's ("custom domain host
// does not match any existing bands"), and fetch can't set Origin. A session rule sets it, for
// this extension's own requests only: they come from no tab.

import { SESSION_POST_ORIGIN, SESSION_POST_REGEX } from '../bandcamp';

const RULE_ID = 1;

/** Idempotent; session rules last until the browser closes, so call it before each POST. */
export async function ensureSessionOrigin(): Promise<void> {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [RULE_ID],
    addRules: [
      {
        id: RULE_ID,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'Origin', operation: 'set', value: SESSION_POST_ORIGIN },
            { header: 'Referer', operation: 'set', value: `${SESSION_POST_ORIGIN}/` },
          ],
        },
        condition: {
          regexFilter: SESSION_POST_REGEX,
          requestMethods: ['post'],
          tabIds: [chrome.tabs.TAB_ID_NONE],
        },
      },
    ],
  });
}
