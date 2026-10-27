import { FAN_PAGE_DOM, fanProfileUrl, ParserError, parseViewedFanId } from '../../bandcamp';
import { FollowedAccountTags } from '../shared/FollowedAccountTags';
import { FollowRecorder } from '../shared/TagPrompt';
import { pageTagsStyles } from '../shared/tagStyles';
import { mountShadow } from '../shared/mountShadow';
import fanCss from './Fan.css?inline';
import { CrateMateStandingBadge } from './CrateMateStandingBadge';

/**
 * Adds the "your #N crate mate" badge and, for fans you follow, your tags under the name. A
 * follow made here is saved at once.
 */
export function mountFan(doc: Document): void {
  const pagedata = doc.getElementById('pagedata');
  const name = doc.querySelector(FAN_PAGE_DOM.name);
  if (!pagedata || !name) return;

  let fanId: number | null;
  try {
    fanId = parseViewedFanId(pagedata.outerHTML);
  } catch (error) {
    if (error instanceof ParserError) {
      console.warn('crater: cannot tell whose profile this is', error);
      return;
    }
    throw error;
  }
  if (fanId === null) return;
  const fanName = name.querySelector('h1')?.textContent?.trim() || 'this fan';
  const account = {
    kind: 'fan' as const,
    id: fanId,
    name: fanName,
    url: fanProfileUrl(location.href),
    imageId: null,
    location: null,
  };
  mountShadow(
    name,
    <>
      <CrateMateStandingBadge fanId={fanId} />
      <FollowedAccountTags kind="fan" id={fanId} name={fanName} />
      <FollowRecorder account={account} />
    </>,
    fanCss + pageTagsStyles,
  );
}
