/**
 * Migration 009: Accepted to Completed
 *
 * Converts 'accepted' status to 'completed' for tasks.
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'
import { logger } from '../../../utils/logger'

export const migration: Migration = {
  version: 9,
  name: 'accepted_to_completed',

  up(db: Database): void {
    // Update all tasks with status 'accepted' to 'completed'
    const result = db
      .prepare(
        `
      UPDATE tasks
      SET status = 'completed'
      WHERE status = 'accepted'
    `
      )
      .run()

    if (result.changes > 0) {
      logger.info(`[Migration] Converted ${result.changes} tasks from 'accepted' to 'completed'`)
    }
  },

  down(db: Database): void {
    // Reverse: Convert 'completed' back to 'accepted'
    // Note: This may affect tasks that were originally 'completed' not from 'accepted'
    // In practice, this is a best-effort rollback
    const result = db
      .prepare(
        `
      UPDATE tasks
      SET status = 'accepted'
      WHERE status = 'completed'
    `
      )
      .run()

    if (result.changes > 0) {
      logger.info(`[Migration] Converted ${result.changes} tasks from 'completed' to 'accepted'`)
    }
  }
}
