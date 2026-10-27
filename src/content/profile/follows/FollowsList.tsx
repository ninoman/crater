import { useMemo, useState, type ReactNode } from 'react';
import type { RowActions } from '../../../hooks/rowActions';
import { type ListPlayer, useListPlayer } from '../../../hooks/useListPlayer';
import { useTags } from '../../../hooks/useTags';
import type {
  FollowedAccount,
  FollowsDigestResult,
  FollowsDigestRow,
} from '../../../shared/followsDigest';
import type { Tag } from '../../../shared/following';
import {
  Button,
  Disclosure,
  EmptyState,
  LoadMore,
  ReleaseRow,
  RowList,
  SectionHeading,
  Tooltip,
} from '../../../ui';
import { FilterControls } from '../../shared/FilterControls';
import { HideHeardToggle, PlayThrough, rowControls } from '../../shared/RowControls';
import { isFiltering, liveTagIds, NO_FILTER, visibleKeys } from '../../shared/tagFilter';
import { CheckingProgress } from './CheckingProgress';
import { formatAccounts, formatFollowsReason, formatFollowsSummary } from './followsText';

const NO_TAGS: Tag[] = [];
/** Rows shown at a time; "Show more" adds as many again. */
const PAGE_SIZE = 60;

export interface FollowsListProps {
  result: FollowsDigestResult;
  /** For "3 days ago". */
  now: number;
  onMute: (bandId: number, muted: boolean) => void;
  actions: RowActions;
  hideHeard: boolean;
  onHideHeardChange: (hideHeard: boolean) => void;
  /** Shown when nothing but muted rows is left. */
  empty: ReactNode;
}

/** The digest: filters, then what's new since your last visit, then the rest, newest first. */
export function FollowsList({
  result,
  now,
  onMute,
  actions,
  hideHeard,
  onHideHeardChange,
  empty,
}: FollowsListProps) {
  const tagsQuery = useTags();
  const tags = tagsQuery.view.state === 'ready' ? tagsQuery.view.data : NO_TAGS;
  const [rawFilter, setFilter] = useState(NO_FILTER);
  const filter = useMemo(
    () => ({ ...rawFilter, tagIds: liveTagIds(rawFilter.tagIds, tags) }),
    [rawFilter, tags],
  );
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [mutedOpen, setMutedOpen] = useState(false);

  const accounts = useMemo(
    () => new Map(result.accounts.map((account) => [account.bandId, account])),
    [result.accounts],
  );
  const listed = useMemo(() => result.rows.filter((row) => !row.muted), [result.rows]);
  const visible = useMemo(() => {
    const ofRow = (row: FollowsDigestRow) => row.bandIds.flatMap((id) => accounts.get(id) ?? []);
    return visibleKeys(listed, filter, {
      keyOf: (row) => row.itemKey,
      tagIdsOf: (row) => [...new Set(ofRow(row).flatMap((account) => account.tagIds))],
      textOf: (row) => [row.title, row.artist, ...ofRow(row).map((a) => a.name)].join(' '),
    });
  }, [listed, filter, accounts]);
  const shown = listed.filter((row) => visible.has(row.itemKey)).slice(0, limit);
  const fresh = shown.filter((row) => row.isNew);
  const earlier = shown.filter((row) => !row.isNew);
  // One player over the rows as shown, new ones first, so playing through follows the page.
  const player = useListPlayer([...fresh, ...earlier], (matchKey) =>
    actions.setHeard(matchKey, true, false),
  );
  const muted = result.accounts.filter((account) => account.muted);

  const list = (rows: FollowsDigestRow[], label: string) => (
    <div className="dh-profile__list">
      <RowList label={label}>
        {rows.map((row) => (
          <FollowsRow
            key={row.itemKey}
            row={row}
            accounts={row.bandIds.flatMap((id) => accounts.get(id) ?? [])}
            now={now}
            onMute={onMute}
            player={player}
            actions={actions}
          />
        ))}
      </RowList>
    </div>
  );

  return (
    <>
      <div className="dh-profile__toolbar">
        <p className="dh-profile__summary">
          {formatFollowsSummary(listed.length, result.accounts.length, result.windowDays)}
        </p>
        {result.checking > 0 && <CheckingProgress result={result} />}
        <div className="dh-profile__controls">
          <PlayThrough player={player} />
          <HideHeardToggle checked={hideHeard} onChange={onHideHeardChange} />
        </div>
      </div>
      <div className="dh-tag-bar">
        <FilterControls
          tags={tags}
          filter={rawFilter}
          onChange={(next) => {
            setFilter(next);
            setLimit(PAGE_SIZE);
          }}
          modeLabel="Show releases from accounts with"
          searchLabel="Search releases and accounts"
        />
      </div>
      {listed.length === 0 ? (
        empty
      ) : shown.length === 0 ? (
        <EmptyState
          title="No releases match these filters"
          action={
            isFiltering(filter) && (
              <Button onClick={() => setFilter(NO_FILTER)}>Clear filters</Button>
            )
          }
        />
      ) : (
        <>
          {fresh.length > 0 && (
            <>
              <SectionHeading>New since your last visit</SectionHeading>
              {list(fresh, 'New since your last visit')}
            </>
          )}
          {earlier.length > 0 && (
            <>
              {fresh.length > 0 && <SectionHeading>Earlier</SectionHeading>}
              {list(earlier, 'Earlier releases from your follows')}
            </>
          )}
          <LoadMore
            remaining={Math.max(0, visible.size - shown.length)}
            onMore={() => setLimit((current) => current + PAGE_SIZE)}
          />
        </>
      )}
      {muted.length > 0 && (
        <Disclosure
          summary={`Muted accounts (${muted.length})`}
          open={mutedOpen}
          onOpenChange={setMutedOpen}
        >
          <MutedAccounts accounts={muted} onUnmute={(bandId) => onMute(bandId, false)} />
        </Disclosure>
      )}
      <p className="dh-profile__note">
        What the artists and labels you follow released in the last {result.windowDays} days, newest
        first; on the same day, accounts more of your top crate mates buy from go first. Crater
        reads each account about once a week. Owned, wishlisted and hidden releases are left out.
      </p>
    </>
  );
}

interface FollowsRowProps {
  row: FollowsDigestRow;
  accounts: FollowedAccount[];
  now: number;
  onMute: (bandId: number, muted: boolean) => void;
  player: ListPlayer;
  actions: RowActions;
}

function FollowsRow({ row, accounts, now, onMute, player, actions }: FollowsRowProps) {
  const [primary] = accounts;
  return (
    <ReleaseRow
      release={{
        ...row,
        label: formatAccounts(
          accounts.map((account) => account.name),
          row.artist,
        ),
      }}
      reason={formatFollowsReason(row, now)}
      {...rowControls(row, player, actions)}
      extraActions={
        primary && (
          <Tooltip
            content={`Mute ${primary.name}: leave its releases out of this list and notifications`}
          >
            <Button variant="ghost" onClick={() => onMute(primary.bandId, true)}>
              Mute
            </Button>
          </Tooltip>
        )
      }
    />
  );
}

function MutedAccounts({
  accounts,
  onUnmute,
}: {
  accounts: FollowedAccount[];
  onUnmute: (bandId: number) => void;
}) {
  return (
    <ul className="dh-follows__muted">
      {accounts.map((account) => (
        <li key={account.bandId}>
          <a href={account.url}>{account.name}</a>
          <Button variant="ghost" onClick={() => onUnmute(account.bandId)}>
            Unmute
          </Button>
        </li>
      ))}
    </ul>
  );
}
