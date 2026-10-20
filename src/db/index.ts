import { DigheadDb } from './schema';

export * from './backup';
export * from './mappers';
export * from './matchIndex';
export * from './repo';
export * from './tagBackup';
export * from './tagFilter';
export type * from './schema';
export { DigheadDb };

/** The extension's database. Only the service worker should import this. */
export const db = new DigheadDb();
