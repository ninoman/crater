// Unverified until tests/fixtures/purchase-confirmation.html is captured: after checkout,
// Bandcamp lands on its download page. Re-downloads match too, which only costs a cheap
// incremental sync.
export function isPurchaseConfirmationUrl(url: URL): boolean {
  return url.hostname === 'bandcamp.com' && url.pathname === '/download';
}
