// The text lines under a card's title: who, when, what it costs and who owns it (decisions §24).

import type { ListedItem, ListSource } from '../../shared/itemList';
import { formatMoney } from '../../shared/money';

// Day first, as Bandcamp writes dates ("19 Oct 2026").
const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "added 3 Oct 2026" or "bought 3 Oct 2026", or null when Bandcamp didn't say when. */
export function addedText(addedAt: number | null, source: ListSource): string | null {
  if (addedAt === null) return null;
  return `${source === 'wishlist' ? 'added' : 'bought'} ${DATE.format(addedAt)}`;
}

/** "$15.00", with the running total on the shortlist and a warning when it can't be bought. */
export function priceText(item: ListedItem, running: number | undefined): string | null {
  const { price } = item;
  if (!price) return null;
  const parts = [formatMoney(price.amount, price.currency)];
  if (running !== undefined) parts.push(`running ${formatMoney(running, price.currency)}`);
  if (!price.purchasable) parts.push('not for sale');
  return parts.join(' · ');
}

/** "owned by 3 of your crate mates", or null when none own it. */
export function crateMatesText(owners: number): string | null {
  if (owners === 0) return null;
  return owners === 1 ? 'owned by a crate mate' : `owned by ${owners} of your crate mates`;
}

/** Every line under the title, in order. */
export function cardMeta(
  item: ListedItem,
  source: ListSource,
  running: number | undefined,
): string[] {
  const lines = [
    item.label ? `${item.artist} · ${item.label}` : item.artist,
    addedText(item.addedAt, source),
    priceText(item, running),
    crateMatesText(item.crateMateOwners),
  ];
  return lines.filter((line): line is string => line !== null);
}
