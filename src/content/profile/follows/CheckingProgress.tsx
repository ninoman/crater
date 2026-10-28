import type { FollowsDigestResult } from '../../../shared/followsDigest';
import { InlineProgress } from '../../../ui';
import { formatChecked } from './followsText';

/** While the first reads run, how far they've got. */
export function CheckingProgress({ result }: { result: FollowsDigestResult }) {
  return (
    <InlineProgress
      label={formatChecked(result.readAccounts, result.accounts.length)}
      value={result.readAccounts}
      max={result.accounts.length}
    />
  );
}
