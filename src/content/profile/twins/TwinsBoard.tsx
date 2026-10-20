import { useMemo, useState } from 'react';
import { timeAgo } from '../../../shared/timeAgo';
import type { TwinRow, TwinsResult } from '../../../shared/twins';
import {
  Badge,
  Button,
  EmptyState,
  Identity,
  SearchField,
  Table,
  type TableColumn,
} from '../../../ui';
import { filterTwins, formatMatch, formatScore, sortTwins, type TwinSort } from './twinsView';

const COLUMNS: TableColumn<TwinRow, TwinSort>[] = [
  { key: 'rank', header: '#', numeric: true, cell: (row) => row.rank },
  {
    key: 'fan',
    header: 'fan',
    cell: (row) => (
      <Identity
        avatarUrl={row.avatarUrl}
        name={row.name}
        href={row.url}
        badges={row.labelCluster && <Badge>label cluster</Badge>}
      />
    ),
  },
  {
    key: 'overlap',
    header: 'in common',
    numeric: true,
    sortKey: 'overlap',
    cell: (row) => row.overlap,
  },
  {
    key: 'jaccard',
    header: 'match',
    numeric: true,
    sortKey: 'jaccard',
    cell: (row) => formatMatch(row.jaccard),
  },
  {
    key: 'score',
    header: 'score',
    numeric: true,
    sortKey: 'score',
    cell: (row) => formatScore(row.score),
  },
];

/** The leaderboard with its filter box and sortable columns. */
export function TwinsBoard({ result, now }: { result: TwinsResult; now: number }) {
  const [query, setQuery] = useState('');
  const [sortedBy, setSortedBy] = useState<TwinSort>('score');
  const rows = useMemo(
    () => sortTwins(filterTwins(result.rows, query), sortedBy),
    [result.rows, query, sortedBy],
  );
  const flagged = result.rows.some((row) => row.labelCluster);

  return (
    <>
      <div className="dh-profile__toolbar">
        <p className="dh-profile__summary">
          {result.rows.length} taste {result.rows.length === 1 ? 'twin' : 'twins'} from{' '}
          {result.fansRead} fans read
          {result.computedAt !== null && ` · updated ${timeAgo(result.computedAt, now)}`}
        </p>
        <SearchField
          label="Filter twins by name"
          placeholder="filter by name…"
          value={query}
          onChange={setQuery}
        />
      </div>
      {rows.length > 0 ? (
        <Table
          label="Taste twins"
          columns={COLUMNS}
          rows={rows}
          rowKey={(row) => row.fanId}
          sortedBy={sortedBy}
          onSortChange={setSortedBy}
        />
      ) : (
        <EmptyState
          title={`No twins match “${query.trim()}”`}
          action={<Button onClick={() => setQuery('')}>Clear filter</Button>}
        />
      )}
      <p className="dh-profile__note">
        In common: releases you both own. Match: those as a share of both collections combined.
        Score weighs rare releases more and drives the ranking.
        {flagged &&
          ' A label cluster is a fan who collects most of one label you share; their score counts less.'}
      </p>
    </>
  );
}
