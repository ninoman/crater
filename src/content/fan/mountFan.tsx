import { FAN_PAGE_DOM, ParserError, parseViewedFanId } from '../../bandcamp';
import { FollowedAccountTags } from '../shared/FollowedAccountTags';
import { pageTagsStyles } from '../shared/tagStyles';
import { mountShadow } from '../shared/mountShadow';
import fanCss from './Fan.css?inline';
import { TwinStandingBadge } from './TwinStandingBadge';

/** Adds the "your #N twin" badge and, for fans you follow, your tags under the name. */
export function mountFan(doc: Document): void {
  const pagedata = doc.getElementById('pagedata');
  const name = doc.querySelector(FAN_PAGE_DOM.name);
  if (!pagedata || !name) return;

  let fanId: number | null;
  try {
    fanId = parseViewedFanId(pagedata.outerHTML);
  } catch (error) {
    if (error instanceof ParserError) {
      console.warn('dighead: cannot tell whose profile this is', error);
      return;
    }
    throw error;
  }
  if (fanId === null) return;
  const fanName = name.querySelector('h1')?.textContent?.trim() || 'this fan';
  mountShadow(
    name,
    <>
      <TwinStandingBadge fanId={fanId} />
      <FollowedAccountTags kind="fan" id={fanId} name={fanName} />
    </>,
    fanCss + pageTagsStyles,
  );
}
