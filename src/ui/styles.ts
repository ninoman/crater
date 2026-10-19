// All UI CSS as one string, so the same styles go into shadow roots and the popup document.
// Add each new component's stylesheet here.

import base from './base.css?inline';
import button from './Button.css?inline';
import emptyState from './EmptyState.css?inline';
import panel from './Panel.css?inline';
import stat from './Stat.css?inline';
import statusDot from './StatusDot.css?inline';
import tabs from './Tabs.css?inline';
import tokens from './tokens.css?inline';

export const uiStyles = [tokens, base, button, panel, tabs, emptyState, stat, statusDot].join('\n');

/** Adds the UI stylesheet to a document or shadow root. */
export function injectStyles(root: Document | ShadowRoot, extra = ''): void {
  const style = document.createElement('style');
  style.textContent = uiStyles + extra;
  (root instanceof Document ? root.head : root).append(style);
}
