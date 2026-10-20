import * as RadixPopover from '@radix-ui/react-popover';
import { type CSSProperties, type KeyboardEvent, useId, useState } from 'react';
import { Button } from './Button';
import { CheckIcon } from './icons';
import { usePortalContainer } from './portal';
import { type TagOption, tagColor } from './tag';
import { type TagPickerOption, tagPickerOptions } from './tagPickerOptions';

export interface TagPickerProps {
  tags: readonly TagOption[];
  /** Ids of the tags already on the account (or on every selected row, for bulk tagging). */
  assignedIds: readonly number[];
  onToggle: (tagId: number) => void;
  onCreate: (name: string) => void;
  /** Text of the trigger button. */
  triggerLabel?: string;
}

/**
 * "+ tag": a popover with a combobox. Typing filters your tags, arrows move, Enter toggles the
 * highlighted tag or creates the typed name. It stays open for several picks; Escape closes it.
 */
export function TagPicker({
  tags,
  assignedIds,
  onToggle,
  onCreate,
  triggerLabel = '+ tag',
}: TagPickerProps) {
  const container = usePortalContainer();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();

  const options = tagPickerOptions(tags, query);
  const activeIndex = Math.min(active, options.length - 1);
  const optionId = (index: number) => `${listId}-${index}`;

  function changeOpen(next: boolean) {
    setOpen(next);
    setQuery('');
    setActive(0);
  }

  function changeQuery(next: string) {
    setQuery(next);
    setActive(0);
  }

  function choose(option: TagPickerOption) {
    if (option.kind === 'tag') {
      onToggle(option.tag.id);
    } else {
      onCreate(option.name);
      changeQuery('');
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (options.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((activeIndex + step + options.length) % options.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) choose(option);
    }
  }

  return (
    <RadixPopover.Root open={open} onOpenChange={changeOpen}>
      <RadixPopover.Trigger asChild>
        <Button variant="ghost" className="dh-tag-picker__trigger">
          {triggerLabel}
        </Button>
      </RadixPopover.Trigger>
      <RadixPopover.Portal container={container}>
        <RadixPopover.Content
          className="dh-tag-picker"
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
        >
          <input
            className="dh-tag-picker__input"
            type="text"
            role="combobox"
            aria-label="Find or create a tag"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            placeholder="Find or create a tag"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
          {options.length === 0 ? (
            <p className="dh-tag-picker__empty">No tags yet. Type a name to create one.</p>
          ) : (
            <div
              id={listId}
              className="dh-tag-picker__list"
              role="listbox"
              aria-label="Tags"
              aria-multiselectable="true"
            >
              {options.map((option, index) => {
                const assigned = option.kind === 'tag' && assignedIds.includes(option.tag.id);
                return (
                  // Focus stays in the input (aria-activedescendant), which handles the keys.
                  // biome-ignore lint/a11y/useKeyWithClickEvents: options only take mouse picks.
                  <div
                    key={option.kind === 'tag' ? option.tag.id : 'create'}
                    id={optionId(index)}
                    className="dh-tag-picker__option"
                    role="option"
                    tabIndex={-1}
                    aria-selected={assigned}
                    data-active={index === activeIndex || undefined}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseMove={() => setActive(index)}
                    onClick={() => choose(option)}
                  >
                    {option.kind === 'tag' ? (
                      <>
                        <span
                          className="dh-tag-picker__swatch"
                          style={{ '--dh-chip-color': tagColor(option.tag.id) } as CSSProperties}
                        />
                        <span className="dh-tag-picker__name">{option.tag.name}</span>
                        {assigned && <CheckIcon />}
                      </>
                    ) : (
                      <span className="dh-tag-picker__name">Create “{option.name}”</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
