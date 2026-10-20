import { useSyncStatus } from '../hooks/useSyncStatus';
import { useWorkerStatus } from '../hooks/useWorkerStatus';
import { EmptyState, StatusDot, Tabs } from '../ui';
import { ClearData } from './ClearData';
import { TagBackup } from './TagBackup';
import { ScannerSummary } from './ScannerSummary';
import { SettingsPanel } from './SettingsPanel';
import { SyncSummary } from './SyncSummary';

function SyncBody() {
  const { view, resync } = useSyncStatus();

  switch (view.state) {
    case 'loading':
      return <EmptyState title="Loading…" />;
    case 'unreachable':
      return (
        <EmptyState
          tone="error"
          title="Background worker unreachable"
          description="Try reloading the extension from chrome://extensions."
        />
      );
    case 'ready':
      if (view.status.state === 'logged-out') {
        return (
          <EmptyState
            title="Log in to Bandcamp"
            description="Open any bandcamp.com page while logged in, and Dighead will sync your collection."
          />
        );
      }
      return <SyncSummary status={view.status} now={view.checkedAt} onResync={resync} />;
  }
}

function StatusTab({ connected }: { connected: boolean }) {
  return (
    <>
      <SyncBody />
      {connected && <ScannerSummary />}
    </>
  );
}

function SettingsTab() {
  return (
    <>
      <SettingsPanel />
      <TagBackup />
      <ClearData />
    </>
  );
}

export function Popup() {
  const worker = useWorkerStatus();

  return (
    <div className="dh-popup">
      <header className="dh-popup__header">
        <h1 className="dh-popup__title">Dighead</h1>
        <span className="dh-popup__status">
          {worker.state === 'connected' && <StatusDot tone="ok">v{worker.version}</StatusDot>}
          {worker.state === 'connecting' && <StatusDot tone="neutral">Connecting…</StatusDot>}
          {worker.state === 'unreachable' && <StatusDot tone="error">Worker unreachable</StatusDot>}
        </span>
      </header>
      <Tabs
        label="Dighead"
        items={[
          {
            value: 'status',
            label: 'Status',
            content: <StatusTab connected={worker.state === 'connected'} />,
          },
          { value: 'settings', label: 'Settings', content: <SettingsTab /> },
        ]}
      />
    </div>
  );
}
