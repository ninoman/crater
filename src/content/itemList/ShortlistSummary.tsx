import { formatMoney } from '../../shared/money';
import type { CurrencyTotal } from '../../shared/shortlist';

/** What the shortlist adds up to, one total per currency since Dighead has no exchange rates. */
export function ShortlistSummary({
  count,
  totals,
}: {
  count: number;
  totals: readonly CurrencyTotal[];
}) {
  return (
    <p className="dh-tag-bar__note" aria-live="polite">
      {count === 1 ? '1 release you can buy' : `${count} releases you can buy`}
      {totals.length > 0 && ': '}
      {totals.map((total, i) => (
        <span key={total.currency}>
          {i > 0 && ' + '}
          <strong>{formatMoney(total.amount, total.currency)}</strong>
        </span>
      ))}
      . Ordered by buy next: your rating first, then crate mates who own it. Dighead doesn’t touch
      your cart; open a release to buy it.
    </p>
  );
}
