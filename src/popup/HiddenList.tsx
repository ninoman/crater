import { useHiddenList } from '../hooks/useHiddenList';
import { type HiddenEntry, type HideKind, hideTargetKey } from '../shared/hide';
import { timeAgo } from '../shared/timeAgo';
import { Button, EmptyState, Row, RowList } from '../ui';

const KIND_LABELS: Record<HideKind, string> = {
  release: 'Release',
  band: 'Everything by this artist',
  label: 'Everything on this label',
};

/** What you hid from recommendations, newest first, each with Unhide (decisions §22). */
export function HiddenList() {
  const { view, reload, unhide } = useHiddenList();

  switch (view.state) {
    case 'loading':
      return <EmptyState title="Loading what you hid…" />;
    case 'unreachable':
      return (
        <EmptyState
          tone="error"
          title="Couldn't load what you hid"
          description="Crater's background worker didn't answer."
          action={<Button onClick={reload}>Try again</Button>}
        />
      );
    case 'ready':
      if (view.entries.length === 0) {
        return (
          <EmptyState
            title="Nothing hidden"
            description="Hide a release, an artist or a label from any recommendation's menu, and it shows up here to undo."
          />
        );
      }
      return (
        <RowList label="Hidden from recommendations">
          {view.entries.map((entry) => (
            <HiddenRow
              key={hideTargetKey(entry.target)}
              entry={entry}
              now={view.loadedAt}
              onUnhide={() => unhide(entry.target)}
            />
          ))}
        </RowList>
      );
  }
}

function HiddenRow({
  entry,
  now,
  onUnhide,
}: {
  entry: HiddenEntry;
  now: number;
  onUnhide: () => void;
}) {
  return (
    <Row
      title={
        entry.url ? (
          <a href={entry.url} target="_blank" rel="noopener">
            {entry.name}
          </a>
        ) : (
          entry.name
        )
      }
      meta={[`${KIND_LABELS[entry.target.kind]} · hidden ${timeAgo(entry.hiddenAt, now)}`]}
      actions={
        <Button aria-label={`Unhide ${entry.name}`} onClick={onUnhide}>
          Unhide
        </Button>
      }
    />
  );
}
