import type { ReactNode } from 'react';
import type { ReleasePageItem } from '../../bandcamp';
import { useAlsoBought } from '../../hooks/useAlsoBought';
import { useReleaseCrateMates } from '../../hooks/useReleaseCrateMates';
import { useScannerNotices } from '../../hooks/useScannerNotices';
import { useScanProgress } from '../../hooks/useScanProgress';
import { useStoredFlag } from '../../hooks/useStoredFlag';
import { useWorkerStatus, type WorkerStatus } from '../../hooks/useWorkerStatus';
import { Button, EmptyState, Panel, StatusDot, Tabs } from '../../ui';
import { FollowedAccountTags } from '../shared/FollowedAccountTags';
import { AlsoBoughtList } from './AlsoBoughtList';
import { ReleaseCrateMatesList } from './ReleaseCrateMatesList';
import { ScanHeader } from './ScanHeader';
import { useCurrentRelease } from './useCurrentRelease';
import { WishlistItemTags } from './WishlistItemTags';

/** The sidebar checks the queue's health less often than the popup does. */
const SCANNER_POLL_MS = 5000;

export function ReleaseSidebar() {
  const release = useCurrentRelease();

  if (release.state === 'parser-broken') {
    return (
      <SidebarShell>
        <EmptyState
          tone="error"
          title="Parser broken"
          description="Bandcamp may have changed its page layout. Dighead needs an update."
        />
      </SidebarShell>
    );
  }
  return <ReleaseRecommendations item={release.page.item} />;
}

/**
 * Its hooks run while the sidebar is collapsed too, so the release you're looking at is still
 * scanned first.
 */
function ReleaseRecommendations({ item }: { item: ReleasePageItem }) {
  const progress = useScanProgress(item);
  const notices = useScannerNotices(SCANNER_POLL_MS);
  const releaseSaved = progress.state !== 'loading';
  const { view, hide } = useAlsoBought(item.itemKey, releaseSaved);
  const crateMates = useReleaseCrateMates(item.itemKey, releaseSaved);

  return (
    <SidebarShell subtitle={`${item.artist} – ${item.title}`}>
      <FollowedAccountTags kind="band" id={item.bandId} name={item.artist} />
      <WishlistItemTags itemKey={item.itemKey} name={`${item.artist} – ${item.title}`} />
      <ScanHeader progress={progress} notices={notices} />
      <Tabs
        label="Recommendations"
        items={[
          {
            value: 'also-bought',
            label: 'Also bought',
            content: (
              <AlsoBoughtList
                view={view}
                progress={progress}
                scanStopped={notices.length > 0}
                onHide={hide}
              />
            ),
          },
          {
            value: 'crateMates',
            label: 'Crate mates who own this',
            content: <ReleaseCrateMatesList view={crateMates} />,
          },
        ]}
      />
    </SidebarShell>
  );
}

/** The docked panel, or the tab that brings it back. Open or collapsed holds across pages. */
function SidebarShell({ subtitle, children }: { subtitle?: string; children: ReactNode }) {
  const [open, setOpen] = useStoredFlag('sidebarOpen', true);
  const worker = useWorkerStatus();

  if (!open) {
    return (
      <Button variant="primary" className="dh-sidebar__toggle" onClick={() => setOpen(true)}>
        Dighead
      </Button>
    );
  }
  return (
    <Panel
      className="dh-sidebar"
      title="Fans of this also bought"
      subtitle={subtitle}
      actions={
        <Button variant="ghost" icon aria-label="Collapse Dighead" onClick={() => setOpen(false)}>
          ×
        </Button>
      }
      footer={<WorkerFooter status={worker} />}
    >
      {children}
    </Panel>
  );
}

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
