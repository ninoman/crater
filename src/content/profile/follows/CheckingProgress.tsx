import type { FollowsDigestResult } from '../../../shared/followsDigest';
import { Progress } from '../../../ui';
import { formatChecked } from './followsText';

/** While the first reads run, how far they've got. */
export function CheckingProgress({ result }: { result: FollowsDigestResult }) {
  const label = formatChecked(result.readAccounts, result.accounts.length);
  return (
    <div className="dh-follows__progress">
      <span className="dh-profile__summary">{label}</span>
      <Progress value={result.readAccounts} max={result.accounts.length} label={label} />
    </div>
  );
}
