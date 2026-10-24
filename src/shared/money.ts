/** "$15.00", "€16.00" or "¥2,000"; the bare code and amount for a currency the browser doesn't know. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
