// Which of our profile tabs is open lives in the URL hash (#crate mates), so reloads and direct links
// land on it.

/** The tab named by `hash` (with or without its "#"), or null if it isn't one of `ids`. */
export function tabFromHash<Id extends string>(hash: string, ids: readonly Id[]): Id | null {
  const name = hash.startsWith('#') ? hash.slice(1) : hash;
  return ids.find((id) => id === name) ?? null;
}

/** The URL without its hash, for leaving our tabs without adding a history entry. */
export function withoutHash(url: string): string {
  const at = url.indexOf('#');
  return at === -1 ? url : url.slice(0, at);
}
