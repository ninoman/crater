import { decodeEntities } from './html';
import type { PageDesign } from './types';

const HEX = /^[0-9a-f]{6}$/i;

function hexColor(value: unknown): string | null {
  return typeof value === 'string' && HEX.test(value) ? `#${value.toLowerCase()}` : null;
}

/**
 * Reads the artist's page colours from `#custom-design-rules-style`'s `data-design`, on album,
 * track and band pages. Accepts a whole page or just that element's outerHTML. Null when it's
 * missing or any colour is unreadable: the UI then keeps its default look, which is no worse.
 */
export function parsePageDesign(html: string): PageDesign | null {
  const match = html.match(/id="custom-design-rules-style"[^>]*?\sdata-design="([^"]*)"/);
  if (match?.[1] === undefined) return null;
  let design: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(decodeEntities(match[1]));
    if (typeof parsed !== 'object' || parsed === null) return null;
    design = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  // body_color is the content column the release sits on; bg_color is the page around it.
  const background = hexColor(design.body_color);
  const text = hexColor(design.text_color);
  const secondaryText = hexColor(design.secondary_text_color);
  const link = hexColor(design.link_color);
  if (!background || !text || !secondaryText || !link) return null;
  return { background, text, secondaryText, link };
}
