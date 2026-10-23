import { readBandHeader } from '../../bandcamp';
import { FollowRecorder, WishlistTagPrompt } from '../shared/TagPrompt';
import { useCurrentRelease } from './useCurrentRelease';

/**
 * What you can add from a release page: the release, with the heart, which opens the tag
 * picker, and the account selling it, with Follow, which is saved (decisions §21).
 */
export function ReleaseTagPrompts() {
  const release = useCurrentRelease();
  // The sidebar shows the parser error.
  if (release.state !== 'ok') return null;

  const { item } = release.page;
  const header = readBandHeader(document);
  const account = {
    kind: 'band' as const,
    id: item.bandId,
    name: header?.name ?? item.artist,
    url: document.location.origin,
    imageId: null,
    location: header?.location ?? null,
  };
  return (
    <>
      <WishlistTagPrompt release={item} name={`${item.artist} – ${item.title}`} />
      <FollowRecorder account={account} />
    </>
  );
}
