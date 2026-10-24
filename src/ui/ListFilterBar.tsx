import * as RadixPopover from '@radix-ui/react-popover';
import { useEffect, useId, useState } from 'react';
import {
  filtersActive,
  hasPlace,
  type FilterSummary,
  type ListFilters,
  NO_FILTERS,
} from '../shared/listFilters';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { formatFilterSummary } from './filterSummaryText';
import { usePortalContainer } from './portal';

export interface FilterGenre {
  id: number;
  label: string;
}

export interface ListFilterBarProps {
  filters: ListFilters;
  onChange: (next: ListFilters) => void;
  genres: readonly FilterGenre[];
  /** The place saved in settings. "Near me" is off while there is none. */
  place: string;
  /** What the filters did to the list shown below; null while it loads or when none is on. */
  summary: FilterSummary | null;
}

const MIN_YEAR = 1000;
const MAX_YEAR = 9999;

/** How many of the filters are on, for the button. Genres and years count once each. */
function activeCount(filters: ListFilters, place: string): number {
  return [
    filters.genres.length > 0,
    filters.nearMe && hasPlace(place),
    filters.nameYourPrice,
    filters.physical,
    filters.yearFrom !== null || filters.yearTo !== null,
  ].filter(Boolean).length;
}

/**
 * The filters of a recommendation list: a Filters button that opens genre, near me, name your
 * price, physical and year range, and under it a line saying how many picks they hid. The same
 * bar sits on every list (decisions §22).
 */
export function ListFilterBar({ filters, onChange, genres, place, summary }: ListFilterBarProps) {
  const container = usePortalContainer();
  const count = activeCount(filters, place);
  const on = filtersActive(filters, place);

  return (
    <div className="dh-filter-bar">
      <div className="dh-filter-bar__row">
        <RadixPopover.Root>
          <RadixPopover.Trigger asChild>
            <Button variant={on ? 'primary' : 'secondary'} className="dh-filter-bar__trigger">
              {count > 0 ? `Filters · ${count}` : 'Filters'}
            </Button>
          </RadixPopover.Trigger>
          <RadixPopover.Portal container={container}>
            <FilterPanel filters={filters} onChange={onChange} genres={genres} place={place} />
          </RadixPopover.Portal>
        </RadixPopover.Root>
        {on && (
          <Button variant="ghost" onClick={() => onChange(NO_FILTERS)}>
            Clear filters
          </Button>
        )}
        {on && summary && (
          <p className="dh-filter-bar__summary" role="status">
            {formatFilterSummary(summary)}
          </p>
        )}
      </div>
    </div>
  );
}

function FilterPanel({ filters, onChange, genres, place }: Omit<ListFilterBarProps, 'summary'>) {
  const set = (patch: Partial<ListFilters>) => onChange({ ...filters, ...patch });
  const toggleGenre = (id: number) =>
    set({
      genres: filters.genres.includes(id)
        ? filters.genres.filter((other) => other !== id)
        : [...filters.genres, id],
    });
  const placeHint = useId();
  const placeSet = hasPlace(place);

  return (
    <RadixPopover.Content
      className="dh-filter-panel"
      side="bottom"
      align="start"
      sideOffset={4}
      collisionPadding={8}
      aria-label="Filters"
    >
      <fieldset className="dh-filter-panel__group">
        <legend className="dh-filter-panel__legend">Genre</legend>
        <div className="dh-filter-panel__genres">
          {genres.map((genre) => (
            <Checkbox
              key={genre.id}
              label={genre.label}
              checked={filters.genres.includes(genre.id)}
              onChange={() => toggleGenre(genre.id)}
            />
          ))}
        </div>
      </fieldset>
      <div className="dh-filter-panel__group">
        <Checkbox
          label={placeSet ? `Near me (${place})` : 'Near me'}
          checked={filters.nearMe && placeSet}
          onChange={(nearMe) => set({ nearMe })}
          disabled={!placeSet}
          describedBy={placeSet ? undefined : placeHint}
        />
        {!placeSet && (
          <p id={placeHint} className="dh-filter-panel__hint">
            Set your place in Dighead's settings to match bands near you.
          </p>
        )}
        <Checkbox
          label="Name your price"
          checked={filters.nameYourPrice}
          onChange={(nameYourPrice) => set({ nameYourPrice })}
        />
        <Checkbox
          label="Physical edition available"
          checked={filters.physical}
          onChange={(physical) => set({ physical })}
        />
      </div>
      <fieldset className="dh-filter-panel__group dh-filter-panel__years">
        <legend className="dh-filter-panel__legend">Release year</legend>
        <YearInput
          label="From year"
          value={filters.yearFrom}
          onChange={(yearFrom) => set({ yearFrom })}
        />
        <span aria-hidden="true">–</span>
        <YearInput label="To year" value={filters.yearTo} onChange={(yearTo) => set({ yearTo })} />
      </fieldset>
      <p className="dh-filter-panel__hint">
        Releases Dighead hasn't seen a detail of yet can't pass a filter on it.
      </p>
    </RadixPopover.Content>
  );
}

interface YearInputProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}

/** Keeps what you type, and reports it only once it's empty or a whole four-digit year. */
function YearInput({ label, value, onChange }: YearInputProps) {
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => {
    // A change from outside (Clear filters), not from typing.
    setText((current) =>
      parse(current) === value ? current : value === null ? '' : String(value),
    );
  }, [value]);

  return (
    <input
      className="dh-filter-panel__year"
      type="text"
      inputMode="numeric"
      maxLength={4}
      placeholder="YYYY"
      aria-label={label}
      value={text}
      onChange={(event) => {
        const next = event.target.value.replace(/\D/g, '');
        setText(next);
        const year = parse(next);
        if (next === '' || year !== null) onChange(year);
      }}
    />
  );
}

function parse(text: string): number | null {
  const year = Number(text);
  return text !== '' && Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR
    ? year
    : null;
}
