// All UI CSS as one string, so the same styles go into shadow roots and the popup document.
// Add each new component's stylesheet here.

import badge from './Badge.css?inline';
import base from './base.css?inline';
import button from './Button.css?inline';
import confirmDialog from './ConfirmDialog.css?inline';
import cover from './Cover.css?inline';
import embedFrame from './EmbedFrame.css?inline';
import emptyState from './EmptyState.css?inline';
import field from './Field.css?inline';
import notice from './Notice.css?inline';
import panel from './Panel.css?inline';
import progress from './Progress.css?inline';
import row from './Row.css?inline';
import stat from './Stat.css?inline';
import statusDot from './StatusDot.css?inline';
import tabs from './Tabs.css?inline';
import tokens from './tokens.css?inline';
import tooltip from './Tooltip.css?inline';

export const uiStyles = [
  tokens,
  base,
  button,
  panel,
  tabs,
  emptyState,
  stat,
  statusDot,
  badge,
  cover,
  embedFrame,
  notice,
  progress,
  row,
  tooltip,
  field,
  confirmDialog,
].join('\n');

/** Adds the UI stylesheet to a document or shadow root. */
export function injectStyles(root: Document | ShadowRoot, extra = ''): void {
  const style = document.createElement('style');
  style.textContent = uiStyles + extra;
  (root instanceof Document ? root.head : root).append(style);
}
