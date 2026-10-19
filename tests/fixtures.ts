import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('./fixtures/', import.meta.url));

export function fixtureText(name: string): string {
  return readFileSync(dir + name, 'utf8');
}

export function fixtureJson(name: string): unknown {
  return JSON.parse(fixtureText(name));
}
