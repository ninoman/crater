import { useMemo, useState } from 'react';
import { timeAgo } from '../../../shared/timeAgo';
import type { TwinRow, TwinsResult } from '../../../shared/twins';
import {
  Badge,
  Button,
  EmptyState,
  Identity,
  SearchField,
  Segmented,
  Table,
  type TableColumn,
} from '../../../ui';
import {
  filterTwins,
  formatMatch,
  formatRelativeScore,
  type ScoreKey,
  sortTwins,
  topScore,
  TREND_LABELS,
  type TwinBoard,
  type TwinSort,
} from './twinsView';

type Column = TableColumn<TwinRow, TwinSort>;

const RANK: Column = { key: 'rank', header: '#', numeric: true, cell: (row) => row.rank };
const FAN: Column = {
  key: 'fan',
  header: 'fan',
  grow: true,
  cell: (row) => (
    <Identity
      avatarUrl={row.avatarUrl}
      name={row.name}
      href={row.url}
      badges={
        <>
          {row.followed && <Badge>you follow</Badge>}
          {row.labelCluster && <Badge>label cluster</Badge>}
        </>
      }
    />
  ),
};
const OVERLAP: Column = {
  key: 'overlap',
  header: 'in common',
  numeric: true,
  sortKey: 'overlap',
  hint: {
    label: 'How in common is counted',
    content:
      'Releases you both own. An album counts against one of its tracks, and several shared tracks of one album count once; two different tracks of one album don’t count. So this can differ from Bandcamp’s own “in common”.',
  },
  cell: (row) => row.overlap,
};
const TREND: Column = {
  key: 'trend',
  header: 'trend',
  cell: (row) => {
    const { arrow, word } = TREND_LABELS[row.trend];
    return (
      <>
        {arrow && <span aria-hidden="true">{arrow} </span>}
        {word}
      </>
    );
  },
};

const MATCH: Column = {
  key: 'jaccard',
  header: 'match',
  numeric: true,
  sortKey: 'jaccard',
  cell: (row) => formatMatch(row.jaccard),
};
const THIS_YEAR: Column = {
  key: 'latelyOverlap',
  header: 'this year',
  numeric: true,
  sortKey: 'latelyOverlap',
  cell: (row) => row.latelyOverlap,
};

const SCORE_HINTS: Record<ScoreKey, Column['hint']> = {
  score: {
    label: 'How score works',
    content:
      'Every release you both own adds to it, rare ones more than popular ones. The total is divided by √(your collection size × theirs), so a big collection doesn’t win on size alone. A label cluster counts 0.3×. Shown out of 100, your closest twin.',
  },
  lately: {
    label: 'How lately score works',
    content:
      'The all-time score, with every purchase fading as it ages, so recent buying counts most. A release you both bought within two months of each other counts up to 1.5×. Shown out of 100, your closest twin lately.',
  },
};

/** Scores show against the board's best twin, so the column needs that board's top. */
function scoreColumn(key: ScoreKey, top: number): Column {
  return {
    key,
    header: 'score',
    numeric: true,
    sortKey: key,
    hint: SCORE_HINTS[key],
    cell: (row) => formatRelativeScore(row[key] ?? 0, top),
  };
}

function columnsFor(board: TwinBoard, top: number): Column[] {
  return board === 'all'
    ? [RANK, FAN, OVERLAP, MATCH, scoreColumn('score', top), TREND]
    : [RANK, FAN, THIS_YEAR, OVERLAP, scoreColumn('lately', top), TREND];
}

const SCORE_KEY: Record<TwinBoard, ScoreKey> = { all: 'score', lately: 'lately' };

const DEFAULT_SORT: Record<TwinBoard, TwinSort> = SCORE_KEY;

const BOARDS = [
  { value: 'all', label: 'All time' },
  { value: 'lately', label: 'Lately' },
] as const;

/** The leaderboards, all time and lately, with a filter box and sortable columns. */
export function TwinsBoard({ result, now }: { result: TwinsResult; now: number }) {
  const [board, setBoard] = useState<TwinBoard>('all');
  const [query, setQuery] = useState('');
  const [sortedBy, setSortedBy] = useState<TwinSort>(DEFAULT_SORT.all);
  const boardRows = board === 'all' ? result.rows : result.latelyRows;
  const rows = useMemo(
    () => sortTwins(filterTwins(boardRows, query), sortedBy),
    [boardRows, query, sortedBy],
  );
  // Against the whole board, not the filtered rows, so a score doesn't change as you type.
  const columns = useMemo(
    () => columnsFor(board, topScore(boardRows, SCORE_KEY[board])),
    [board, boardRows],
  );
  const flagged = boardRows.some((row) => row.labelCluster);

  const switchBoard = (next: TwinBoard) => {
    setBoard(next);
    setSortedBy(DEFAULT_SORT[next]);
  };

  return (
    <>
      <div className="dh-profile__toolbar">
        <p className="dh-profile__summary">
          {boardRows.length} {board === 'lately' && 'lately '}
          {boardRows.length === 1 ? 'twin' : 'twins'} from {result.fansRead} fans read
          {result.computedAt !== null && ` · updated ${timeAgo(result.computedAt, now)}`}
        </p>
        <div className="dh-profile__controls">
          <Segmented label="Which twins" options={BOARDS} value={board} onChange={switchBoard} />
          <SearchField
            label="Filter twins by name"
            placeholder="filter by name…"
            value={query}
            onChange={setQuery}
          />
        </div>
      </div>
      {rows.length > 0 ? (
        <Table
          label={board === 'all' ? 'Taste twins' : 'Taste twins lately'}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.fanId}
          sortedBy={sortedBy}
          onSortChange={setSortedBy}
        />
      ) : boardRows.length === 0 ? (
        <EmptyState
          title="No one is in step with you lately"
          description="Lately compares what you and other fans have bought in recent months. Either you haven't bought much lately, or none of the fans read so far bought the same releases around now."
        />
      ) : (
        <EmptyState
          title={`No twins match “${query.trim()}”`}
          action={<Button onClick={() => setQuery('')}>Clear filter</Button>}
        />
      )}
      <p className="dh-profile__note">
        {board === 'all' ? (
          <>
            In common: releases you both own. Match: those as a share of both collections combined.
            Score weighs rare releases more and drives the ranking.
          </>
        ) : (
          <>
            Lately ranks by what you've both bought recently: a purchase counts half as much every{' '}
            {result.latelyHalfLifeMonths} {result.latelyHalfLifeMonths === 1 ? 'month' : 'months'},
            and a release you both bought within two months of each other counts up to 1.5 times.
            This year: releases you both bought in the last 12 months.
          </>
        )}{' '}
        Trend compares how in step your recent buying is now with a year ago; new means they bought
        little back then, quiet that they've bought little lately.
        {flagged &&
          ' A label cluster is a fan who collects most of one label you share; their score counts less.'}
      </p>
    </>
  );
}
