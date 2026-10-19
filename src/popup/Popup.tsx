import { useWorkerStatus } from '../hooks/useWorkerStatus';
import { EmptyState, StatusDot } from '../ui';

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
      <EmptyState
        title="Nothing synced yet"
        description="Open any Bandcamp page while logged in. Collection sync arrives in the next update."
      />
    </div>
  );
}
