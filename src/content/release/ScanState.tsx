import type { ReleasePageItem } from '../../bandcamp';
import { useScanProgress } from '../../hooks/useScanProgress';
import { EmptyState } from '../../ui';

/** Where the supporter scan of this release stands, until recommendations replace it. */
export function ScanState({ item }: { item: ReleasePageItem }) {
  const view = useScanProgress(item.itemKey, item.url);

  switch (view.state) {
    case 'loading':
      return <EmptyState title="Checking scan status…" />;
    case 'unreachable':
      return (
        <EmptyState
          tone="error"
          title="Background worker unreachable"
          description="Try reloading the extension from chrome://extensions."
        />
      );
    case 'ready': {
      const { scanned, total, listed } = view.progress;
      if (!listed) {
        return (
          <EmptyState
            title="Queued for scanning"
            description="Dighead will read this release's supporters shortly."
          />
        );
      }
      if (total === 0) {
        return (
          <EmptyState
            title="No public supporters yet"
            description="Nobody shows up as owning this release, so there's nothing to compare."
          />
        );
      }
      return scanned < total ? (
        <EmptyState
          title={`Scanning supporters: ${scanned} / ${total}`}
          description="Each supporter's collection is read slowly, to stay polite to Bandcamp."
        />
      ) : (
        <EmptyState
          title={`All ${total} supporters scanned`}
          description="Also-bought recommendations arrive in the next update."
        />
      );
    }
  }
}
