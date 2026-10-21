import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { usePortalContainer } from './portal';

export interface TooltipProps {
  content: ReactNode;
  /** One focusable element, e.g. an icon Button. Its own aria-label stays its name. */
  children: ReactNode;
  /** Controls when it shows, e.g. only while some condition holds. Uncontrolled by default. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** A short hover and focus hint (Radix), rendered into our shadow root so it keeps our styles. */
export function Tooltip({ content, children, open, onOpenChange }: TooltipProps) {
  const container = usePortalContainer();
  return (
    <RadixTooltip.Provider delayDuration={400}>
      <RadixTooltip.Root open={open} onOpenChange={onOpenChange}>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal container={container}>
          <RadixTooltip.Content
            className="dh-tooltip"
            side="top"
            sideOffset={4}
            collisionPadding={8}
          >
            {content}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
