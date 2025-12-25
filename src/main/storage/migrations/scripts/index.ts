/**
 * Migration Scripts Index
 *
 * Exports all migration scripts in order.
 */

import type { Migration } from '../types'

// Import all migrations
import { migration as m001 } from './001_initial_schema'
import { migration as m002 } from './002_add_notes'
import { migration as m003 } from './003_add_thinking_mode'
import { migration as m004 } from './004_nested_groups'
import { migration as m005 } from './005_remove_task_title'
import { migration as m006 } from './006_notes_icon'
import { migration as m007 } from './007_vault_path'
import { migration as m008 } from './008_completed_at_index'
import { migration as m009 } from './009_accepted_to_completed'
import { migration as m010 } from './010_project_tag_ids'
import { migration as m011 } from './011_task_tag_ids'
import { migration as m012 } from './012_notes_tag_refs'
import { migration as m013 } from './013_integration_support'
import { migration as m014 } from './014_selected_project_id'
import { migration as m015 } from './015_migrations_table'
import { migration as m016 } from './016_debug_logging'
import { migration as m017 } from './017_note_groups'
import { migration as m018 } from './018_project_local_path'
import { migration as m019 } from './019_rename_local_path'
import { migration as m020 } from './020_task_session_id'
import { migration as m021 } from './021_task_usage_tracking'
import { migration as m022 } from './022_remove_skills'

/**
 * All migrations in order
 *
 * Migrations are sorted by version number to ensure correct execution order.
 */
export const migrations: Migration[] = [
  m001,
  m002,
  m003,
  m004,
  m005,
  m006,
  m007,
  m008,
  m009,
  m010,
  m011,
  m012,
  m013,
  m014,
  m015,
  m016,
  m017,
  m018,
  m019,
  m020,
  m021,
  m022
].sort((a, b) => a.version - b.version)
