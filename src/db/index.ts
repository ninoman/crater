import { DigheadDb } from './schema';

export * from './mappers';
export * from './matchIndex';
export * from './repo';
export type * from './schema';
export { DigheadDb };

/** The extension's database. Only the service worker should import this. */
export const db = new DigheadDb();
