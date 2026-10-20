import type { CSSProperties } from 'react';
import { HideIcon } from './icons';
import { type TagOption, tagColor } from './tag';

type ChipProps =
  | {
      tag: TagOption;
      /** Shows a × button that removes the tag. */
      onRemove?: () => void;
      pressed?: never;
      onPressedChange?: never;
    }
  | {
      tag: TagOption;
      /** Filter-bar chip: the whole chip is a toggle button. */
      pressed: boolean;
      onPressedChange: (pressed: boolean) => void;
      onRemove?: never;
    };

export type { ChipProps };

/** A tag in its colour. Either a label with an optional remove button, or a pressable filter. */
export function Chip(props: ChipProps) {
  const { tag } = props;
  const style = { '--dh-chip-color': tagColor(tag.id) } as CSSProperties;

  if (props.onPressedChange) {
    const { pressed, onPressedChange } = props;
    return (
      <button
        type="button"
        className="dh-chip dh-chip--toggle"
        style={style}
        aria-pressed={pressed}
        onClick={() => onPressedChange(!pressed)}
      >
        <span className="dh-chip__name">{tag.name}</span>
      </button>
    );
  }

  return (
    <span className="dh-chip" style={style}>
      <span className="dh-chip__name">{tag.name}</span>
      {props.onRemove && (
        <button
          type="button"
          className="dh-chip__remove"
          aria-label={`Remove tag ${tag.name}`}
          onClick={props.onRemove}
        >
          <HideIcon />
        </button>
      )}
    </span>
  );
}
