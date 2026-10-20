import { injectStyles } from '../../ui';

/** A light-DOM host with a shadow root, and the styled container inside it that UI renders into. */
export interface ShadowSlot {
  host: HTMLElement;
  /** Carries `dh-root`, which the shared styles scope to. Also the portal container. */
  container: HTMLElement;
}

/**
 * Creates a host element (not yet in the page) whose shadow root holds our styles, so page CSS
 * can't leak in. `extraCss` is feature styling added after the shared UI styles.
 */
export function createShadowSlot(doc: Document, tagName: string, extraCss = ''): ShadowSlot {
  const host = doc.createElement(tagName);
  const shadow = host.attachShadow({ mode: 'open' });
  injectStyles(shadow, extraCss);
  const container = doc.createElement('div');
  container.className = 'dh-root';
  shadow.append(container);
  return { host, container };
}
