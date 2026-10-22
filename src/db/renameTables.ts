// Renames tables inside a dexie-export-import JSON file, so a backup made before a rename imports
// into today's schema. The file can be gigabytes, so it streams. Only the two places the format
// names a table are rewritten; row values can't match them, since a quote in a string is escaped.

/** `json` with each table in `renames` (old name to new) under its new name. */
export function renameTables(json: Blob, renames: Readonly<Record<string, string>>): Promise<Blob> {
  const pairs = Object.entries(renames).flatMap(([from, to]): [string, string][] => [
    [`{"name":"${from}","schema":`, `{"name":"${to}","schema":`],
    [`{"tableName":"${from}","inbound":`, `{"tableName":"${to}","inbound":`],
  ]);
  if (pairs.length === 0) return Promise.resolve(json);
  // A name split across two chunks is held back until the next one completes it.
  const holdBack = Math.max(...pairs.map(([from]) => from.length)) - 1;
  let tail = '';
  const rename = new TransformStream<string, string>({
    transform(chunk, controller) {
      const text = pairs.reduce((out, [from, to]) => out.replaceAll(from, to), tail + chunk);
      const cut = Math.max(0, text.length - holdBack);
      controller.enqueue(text.slice(0, cut));
      tail = text.slice(cut);
    },
    flush(controller) {
      controller.enqueue(tail);
    },
  });
  const stream = json
    .stream()
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(rename)
    .pipeThrough(new TextEncoderStream());
  return new Response(stream).blob();
}
