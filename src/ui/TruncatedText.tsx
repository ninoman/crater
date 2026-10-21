import { type ReactNode, useRef, useState } from 'react';
import { Tooltip } from './Tooltip';

export interface TruncatedTextProps {
  /** Must clip with an ellipsis (overflow: hidden, text-overflow: ellipsis, nowrap). */
  className: string;
  children: ReactNode;
}

/** One line of text that shows its full content in a tooltip, but only when it is cut off. */
export function TruncatedText({ className, children }: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  // Measured when the tooltip wants to open, so a resized panel is always judged fresh.
  const onOpenChange = (next: boolean) => {
    const el = ref.current;
    setOpen(next && el !== null && el.scrollWidth > el.clientWidth);
  };
  return (
    <Tooltip content={children} open={open} onOpenChange={onOpenChange}>
      <span ref={ref} className={className}>
        {children}
      </span>
    </Tooltip>
  );
}
