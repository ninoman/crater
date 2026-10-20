import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { usePortalContainer } from './portal';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  /** Disables both buttons while the action runs. */
  busy?: boolean;
  /** The element that opens the dialog, e.g. a Button. */
  trigger: ReactNode;
}

/** A modal (Radix) asking to confirm a destructive action, portalled into our own root. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  busy = false,
  trigger,
}: ConfirmDialogProps) {
  const container = usePortalContainer();
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>
      <RadixDialog.Portal container={container}>
        <RadixDialog.Overlay className="dh-dialog__overlay" />
        <RadixDialog.Content className="dh-dialog">
          <RadixDialog.Title className="dh-dialog__title">{title}</RadixDialog.Title>
          <RadixDialog.Description className="dh-dialog__description">
            {description}
          </RadixDialog.Description>
          <div className="dh-dialog__actions">
            <RadixDialog.Close asChild>
              <Button disabled={busy}>Cancel</Button>
            </RadixDialog.Close>
            <Button variant="danger" onClick={onConfirm} disabled={busy}>
              {confirmLabel}
            </Button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
