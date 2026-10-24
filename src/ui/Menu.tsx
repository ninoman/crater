import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { usePortalContainer } from './portal';
import { Tooltip } from './Tooltip';

export interface MenuItem {
  label: string;
  onSelect: () => void;
}

export interface MenuProps {
  /** One focusable element that opens it, e.g. an icon Button. */
  trigger: ReactNode;
  /** A short heading above the items, e.g. "Hide from recommendations". */
  title?: string;
  /** A hover and focus hint on the trigger. */
  hint?: string;
  items: readonly MenuItem[];
}

/**
 * A small dropdown of actions (Radix), rendered into our shadow root so it keeps our styles.
 * Arrow keys move between items, Enter picks one, Escape closes and refocuses the trigger.
 */
export function Menu({ trigger, title, hint, items }: MenuProps) {
  const container = usePortalContainer();
  const button = <RadixMenu.Trigger asChild>{trigger}</RadixMenu.Trigger>;
  return (
    <RadixMenu.Root modal={false}>
      {hint ? <Tooltip content={hint}>{button}</Tooltip> : button}
      <RadixMenu.Portal container={container}>
        <RadixMenu.Content className="dh-menu" align="end" sideOffset={4} collisionPadding={8}>
          {title && <RadixMenu.Label className="dh-menu__title">{title}</RadixMenu.Label>}
          {items.map((item) => (
            <RadixMenu.Item key={item.label} className="dh-menu__item" onSelect={item.onSelect}>
              {item.label}
            </RadixMenu.Item>
          ))}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
}
