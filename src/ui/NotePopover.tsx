import * as RadixPopover from '@radix-ui/react-popover';
import { useState } from 'react';
import { Button } from './Button';
import { usePortalContainer } from './portal';
import { Rating, RatingStars } from './Rating';

export interface NoteValue {
  text: string;
  rating: number | null;
}

export interface NotePopoverProps {
  /** What the note is on, for the title and screen readers. */
  name: string;
  note: NoteValue | null;
  maxLength: number;
  /** An empty note (no text, no rating) deletes it. */
  onSave: (note: NoteValue) => void;
}

/**
 * "+ note": your private note and 1–5 rating on a release, in a popover. The button shows what
 * you wrote once there is something. Save keeps it; Escape or a click outside drops the draft.
 */
export function NotePopover({ name, note, maxLength, onSave }: NotePopoverProps) {
  const container = usePortalContainer();
  const [open, setOpen] = useState(false);
  return (
    <RadixPopover.Root open={open} onOpenChange={setOpen}>
      <RadixPopover.Trigger asChild>
        <Button
          variant="ghost"
          className="dh-note__trigger"
          aria-label={note ? `Edit note on ${name}` : `Add note on ${name}`}
        >
          {note ? <NoteSummary note={note} /> : '+ note'}
        </Button>
      </RadixPopover.Trigger>
      <RadixPopover.Portal container={container}>
        <NoteForm
          name={name}
          note={note}
          maxLength={maxLength}
          onSave={(next) => {
            onSave(next);
            setOpen(false);
          }}
        />
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

function NoteSummary({ note }: { note: NoteValue }) {
  return (
    <>
      {note.rating !== null && <RatingStars value={note.rating} />}
      {note.text !== '' && <span className="dh-note__text">{note.text}</span>}
    </>
  );
}

/** Unmounted while closed, so every opening starts from the saved note. */
function NoteForm({
  name,
  note,
  maxLength,
  onSave,
}: Omit<NotePopoverProps, 'note'> & { note: NoteValue | null }) {
  const [text, setText] = useState(note?.text ?? '');
  const [rating, setRating] = useState(note?.rating ?? null);
  return (
    <RadixPopover.Content className="dh-note" align="start" sideOffset={4}>
      <form
        className="dh-note__form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ text, rating });
        }}
      >
        <p className="dh-note__title">Your note on {name}</p>
        <Rating label="Your rating" value={rating} onChange={setRating} />
        <textarea
          className="dh-note__input"
          aria-label="Note"
          placeholder="Only you see this"
          rows={4}
          maxLength={maxLength}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <span className="dh-note__actions">
          {(text !== '' || rating !== null) && (
            <Button variant="ghost" onClick={() => onSave({ text: '', rating: null })}>
              Delete
            </Button>
          )}
          <Button type="submit" variant="primary">
            Save
          </Button>
        </span>
      </form>
    </RadixPopover.Content>
  );
}
