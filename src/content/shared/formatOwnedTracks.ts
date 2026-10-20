/** The badge on albums you own some tracks of (decisions §3.8). */
export function formatOwnedTracks(count: number): string {
  return `you own ${count} track${count === 1 ? '' : 's'}`;
}
