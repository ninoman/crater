import type { FilterSummary } from '../../shared/listFilters';
import { Button, EmptyState, formatFilterSummary } from '../../ui';

export interface NoMatchesProps {
  summary: FilterSummary;
  onClear: () => void;
}

/** A filtered list with nothing left in it: say the filters did it, and how to undo that. */
export function NoMatches({ summary, onClear }: NoMatchesProps) {
  return (
    <EmptyState
      title="Nothing matches these filters"
      description={`${formatFilterSummary(summary)}. Loosen a filter, or clear them all.`}
      action={<Button onClick={onClear}>Clear filters</Button>}
    />
  );
}
