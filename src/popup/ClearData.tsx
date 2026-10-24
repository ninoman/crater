import { useState } from 'react';
import { useClearData } from '../hooks/useClearData';
import { Button, ConfirmDialog, StatusDot } from '../ui';

/** "Clear all data", behind a confirm dialog. */
export function ClearData() {
  const { status, clear } = useClearData();
  const [open, setOpen] = useState(false);

  return (
    <section className="dh-danger" aria-label="Data">
      <div className="dh-danger__text">
        <span className="dh-danger__title">Clear all data</span>
        <span className="dh-danger__status">
          {status.state === 'done' && <StatusDot tone="ok">Cleared</StatusDot>}
          {status.state === 'error' && (
            <StatusDot tone="error">Couldn't clear: {status.error}</StatusDot>
          )}
          {(status.state === 'idle' || status.state === 'clearing') &&
            'Scanned fans, your synced collection and the queue. Settings stay.'}
        </span>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Clear all data?"
        description="This deletes every scanned fan and collection, your synced collection, crate mates, what you hid or heard, and the scan queue. Settings are kept. Your collection syncs again on your next Bandcamp page, but scans start from scratch."
        confirmLabel="Clear everything"
        busy={status.state === 'clearing'}
        onConfirm={() => void clear().finally(() => setOpen(false))}
        trigger={<Button variant="danger">Clear…</Button>}
      />
    </section>
  );
}
