/**
 * Migration 008: Completed At Index
 *
 * Adds index on completed_at for calendar view performance.
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'

export const migration: Migration = {
  version: 8,
  name: 'completed_at_index',

  up(db: Database): void {
    // Add index for completed_at date queries (calendar view)
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_completed_at
      ON tasks(completed_at)
      WHERE completed_at IS NOT NULL
    `)
  },

  down(db: Database): void {
    // Drop the index
    db.exec(`DROP INDEX IF EXISTS idx_tasks_completed_at`)
  }
}
