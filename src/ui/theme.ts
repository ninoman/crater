// Turns a page's colours into our colour tokens, so injected UI matches an artist's page design.
// Only the colours that follow the page are set; the rest (tags, tooltip, status) keep tokens.css.

import { contrast, mix, withAlpha } from './color';

/** The page colours a theme is built from, as `#rrggbb`. */
export interface PageColors {
  background: string;
  text: string;
  secondaryText: string;
  link: string;
}

/** CSS custom properties, set on a shadow host to override tokens.css. */
export type ThemeVariables = Record<`--dh-${string}`, string>;

const BLACK = '#000000';
const WHITE = '#ffffff';
/** WCAG AA for body text. Below it a design is unreadable for our small text. */
const MIN_TEXT_CONTRAST = 4.5;

/**
 * The tokens for a page design, or null when its text is too faint on its background to use.
 * Shades are mixes of text into background, so they work the same on light and dark pages.
 */
export function themeVariables(colors: PageColors): ThemeVariables | null {
  const { background: bg, text, secondaryText, link } = colors;
  if (contrast(text, bg) < MIN_TEXT_CONTRAST) return null;
  // Secondary text and links can be faint in a design; fall back to text-based shades then.
  const muted =
    contrast(secondaryText, bg) >= MIN_TEXT_CONTRAST ? secondaryText : mix(text, bg, 0.7);
  const accent = contrast(link, bg) >= 3 ? link : text;
  const onAccent = contrast(BLACK, accent) >= contrast(WHITE, accent) ? BLACK : WHITE;
  return {
    '--dh-color-bg': bg,
    '--dh-color-text': text,
    '--dh-color-muted': muted,
    '--dh-color-subtle': mix(muted, bg, 0.7),
    '--dh-color-border': mix(text, bg, 0.15),
    '--dh-color-bg-subtle': mix(text, bg, 0.04),
    '--dh-color-bg-hover': mix(text, bg, 0.08),
    '--dh-color-accent': accent,
    '--dh-color-accent-hover': mix(text, accent, 0.2),
    '--dh-color-on-accent': onAccent,
    '--dh-color-focus': withAlpha(accent, 0.45),
    // Tinted from tokens.css's status colours, which stay as they are.
    '--dh-color-warning-bg': `color-mix(in srgb, var(--dh-color-warning) 12%, ${bg})`,
    '--dh-color-danger-bg': `color-mix(in srgb, var(--dh-color-danger) 12%, ${bg})`,
  };
}
