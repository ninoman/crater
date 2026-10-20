import { BAND_PAGE_DOM, ParserError, parseBandId } from '../../bandcamp';
import { FollowedAccountTags } from '../shared/FollowedAccountTags';
import { accountTagsStyles } from '../shared/accountTagsStyles';
import { mountShadow } from '../shared/mountShadow';

/** Adds your tags under the band's name on its home page, when you follow the band. */
export function mountBand(doc: Document): void {
  const name = doc.querySelector(BAND_PAGE_DOM.name);
  const tag = doc.querySelector('[data-band]');
  if (!name || !tag) return;

  let bandId: number | null;
  try {
    bandId = parseBandId(tag.outerHTML);
  } catch (error) {
    if (error instanceof ParserError) {
      console.warn('dighead: cannot tell which band this is', error);
      return;
    }
    throw error;
  }
  if (bandId === null) return;

  const bandName = name.querySelector(BAND_PAGE_DOM.title)?.textContent?.trim() || 'this band';
  mountShadow(
    name,
    <FollowedAccountTags kind="band" id={bandId} name={bandName} />,
    accountTagsStyles,
  );
}
