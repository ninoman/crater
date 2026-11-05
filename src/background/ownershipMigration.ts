// Runs the move of ownership rows into the packed tables (decisions §27) in the background, a
// chunk per transaction, until it's done. Everything else keeps working meanwhile. It starts on
// every wake-up, since a killed worker leaves it where the last chunk ended.

import { type CraterDb, migrateOwnershipStep } from '../db';
import { keepAliveWhile } from './keepAlive';

let running: Promise<void> | null = null;
let stopping = false;

async function run(db: CraterDb, step: (db: CraterDb) => Promise<boolean>): Promise<void> {
  while (!stopping && (await step(db))) {
    // Each step is its own transaction, so scans and page reads get their turn in between.
  }
}

/** Starts the migration unless it's running already. Does nothing once it's done. */
export function kickOwnershipMigration(
  db: CraterDb,
  step: (db: CraterDb) => Promise<boolean> = migrateOwnershipStep,
): Promise<void> {
  if (running) return running;
  stopping = false;
  running = keepAliveWhile(run(db, step))
    .catch((error: unknown) => console.error('crater: the ownership migration failed', error))
    .finally(() => {
      running = null;
    });
  return running;
}

/**
 * Stops after the chunk in progress. An import must wait for it: it replaces the tables the
 * migration reads, and then starts it again itself if the file needs it.
 */
export async function stopOwnershipMigration(): Promise<void> {
  stopping = true;
  await running;
}
