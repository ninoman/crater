import { parsePageDesign } from '../../bandcamp';
import { type ThemeVariables, themeVariables } from '../../ui';

/** Tokens that match the artist's page colours, or null to keep our default look. */
export function pageTheme(doc: Document): ThemeVariables | null {
  const style = doc.getElementById('custom-design-rules-style');
  const design = style && parsePageDesign(style.outerHTML);
  return design ? themeVariables(design) : null;
}
