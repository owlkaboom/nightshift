/**
 * Migration 018: Project Local Path
 *
 * Adds local_path column to projects and migrates data from local_state.
 */

import type { Database } from 'better-sqlite3'
import type { Migration } from '../types'

export const migration: Migration = {
  version: 18,
  name: 'project_local_path',

  up(db: Database): void {
    // Check if column already exists before adding it
    const projectColumns = db.pragma('table_info(projects)') as Array<{ name: string }>
    const projectColumnNames = projectColumns.map((c) => c.name)

    if (!projectColumnNames.includes('local_path')) {
      db.exec(`ALTER TABLE projects ADD COLUMN local_path TEXT`)
    }

    // Migrate data from local_state.project_paths to projects.local_path
    const localStateRow = db
      .prepare('SELECT project_paths FROM local_state WHERE id = 1')
      .get() as { project_paths: string } | undefined

    if (localStateRow) {
      const projectPaths = JSON.parse(localStateRow.project_paths) as Record<string, string>

      // Update each project with its local path
      const updateStmt = db.prepare('UPDATE projects SET local_path = ? WHERE id = ?')
      let migratedCount = 0

      for (const [projectId, localPath] of Object.entries(projectPaths)) {
        const result = updateStmt.run(localPath, projectId)
        if (result.changes > 0) {
          migratedCount++
        }
      }

      if (migratedCount > 0) {
        console.log(
          `[Migration] Migrated ${migratedCount} project paths from local_state to projects table`
        )
      }
    }
  },

  down(db: Database): void {
    // Migrate local_path back to local_state.project_paths
    const projects = db.prepare('SELECT id, local_path FROM projects WHERE local_path IS NOT NULL').all() as Array<{
      id: string
      local_path: string
    }>

    if (projects.length > 0) {
      // Build project_paths object
      const projectPaths: Record<string, string> = {}
      for (const project of projects) {
        projectPaths[project.id] = project.local_path
      }

      // Update local_state
      db.prepare('UPDATE local_state SET project_paths = ? WHERE id = 1').run(
        JSON.stringify(projectPaths)
      )

      console.log(`[Migration] Migrated ${projects.length} project paths back to local_state`)
    }

    // Recreate projects table without local_path
    db.exec(`
      CREATE TABLE projects_rollback (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        git_url TEXT,
        default_branch TEXT,
        default_skills TEXT NOT NULL DEFAULT '[]',
        include_claude_md INTEGER NOT NULL DEFAULT 1,
        tag_ids TEXT NOT NULL DEFAULT '[]',
        integration_ids TEXT NOT NULL DEFAULT '[]',
        added_at TEXT NOT NULL,
        icon TEXT
      )
    `)

    // Copy data (excluding local_path)
    db.exec(`
      INSERT INTO projects_rollback
      SELECT
        id, name, description, git_url, default_branch,
        default_skills, include_claude_md, tag_ids, integration_ids,
        added_at, icon
      FROM projects
    `)

    // Drop old table and rename
    db.exec(`DROP TABLE projects`)
    db.exec(`ALTER TABLE projects_rollback RENAME TO projects`)

    // Recreate index
    db.exec(`CREATE INDEX idx_projects_git_url ON projects(git_url)`)
  }
}
