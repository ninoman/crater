import type { Diagnostics } from '../shared/diagnostics';
import { loadErrorLog } from './errorLog';
import { getScannerStatus } from './scanner';

export async function getDiagnostics(): Promise<Diagnostics> {
  const [scanner, errors] = await Promise.all([getScannerStatus(), loadErrorLog()]);
  return {
    version: chrome.runtime.getManifest().version,
    browser: navigator.userAgent,
    createdAt: new Date().toISOString(),
    scanner,
    errors,
  };
}
