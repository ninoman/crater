import { usePermission } from '../hooks/usePermission';
import { BANDCAMP_MATCHES } from '../shared/bandcampHosts';
import { Notice } from '../ui';

const BANDCAMP: chrome.permissions.Permissions = { origins: BANDCAMP_MATCHES };

/**
 * Firefox lets you withdraw Crater's access to bandcamp.com after install, which stops every
 * scan and sidebar. Chrome can too, under "Site access" (decisions §26).
 */
export function HostAccessNotice() {
  const { granted, request } = usePermission(BANDCAMP);
  if (granted !== false) return null;
  return (
    <Notice
      tone="error"
      title="No access to Bandcamp."
      actions={[{ label: 'Allow access', onClick: () => void request() }]}
    >
      Crater can’t read Bandcamp pages, so it can’t sync or scan.
    </Notice>
  );
}
