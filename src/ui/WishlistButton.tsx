import { Button } from './Button';
import { HeartIcon } from './icons';
import { Tooltip } from './Tooltip';

/**
 * A heart's state: whether the item is in your wishlist, and how the last click went. While
 * `saving`, `on` already shows the change being saved.
 */
export interface WishlistHeart {
  on: boolean;
  status: 'idle' | 'saving' | 'signed-out' | 'error';
}

export interface WishlistButtonProps {
  /** What it wishlists, e.g. "Artist – Title", for screen readers. */
  name: string;
  heart: WishlistHeart;
  /** Gets the button, so a tag picker can open next to it. */
  onToggle: (anchor: HTMLElement) => void;
}

function hint({ on, status }: WishlistHeart): string {
  switch (status) {
    case 'saving':
      return on ? 'Adding to your wishlist…' : 'Removing from your wishlist…';
    case 'signed-out':
      return 'Sign in to Bandcamp to change your wishlist';
    case 'error':
      return "Couldn't change your wishlist. Try again";
    case 'idle':
      return on ? 'In your wishlist. Click to remove' : 'Add to wishlist';
  }
}

/** Bandcamp's heart: adds to your wishlist, or takes it off when filled. */
export function WishlistButton({ name, heart, onToggle }: WishlistButtonProps) {
  return (
    <Tooltip content={hint(heart)}>
      <Button
        variant="ghost"
        icon
        aria-label={`Wishlist ${name}`}
        aria-pressed={heart.on}
        aria-busy={heart.status === 'saving'}
        onClick={(event) => onToggle(event.currentTarget)}
      >
        <HeartIcon filled={heart.on} />
      </Button>
    </Tooltip>
  );
}
