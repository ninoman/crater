import { FAN_PAGE_DOM } from '../../bandcamp';

const FOLLOWING = FAN_PAGE_DOM.followingButtonClass;

function hasFollowing(className: string | null): boolean {
  return (className ?? '').split(/\s+/).includes(FOLLOWING);
}

/**
 * What a class change on a follow button means. Bandcamp's handler toggles `following` on the
 * button after its request succeeds (decisions §8). Other class changes mean nothing.
 */
export function followChange(
  oldClass: string | null,
  newClass: string | null,
): 'followed' | 'unfollowed' | null {
  const was = hasFollowing(oldClass);
  const is = hasFollowing(newClass);
  if (was === is) return null;
  return is ? 'followed' : 'unfollowed';
}
