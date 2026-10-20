import { FAN_PAGE_DOM, ParserError, parseViewedFanId } from '../../bandcamp';
import { mountShadow } from '../shared/mountShadow';
import fanCss from './Fan.css?inline';
import { TwinStandingBadge } from './TwinStandingBadge';

/** Adds the "your #N twin" badge under the name on another fan's profile. */
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
  if (fanId !== null) mountShadow(name, <TwinStandingBadge fanId={fanId} />, fanCss);
}
