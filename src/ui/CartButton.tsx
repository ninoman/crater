import { Button } from './Button';
import { CartIcon } from './icons';
import { Tooltip } from './Tooltip';

/** A release's place in your cart. While `saving`, `inCart` already shows the change. */
export interface CartLine {
  inCart: boolean;
  status: 'idle' | 'saving' | 'error';
}

export interface CartButtonProps {
  /** "Artist – Title", for screen readers. */
  name: string;
  line: CartLine;
  onToggle: () => void;
}

function hint({ inCart, status }: CartLine): string {
  if (status === 'saving') return inCart ? 'Adding to your cart…' : 'Removing from your cart…';
  if (status === 'error') return "Couldn't change your cart. Try again";
  return inCart ? 'In your cart. Click to remove' : 'Add the digital release to your cart';
}

/** Adds the digital release to your Bandcamp cart, or takes it out when it's in. */
export function CartButton({ name, line, onToggle }: CartButtonProps) {
  return (
    <Tooltip content={hint(line)}>
      <Button
        variant="ghost"
        icon
        aria-label={`${name} in cart`}
        aria-pressed={line.inCart}
        aria-busy={line.status === 'saving'}
        onClick={onToggle}
      >
        <CartIcon filled={line.inCart} />
      </Button>
    </Tooltip>
  );
}
