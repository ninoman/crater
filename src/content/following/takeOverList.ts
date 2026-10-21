// Puts our list of followings in place of Bandcamp's paged one, inside its sub-tab container.
// Ours goes before Bandcamp's in document order: its band handler finds a follow button by id,
// and a hidden duplicate in Bandcamp's list must not win (decisions §8).

import { FAN_PAGE_DOM } from '../../bandcamp';
import type { FollowKind } from '../../shared/following';
import { createShadowSlot, type ShadowSlot } from '../shared/shadowSlot';
import { followingCss } from './followingStyles';

/** Our classes in Bandcamp's light DOM. Cards use the last three. */
export const FOLLOWING_CLASSES = {
  list: 'dighead-following-list',
  /** On every card we build, so any other card in our list stands out. */
  card: 'dighead-following-card',
  /** On the sub-tab container while Bandcamp's own list is hidden. */
  taken: 'dighead-following-taken',
  unfollowed: 'dighead-unfollowed',
} as const;

const STYLE_ID = 'dighead-following';

/**
 * Bandcamp's list and "view all" go while ours is up, so its paging never runs. Bandcamp's CSS
 * may give cards a display, so `hidden` needs the push. An unfollowed card is dimmed; its
 * button then reads "Follow". The avatar is the containing block for our select box. Bandcamp's
 * paging can still append a page of its own cards to the first `ol.followeer-grid` it finds,
 * which is ours; those stay hidden.
 */
function pageCss(): string {
  const { followingNativeList, followingExpand, followingCard, followingImage } = FAN_PAGE_DOM;
  const { list, card, taken, unfollowed } = FOLLOWING_CLASSES;
  return `.${taken} ${followingNativeList}:not(.${list}),
.${taken} ${followingExpand} { display: none !important; }
.${list} ${followingCard}[hidden],
.${list} > ${followingCard}:not(.${card}) { display: none !important; }
.${list} ${followingCard}.${unfollowed} { opacity: 0.5; }
.${list} ${followingImage} { position: relative; }
dighead-following-bar { display: block; }`;
}

function addPageStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = pageCss();
  doc.head.append(style);
}

export interface TakenList {
  kind: FollowKind;
  /** Our `ol.followeer-grid`; cards go in here. */
  list: HTMLOListElement;
  /** The filter bar's shadow root, right above the list. */
  bar: ShadowSlot;
  /** Shows Bandcamp's own list (and hides nothing of ours) when ours can't stand in for it. */
  showBandcampList: (shown: boolean) => void;
}

/** Null, with a warning, when the sub-tab's container isn't where we expect. */
export function takeOverList(doc: Document, grid: Element, kind: FollowKind): TakenList | null {
  const container = grid.querySelector(FAN_PAGE_DOM.followingContainers[kind]);
  if (!container) {
    console.warn(`dighead: following ${kind} list not found; Bandcamp may have changed its layout`);
    return null;
  }
  addPageStyle(doc);

  const list = doc.createElement('ol');
  list.className = `${FAN_PAGE_DOM.followingListClass} ${FOLLOWING_CLASSES.list}`;
  const bar = createShadowSlot(doc, 'dighead-following-bar', followingCss);
  const native = container.querySelector(FAN_PAGE_DOM.followingNativeList);
  if (native) native.before(bar.host, list);
  else container.append(bar.host, list);
  container.classList.add(FOLLOWING_CLASSES.taken);

  return {
    kind,
    list,
    bar,
    showBandcampList: (shown) => container.classList.toggle(FOLLOWING_CLASSES.taken, !shown),
  };
}
