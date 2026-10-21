import { memo } from 'react';
import { Checkbox } from '../../ui';

export interface CardSelectProps {
  id: number;
  name: string;
  selected: boolean;
  onSelect: (id: number, selected: boolean) => void;
}

/** A following card's select box, over its avatar. Memoised like `CardExtras`. */
export const CardSelect = memo(function CardSelect({
  id,
  name,
  selected,
  onSelect,
}: CardSelectProps) {
  return (
    <div className="dh-card-select">
      <Checkbox
        label={`Select ${name}`}
        hideLabel
        checked={selected}
        onChange={(checked) => onSelect(id, checked)}
      />
    </div>
  );
});
