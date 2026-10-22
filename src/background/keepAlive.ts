// Chrome stops an MV3 worker about 30 s after its last extension event or API call, and
// IndexedDB work doesn't count, so a long upgrade or import was cut off and rolled back on
// every wake-up (decisions §19). While such work runs, a cheap API call every 20 s keeps it.

export const KEEP_ALIVE_MS = 20_000;

const ping = () => chrome.runtime.getPlatformInfo();

/** Resolves as `work` does, calling `ping` every `everyMs` until then. */
export async function keepAliveWhile<T>(
  work: Promise<T>,
  {
    ping: call = ping,
    everyMs = KEEP_ALIVE_MS,
  }: { ping?: () => Promise<unknown>; everyMs?: number } = {},
): Promise<T> {
  const timer = setInterval(() => {
    call().catch(() => undefined);
  }, everyMs);
  try {
    return await work;
  } finally {
    clearInterval(timer);
  }
}
