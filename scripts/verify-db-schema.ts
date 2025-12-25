#!/usr/bin/env tsx
/**
 * Database Schema Verification Utility
 *
 * This script verifies and optionally fixes the database schema.
 * Run with: npx tsx scripts/verify-db-schema.ts
 */

import Database from 'better-sqlite3'
import { join } from 'path'
import { homedir } from 'os'

const DB_PATH = join(homedir(), '.nightshift', 'nightshift.db')

interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: string | null
  pk: number
}

function verifyTable(db: Database.Database, tableName: string, requiredColumns: string[]): void {
  console.log(`\nVerifying table: ${tableName}`)
  console.log('='.repeat(50))

  const columns = db.pragma(`table_info(${tableName})`) as ColumnInfo[]
  const columnNames = columns.map(c => c.name)

  console.log(`Found ${columns.length} columns:`)
  columns.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`)
  })

  const missing = requiredColumns.filter(col => !columnNames.includes(col))

  if (missing.length > 0) {
    console.log(`\n❌ MISSING COLUMNS:`)
    missing.forEach(col => {
      console.log(`  - ${col}`)
    })
  } else {
    console.log(`\n✅ All required columns present`)
  }
}

function getSchemaVersion(db: Database.Database): number {
  try {
    const result = db.prepare('SELECT version FROM schema_version WHERE id = 1').get() as
      | { version: number }
      | undefined
    return result?.version ?? 0
  } catch {
    return 0
  }
}

function main(): void {
  console.log('Nightshift Database Schema Verification')
  console.log('=' .repeat(50))
  console.log(`Database path: ${DB_PATH}`)

  try {
    const db = new Database(DB_PATH, { readonly: true })
    console.log('✅ Database file opened successfully')

    // Check schema version
    const version = getSchemaVersion(db)
    console.log(`\nSchema version: ${version}`)
    console.log(`Expected version: 13`)

    if (version < 13) {
      console.log(`\n⚠️  WARNING: Database is at version ${version}, expected version 13`)
      console.log(`The app should automatically migrate on next startup.`)
      console.log(`If migration fails, you may need to delete the database and restart.`)
    } else if (version > 13) {
      console.log(`\n⚠️  WARNING: Database is at version ${version}, which is newer than expected (13)`)
      console.log(`This might indicate a development version. Proceed with caution.`)
    } else {
      console.log(`\n✅ Schema version is up to date`)
    }

    // Verify tasks table
    verifyTable(db, 'tasks', [
      'id',
      'project_id',
      'prompt',
      'status',
      'queue_position',
      'external_issue_id',
      'external_issue_url',
      'integration_id',
      'tag_ids',
      'thinking_mode',
      'agent_id',
      'model'
    ])

    // Verify projects table
    verifyTable(db, 'projects', [
      'id',
      'name',
      'git_url',
      'integration_ids',
      'tag_ids',
      'description',
      'icon'
    ])

    // Verify other critical tables
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as { name: string }[]

    console.log(`\n\nAll tables in database:`)
    console.log('='.repeat(50))
    tables.forEach(t => console.log(`  - ${t.name}`))

    db.close()

    console.log(`\n\n✅ Verification complete`)
    console.log(`\nIf you see missing columns above, the app should migrate them on next startup.`)
    console.log(`Check the app logs for migration messages.`)
    console.log(`\nIf problems persist, backup and delete: ${DB_PATH}`)

  } catch (error) {
    console.error(`\n❌ Error:`, error)
    console.error(`\nMake sure the database file exists at: ${DB_PATH}`)
    console.error(`If the app has never been run, this error is expected.`)
    process.exit(1)
  }
}

main()
