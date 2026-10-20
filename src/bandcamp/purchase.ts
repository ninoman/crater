// Checkout 303s to `bandcamp.com/download?cart_id=…&sig=…&from=checkout`, and the page drops
// `from` from the address bar by the time content scripts run, so `cart_id` is the signal.
// Re-downloads from your collection use the same path with `payment_id` and no `cart_id`.
// See tests/fixtures/purchase-confirmation.html.
export function isPurchaseConfirmationUrl(url: URL): boolean {
  return (
    url.hostname === 'bandcamp.com' &&
    url.pathname === '/download' &&
    url.searchParams.has('cart_id')
  );
}
