import { useId } from 'react';
import { StarIcon } from './icons';

export const STARS = [1, 2, 3, 4, 5] as const;

export interface RatingProps {
  /** Names the group for screen readers. */
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}

/** Five stars to pick from. Native radios underneath, so arrow keys work. */
export function Rating({ label, value, onChange }: RatingProps) {
  const name = useId();
  return (
    <div className="dh-rating" role="radiogroup" aria-label={label}>
      {STARS.map((star) => (
        <label key={star} className="dh-rating__star">
          <input
            className="dh-rating__input"
            type="radio"
            name={name}
            value={star}
            checked={value === star}
            onChange={() => onChange(star)}
          />
          <span className="dh-rating__glyph" aria-hidden="true">
            <StarIcon filled={value !== null && star <= value} />
          </span>
          <span className="dh-rating__name">{star === 1 ? '1 star' : `${star} stars`}</span>
        </label>
      ))}
    </div>
  );
}

/** A rating shown, not edited. */
export function RatingStars({ value }: { value: number }) {
  return (
    <span className="dh-rating dh-rating--static" role="img" aria-label={`Rated ${value} of 5`}>
      {STARS.map((star) => (
        <span key={star} className="dh-rating__glyph">
          <StarIcon filled={star <= value} />
        </span>
      ))}
    </span>
  );
}
