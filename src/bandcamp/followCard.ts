// Builds a following-tab card in Bandcamp's own markup (fixture: me-following-tab.html).
// Bandcamp's delegated handler on `#fan-container .followeer .follow-unfollow` runs the follow
// button, so the ids and data attributes below are load-bearing (decisions §8).

import { followingImageUrl } from './requests';
import type { FollowingRow } from './types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

const BUTTON_BODY = `<span class="plus">
    <svg class="icon follow-plus" width="10px" height="10px" viewBox="0 0 8 8"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#follow-plus"></use></svg>
</span>
<span class="checkmark">
    <svg class="icon following-checkmark" width="14px" height="12px" viewBox="0 0 14 10"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#following-checkmark"></use></svg>
</span>
<div class="follow-msg">Follow</div>
<div class="following-msg">Following</div>
<div class="unfollow-msg">Unfollow</div>`;

function button(row: FollowingRow): string {
  return row.kind === 'band'
    ? `<button id="follow-unfollow-band_${row.id}" data-band-id="${row.id}" data-band-name="${escapeHtml(row.name)}" tabindex="0" class="follow-unfollow following">${BUTTON_BODY}</button>`
    : `<button id="follow-unfollow_${row.id}" tabindex="0" class="follow-unfollow following" data-fan-id="${row.id}" data-view="following_fans">${BUTTON_BODY}</button>`;
}

/** The card as an HTML string; a content script can set it with `innerHTML` on a template. */
export function followCardHtml(row: FollowingRow): string {
  const url = escapeHtml(row.url);
  const image = row.imageId === null ? '' : `<img src="${followingImageUrl(row.imageId)}">`;
  const itemId = row.kind === 'band' ? ` id="follow-grid-item-band_${row.id}"` : '';
  return `<li${itemId} class="followeer followeer-item-container following">
<div class="fan-image"><a href="${url}">${image}</a></div>
<div class="fan-info"><div class="fan-info-inner"><a href="${url}" class="fan-username">${escapeHtml(row.name)}</a><div class="fan-location">${escapeHtml(row.location ?? '')}</div></div>
<div class="follow-unfollow-container">${button(row)}</div></div>
</li>`;
}
