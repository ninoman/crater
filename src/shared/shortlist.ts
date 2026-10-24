// The Bandcamp Friday shortlist: wishlist releases you can buy, in "buy next" order, with what
// they add up to (decisions §22). Read-only: nothing here touches a cart.

import type { ItemKey } from '../bandcamp';
import type { ListedItem } from './itemList';
import { sortItems } from './itemSort';

/** What a currency's items add up to. */
export interface CurrencyTotal {
  currency: string;
  amount: number;
  count: number;
}

/** Purchasable items, best to buy first. */
export function shortlist(items: readonly ListedItem[]): ListedItem[] {
  return sortItems(
    items.filter((item) => item.price?.purchasable),
    { key: 'buyNext', direction: 'desc' },
  );
}

// Cents, so 0.1 + 0.2 reads 0.3. Currencies without minor units lose nothing.
const add = (sum: number, amount: number) => Math.round((sum + amount) * 100) / 100;

/**
 * Totals per currency, since Dighead has no exchange rates (decisions §22). The currency with
 * the most items comes first.
 */
export function totalsByCurrency(items: readonly ListedItem[]): CurrencyTotal[] {
  const totals = new Map<string, CurrencyTotal>();
  for (const { price } of items) {
    if (!price) continue;
    const total = totals.get(price.currency) ?? { currency: price.currency, amount: 0, count: 0 };
    totals.set(price.currency, {
      currency: price.currency,
      amount: add(total.amount, price.amount),
      count: total.count + 1,
    });
  }
  return [...totals.values()].sort(
    (a, b) => b.count - a.count || a.currency.localeCompare(b.currency),
  );
}

/** Each item's cumulative total in its own currency, in list order. */
export function runningTotals(items: readonly ListedItem[]): Map<ItemKey, number> {
  const sums = new Map<string, number>();
  const running = new Map<ItemKey, number>();
  for (const { itemKey, price } of items) {
    if (!price) continue;
    const sum = add(sums.get(price.currency) ?? 0, price.amount);
    sums.set(price.currency, sum);
    running.set(itemKey, sum);
  }
  return running;
}
