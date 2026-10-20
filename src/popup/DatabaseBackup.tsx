import { useRef, useState } from 'react';
import { useDatabaseBackup } from '../hooks/useDatabaseBackup';
import { Button, ConfirmDialog, StatusDot } from '../ui';

/** Export and import of the whole database; import replaces everything, behind a confirm dialog. */
export function DatabaseBackup() {
  const { status, exportBackup, importBackup } = useDatabaseBackup();
  const input = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  const working = status.state === 'working';

  return (
    <section className="dh-danger" aria-label="Backup">
      <div className="dh-danger__text">
        <span className="dh-danger__title">Full backup</span>
        <span className="dh-danger__status">
          {status.state === 'exported' && <StatusDot tone="ok">Exported</StatusDot>}
          {status.state === 'imported' && <StatusDot tone="ok">{status.summary}</StatusDot>}
          {status.state === 'error' && <StatusDot tone="error">{status.error}</StatusDot>}
          {status.state === 'working' &&
            (status.action === 'export' ? 'Exporting…' : 'Importing… keep this popup open.')}
          {status.state === 'idle' &&
            'Everything Dighead has stored, to a file you can restore here or on another machine.'}
        </span>
      </div>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void importBackup(file);
        }}
      />
      <Button disabled={working} onClick={() => void exportBackup()}>
        Export
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Import a backup?"
        description="This deletes every scanned fan and collection, your synced collection, taste twins, tags, hidden releases and the scan queue, and replaces them with the file's contents. Settings are kept."
        confirmLabel="Choose file…"
        onConfirm={() => {
          setConfirming(false);
          input.current?.click();
        }}
        trigger={<Button disabled={working}>Import…</Button>}
      />
    </section>
  );
}
