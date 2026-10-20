import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// A path, not a URL: under the jsdom environment `import.meta.url` isn't a file URL.
const dir = join(import.meta.dirname, 'fixtures/');

export function fixtureText(name: string): string {
  return readFileSync(dir + name, 'utf8');
}

export function fixtureJson(name: string): unknown {
  return JSON.parse(fixtureText(name));
}
