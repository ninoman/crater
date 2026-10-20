import { useState } from 'react';
import { useWorkerStatus, type WorkerStatus } from '../../hooks/useWorkerStatus';
import { Button, EmptyState, Panel, StatusDot, Tabs } from '../../ui';
import { ScanState } from './ScanState';
import { useCurrentRelease } from './useCurrentRelease';

function WorkerFooter({ status }: { status: WorkerStatus }) {
  switch (status.state) {
    case 'connecting':
      return <StatusDot tone="neutral">Connecting…</StatusDot>;
    case 'connected':
      return <StatusDot tone="ok">Dighead {status.version}</StatusDot>;
    case 'unreachable':
      return <StatusDot tone="error">Background worker unreachable</StatusDot>;
  }
}

export function ReleaseSidebar() {
  const [open, setOpen] = useState(true);
  const release = useCurrentRelease();
  const worker = useWorkerStatus();

  if (!open) {
    return (
      <Button variant="primary" className="dh-sidebar__toggle" onClick={() => setOpen(true)}>
        Dighead
      </Button>
    );
  }

  const subtitle =
    release.state === 'ok' ? `${release.page.item.artist} – ${release.page.item.title}` : undefined;

  return (
    <Panel
      className="dh-sidebar"
      title="Fans of this also bought"
      subtitle={subtitle}
      actions={
        <Button variant="ghost" icon aria-label="Hide Dighead panel" onClick={() => setOpen(false)}>
          ×
        </Button>
      }
      footer={<WorkerFooter status={worker} />}
    >
      {release.state === 'parser-broken' ? (
        <EmptyState
          tone="error"
          title="Can't read this page"
          description="Bandcamp may have changed its page layout. Dighead needs an update."
        />
      ) : (
        <Tabs
          label="Recommendations"
          items={[
            {
              value: 'also-bought',
              label: 'Also bought',
              content: <ScanState item={release.page.item} />,
            },
            {
              value: 'twins',
              label: 'Twins who own this',
              content: (
                <EmptyState
                  title="No taste twins yet"
                  description="Twins appear once your collection is synced and fans are scanned."
                />
              ),
            },
          ]}
        />
      )}
    </Panel>
  );
}
