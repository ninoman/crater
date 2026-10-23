import { BAND_PAGE_DOM, ParserError, parseBandId, readBandHeader } from '../../bandcamp';
import { FollowedAccountTags } from '../shared/FollowedAccountTags';
import { FollowRecorder } from '../shared/TagPrompt';
import { pageTagsStyles } from '../shared/tagStyles';
import { mountShadow } from '../shared/mountShadow';

/**
 * Adds your tags under the band's name on its home page, when you follow the band, and saves a
 * follow made here.
 */
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

  const header = readBandHeader(doc);
  const bandName = header?.name ?? 'this band';
  const account = {
    kind: 'band' as const,
    id: bandId,
    name: bandName,
    url: location.origin,
    imageId: null,
    location: header?.location ?? null,
  };
  mountShadow(
    name,
    <>
      <FollowedAccountTags kind="band" id={bandId} name={bandName} />
      <FollowRecorder account={account} />
    </>,
    pageTagsStyles,
  );
}
