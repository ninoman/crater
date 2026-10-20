// Your own fan page with Bandcamp's following tab open on artists & labels: me-fan-page.html,
// with its `#following-grid` swapped for the rendered one in me-following-tab.html.
// Needs a DOM: use in tests marked `@vitest-environment jsdom`.

import { fixtureText } from './fixtures';

/**
 * Loads the page into the test's own `document`, so computed styles see our injected CSS.
 * Scripts don't run: markup set through innerHTML never executes them.
 */
export function followingTabDocument(): Document {
  const page = new DOMParser().parseFromString(fixtureText('me-fan-page.html'), 'text/html');
  const doc = document;
  doc.head.innerHTML = page.head.innerHTML;
  doc.body.innerHTML = page.body.innerHTML;
  const rendered = new DOMParser().parseFromString(
    fixtureText('me-following-tab.html'),
    'text/html',
  );
  const grid = rendered.getElementById('following-grid');
  const target = doc.getElementById('following-grid');
  if (!grid || !target) throw new Error('fixtures have no #following-grid');
  target.replaceWith(doc.importNode(grid, true));
  return doc;
}

/** Opens a sub-tab the way Bandcamp's script does: by moving the `active` classes. */
export function openSubTab(
  doc: Document,
  tab: 'following-bands' | 'following-fans' | 'following-genres',
): void {
  for (const item of doc.querySelectorAll('#following-tabs li[data-tab]')) {
    item.classList.toggle('active', item.getAttribute('data-tab') === tab);
  }
  for (const container of doc.querySelectorAll('#following-grid .grid')) {
    container.classList.toggle('active', container.id === `${tab}-container`);
  }
}

/** MutationObserver callbacks run as microtasks; let them. */
export const flushObservers = () => new Promise((resolve) => setTimeout(resolve, 0));
