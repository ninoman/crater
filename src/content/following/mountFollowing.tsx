import { FAN_PAGE_DOM } from '../../bandcamp';
import { mountShadow } from '../shared/mountShadow';
import { FollowingApp } from './FollowingApp';
import { watchFollowingTab } from './followingTab';
import { followingCss } from './followingStyles';

/**
 * Takes over Bandcamp's following tab on your own page: every follow as a Bandcamp card, with
 * tags, a filter bar and bulk tagging (decisions §8). The root itself renders nothing visible.
 */
export function mountFollowing(doc: Document): void {
  const grid = doc.querySelector(FAN_PAGE_DOM.followingGrid);
  if (!grid) {
    console.warn('crater: following tab not found; Bandcamp may have changed its layout');
    return;
  }
  mountShadow(grid, <FollowingApp tab={watchFollowingTab(doc, grid)} />, followingCss);
}
