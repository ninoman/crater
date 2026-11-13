import type { KeyboardEvent, FocusEvent, PointerEvent, Ref } from 'react';
import { MoveIcon } from './icons';

export interface DragHandleProps {
  /** What it moves, e.g. "Move Artist – Title". */
  label: string;
  /** The id of the text that says how to move it from the keyboard. */
  describedBy: string;
  /** Picked up from the keyboard. */
  lifted: boolean;
  ref?: Ref<HTMLButtonElement>;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onBlur: (event: FocusEvent<HTMLButtonElement>) => void;
}

/** The grip a sortable card is dragged by, in the artwork's top-right corner. */
export function DragHandle({ label, describedBy, lifted, ...handlers }: DragHandleProps) {
  return (
    <button
      type="button"
      className="dh-drag-handle"
      aria-label={label}
      aria-describedby={describedBy}
      aria-pressed={lifted}
      {...handlers}
    >
      <span className="dh-drag-handle__box">
        <MoveIcon />
      </span>
    </button>
  );
}
