/**
 * Migration 015: Migrations Table
 *
 * Adds migrations table for tracking one-time data migrations (separate from schema versions).
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'

export const migration: Migration = {
  version: 15,
  name: 'migrations_table',

  up(db: Database): void {
    // Create migrations table if it doesn't exist
    // This table tracks one-time data migrations (separate from schema versions)
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        completed_at TEXT NOT NULL
      )
    `)
  },

  down(db: Database): void {
    // Drop migrations table
    db.exec(`DROP TABLE IF EXISTS migrations`)
  }
}
