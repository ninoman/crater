import { describe, expect, it } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('writes amounts with their currency symbol', () => {
    expect(formatMoney(15, 'USD')).toBe('$15.00');
    expect(formatMoney(16.5, 'EUR')).toBe('€16.50');
    expect(formatMoney(2000, 'JPY')).toBe('¥2,000');
  });

  it('falls back to the code for a currency the browser rejects', () => {
    expect(formatMoney(3, 'not a code')).toBe('not a code 3.00');
  });
});
