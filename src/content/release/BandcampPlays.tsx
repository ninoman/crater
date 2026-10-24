import type { ItemKey } from '../../bandcamp';
import { useBandcampPlays } from '../../hooks/useBandcampPlays';

/** Records plays of the page's release in Bandcamp's own player as heard. Renders nothing. */
export function BandcampPlays({ itemKey }: { itemKey: ItemKey }) {
  useBandcampPlays(itemKey);
  return null;
}
