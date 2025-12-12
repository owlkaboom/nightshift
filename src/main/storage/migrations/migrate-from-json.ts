/**
 * JSON to SQLite Migration
 *
 * Migrates existing JSON file-based storage to SQLite.
 * Backs up existing JSON files before migration.
 */

import { existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import type Database from 'better-sqlite3'
import type {
  Project,
  Group,
  AppConfig,
  LocalState,
  SkillsRegistry,
  ProjectMemory
} from '@shared/types'
import { DEFAULT_CONFIG } from '@shared/types'
import {
  getAppDataDir,
  getConfigPath,
  getLocalStatePath,
  getProjectsPath,
  getGroupsPath,
  getSkillsPath,
  getMemoryDir,
  getTasksDir,
  getProjectTasksDir
} from '../../utils/paths'
// Note: We use fs.readFileSync directly in migration for simplicity

interface MigrationResult {
  success: boolean
  migratedItems: {
    config: boolean
    localState: boolean
    projects: number
    groups: number
    skills: number
    tasks: number
    memories: number
    credentials: number
  }
  backupPath: string | null
  errors: string[]
}

/**
 * Check if JSON files exist and need migration
 */
export function needsMigration(): boolean {
  // Check for any of the main JSON files
  const jsonFiles = [
    getConfigPath(),
    getLocalStatePath(),
    getProjectsPath(),
    getGroupsPath()
  ]

  return jsonFiles.some((f) => existsSync(f))
}

/**
 * Create backup of existing JSON files
 */
function createBackup(): string {
  const appDir = getAppDataDir()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(appDir, `json-backup-${timestamp}`)

  mkdirSync(backupDir, { recursive: true })

  // Files to backup
  const filesToBackup = [
    { path: getConfigPath(), name: 'config.json' },
    { path: getLocalStatePath(), name: 'local-state.json' },
    { path: getProjectsPath(), name: 'projects.json' },
    { path: getGroupsPath(), name: 'groups.json' },
    { path: getSkillsPath(), name: 'skills.json' }
  ]

  for (const file of filesToBackup) {
    if (existsSync(file.path)) {
      const backupPath = join(backupDir, file.name)
      // Copy file (renameSync would move it)
      const fs = require('fs')
      fs.copyFileSync(file.path, backupPath)
    }
  }

  // Backup sync directory
  const syncDir = join(appDir, 'sync')
  if (existsSync(syncDir)) {
    const backupSyncDir = join(backupDir, 'sync')
    mkdirSync(backupSyncDir, { recursive: true })

    const syncFiles = readdirSync(syncDir)
    for (const file of syncFiles) {
      const src = join(syncDir, file)
      const dest = join(backupSyncDir, file)
      if (statSync(src).isFile()) {
        require('fs').copyFileSync(src, dest)
      }
    }
  }

  // Backup tasks directory
  const tasksDir = getTasksDir()
  if (existsSync(tasksDir)) {
    const backupTasksDir = join(backupDir, 'tasks')
    copyDirRecursive(tasksDir, backupTasksDir)
  }

  // Backup memory directory
  const memoryDir = getMemoryDir()
  if (existsSync(memoryDir)) {
    const backupMemoryDir = join(backupDir, 'memory')
    copyDirRecursive(memoryDir, backupMemoryDir)
  }

  // Backup credentials file
  const credentialsPath = join(appDir, 'credentials.enc.json')
  if (existsSync(credentialsPath)) {
    require('fs').copyFileSync(credentialsPath, join(backupDir, 'credentials.enc.json'))
  }

  console.log(`[Migration] Created backup at: ${backupDir}`)
  return backupDir
}

/**
 * Recursively copy a directory
 */
function copyDirRecursive(src: string, dest: string): void {
  const fs = require('fs')

  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true })
  }

  const entries = readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

/**
 * Remove old JSON files after successful migration
 */
function cleanupJsonFiles(): void {
  const filesToRemove = [
    getConfigPath(),
    getLocalStatePath(),
    getProjectsPath(),
    getGroupsPath(),
    getSkillsPath(),
    join(getAppDataDir(), 'credentials.enc.json')
  ]

  for (const file of filesToRemove) {
    if (existsSync(file)) {
      require('fs').unlinkSync(file)
    }
  }

  // Remove sync directory if empty
  const syncDir = join(getAppDataDir(), 'sync')
  if (existsSync(syncDir)) {
    const remaining = readdirSync(syncDir)
    if (remaining.length === 0) {
      require('fs').rmdirSync(syncDir)
    }
  }

  // Remove task manifest files but keep log files
  const tasksDir = getTasksDir()
  if (existsSync(tasksDir)) {
    const projectIds = readdirSync(tasksDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)

    for (const projectId of projectIds) {
      const projectTasksDir = getProjectTasksDir(projectId)
      const taskIds = readdirSync(projectTasksDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)

      for (const taskId of taskIds) {
        const manifestPath = join(projectTasksDir, taskId, 'manifest.json')
        if (existsSync(manifestPath)) {
          require('fs').unlinkSync(manifestPath)
        }
      }
    }
  }

  // Remove memory JSON files
  const memoryDir = getMemoryDir()
  if (existsSync(memoryDir)) {
    const projectIds = readdirSync(memoryDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)

    for (const projectId of projectIds) {
      const memoryPath = join(memoryDir, projectId, 'memory.json')
      if (existsSync(memoryPath)) {
        require('fs').unlinkSync(memoryPath)
      }
    }
  }

  console.log('[Migration] Cleaned up old JSON files')
}

/**
 * Migrate all JSON data to SQLite
 */
export async function migrateFromJson(db: Database.Database): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migratedItems: {
      config: false,
      localState: false,
      projects: 0,
      groups: 0,
      skills: 0,
      tasks: 0,
      memories: 0,
      credentials: 0
    },
    backupPath: null,
    errors: []
  }

  try {
    // Create backup first
    result.backupPath = createBackup()

    // Start transaction for atomic migration
    const migrate = db.transaction(() => {
      // ============ Migrate Config ============
      try {
        const configPath = getConfigPath()
        if (existsSync(configPath)) {
          const config = require('fs').readFileSync(configPath, 'utf8')
          const parsed = JSON.parse(config) as Partial<AppConfig>
          const merged = { ...DEFAULT_CONFIG, ...parsed }

          db.prepare(`
            INSERT OR REPLACE INTO config (
              id, claude_code_path, selected_agent_id, agents,
              max_concurrent_tasks, max_task_duration_minutes,
              rate_limit_check_interval_seconds, auto_play_usage_threshold,
              default_scan_paths, theme, notifications, sync, archive_retention_days
            ) VALUES (
              1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
          `).run(
            merged.claudeCodePath,
            merged.selectedAgentId,
            JSON.stringify(merged.agents),
            merged.maxConcurrentTasks,
            merged.maxTaskDurationMinutes,
            merged.rateLimitCheckIntervalSeconds,
            merged.autoPlayUsageThreshold,
            JSON.stringify(merged.defaultScanPaths),
            merged.theme,
            JSON.stringify(merged.notifications),
            JSON.stringify(merged.sync),
            merged.archiveRetentionDays
          )
          result.migratedItems.config = true
        }
      } catch (e) {
        result.errors.push(`Config migration failed: ${e}`)
      }

      // ============ Migrate Local State ============
      try {
        const localStatePath = getLocalStatePath()
        if (existsSync(localStatePath)) {
          const content = require('fs').readFileSync(localStatePath, 'utf8')
          const state = JSON.parse(content) as LocalState

          db.prepare(`
            INSERT OR REPLACE INTO local_state (
              id, machine_id, project_paths, claude_code_ecosystem, integrations
            ) VALUES (1, ?, ?, ?, ?)
          `).run(
            state.machineId,
            JSON.stringify(state.projectPaths || {}),
            JSON.stringify(state.claudeCodeEcosystem || {}),
            JSON.stringify(state.integrations || {})
          )
          result.migratedItems.localState = true
        }
      } catch (e) {
        result.errors.push(`Local state migration failed: ${e}`)
      }

      // ============ Migrate Projects ============
      try {
        const projectsPath = getProjectsPath()
        if (existsSync(projectsPath)) {
          const content = require('fs').readFileSync(projectsPath, 'utf8')
          const registry = JSON.parse(content) as { projects: Project[] }

          const insertProject = db.prepare(`
            INSERT OR REPLACE INTO projects (
              id, name, git_url, default_branch, default_skills,
              include_claude_md, added_at, icon
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `)

          for (const project of registry.projects || []) {
            insertProject.run(
              project.id,
              project.name,
              project.gitUrl,
              project.defaultBranch,
              JSON.stringify(project.defaultSkills || []),
              project.includeClaudeMd ? 1 : 0,
              project.addedAt,
              project.icon
            )
            result.migratedItems.projects++
          }
        }
      } catch (e) {
        result.errors.push(`Projects migration failed: ${e}`)
      }

      // ============ Migrate Groups ============
      try {
        const groupsPath = getGroupsPath()
        if (existsSync(groupsPath)) {
          const content = require('fs').readFileSync(groupsPath, 'utf8')
          const registry = JSON.parse(content) as { groups: Group[] }

          const insertGroup = db.prepare(`
            INSERT OR REPLACE INTO groups (
              id, name, description, color, icon, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
          `)

          const insertGroupProject = db.prepare(`
            INSERT OR IGNORE INTO group_projects (group_id, project_id)
            VALUES (?, ?)
          `)

          for (const group of registry.groups || []) {
            insertGroup.run(
              group.id,
              group.name,
              group.description,
              group.color,
              group.icon,
              group.createdAt
            )

            for (const projectId of group.projectIds || []) {
              insertGroupProject.run(group.id, projectId)
            }

            result.migratedItems.groups++
          }
        }
      } catch (e) {
        result.errors.push(`Groups migration failed: ${e}`)
      }

      // ============ Migrate Skills ============
      try {
        const skillsPath = getSkillsPath()
        if (existsSync(skillsPath)) {
          const content = require('fs').readFileSync(skillsPath, 'utf8')
          const registry = JSON.parse(content) as SkillsRegistry

          const insertSkill = db.prepare(`
            INSERT OR REPLACE INTO skills (
              id, name, description, prompt, icon, category,
              enabled, is_built_in, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)

          for (const skill of registry.skills || []) {
            insertSkill.run(
              skill.id,
              skill.name,
              skill.description,
              skill.prompt,
              skill.icon,
              skill.category,
              skill.enabled ? 1 : 0,
              skill.isBuiltIn ? 1 : 0,
              skill.createdAt,
              skill.updatedAt
            )
            result.migratedItems.skills++
          }
        }
      } catch (e) {
        result.errors.push(`Skills migration failed: ${e}`)
      }

      // ============ Migrate Tasks ============
      try {
        const tasksDir = getTasksDir()
        if (existsSync(tasksDir)) {
          const projectIds = readdirSync(tasksDir, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)

          const insertTask = db.prepare(`
            INSERT OR REPLACE INTO tasks (
              id, project_id, group_id, prompt, status, queue_position,
              source, source_ref, context_files, include_claude_md, enabled_skills,
              agent_id, model, created_at, started_at, completed_at, exit_code,
              error_message, cost_estimate, runtime_ms, running_session_started_at,
              current_iteration, iterations
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
          `)

          for (const projectId of projectIds) {
            const projectTasksDir = getProjectTasksDir(projectId)
            const taskIds = readdirSync(projectTasksDir, { withFileTypes: true })
              .filter((e) => e.isDirectory())
              .map((e) => e.name)

            for (const taskId of taskIds) {
              const manifestPath = join(projectTasksDir, taskId, 'manifest.json')
              if (existsSync(manifestPath)) {
                const content = require('fs').readFileSync(manifestPath, 'utf8')
                // Parse as unknown since old format may have 'title' field
                const taskRaw = JSON.parse(content) as Record<string, unknown>

                // Combine old title + prompt into new prompt format
                const oldTitle = (taskRaw.title as string) || ''
                const oldPrompt = (taskRaw.prompt as string) || ''
                const combinedPrompt = oldTitle && oldTitle !== oldPrompt
                  ? `${oldTitle}\n\n${oldPrompt}`
                  : oldPrompt

                insertTask.run(
                  taskRaw.id,
                  taskRaw.projectId,
                  taskRaw.groupId,
                  combinedPrompt,
                  taskRaw.status,
                  taskRaw.queuePosition,
                  taskRaw.source || 'manual',
                  taskRaw.sourceRef,
                  JSON.stringify(taskRaw.contextFiles || []),
                  taskRaw.includeClaudeMd ? 1 : 0,
                  JSON.stringify(taskRaw.enabledSkills || []),
                  taskRaw.agentId,
                  taskRaw.model,
                  taskRaw.createdAt,
                  taskRaw.startedAt,
                  taskRaw.completedAt,
                  taskRaw.exitCode,
                  taskRaw.errorMessage,
                  taskRaw.costEstimate,
                  (taskRaw.runtimeMs as number) || 0,
                  taskRaw.runningSessionStartedAt,
                  (taskRaw.currentIteration as number) || 1,
                  JSON.stringify(taskRaw.iterations || [])
                )
                result.migratedItems.tasks++
              }
            }
          }
        }
      } catch (e) {
        result.errors.push(`Tasks migration failed: ${e}`)
      }

      // ============ Migrate Project Memory ============
      try {
        const memoryDir = getMemoryDir()
        if (existsSync(memoryDir)) {
          const projectIds = readdirSync(memoryDir, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)

          const insertMemory = db.prepare(`
            INSERT OR REPLACE INTO project_memory (
              project_id, version, entries, recent_tasks, structure,
              last_session_id, last_compacted_at, stats
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `)

          for (const projectId of projectIds) {
            const memoryPath = join(memoryDir, projectId, 'memory.json')
            if (existsSync(memoryPath)) {
              const content = require('fs').readFileSync(memoryPath, 'utf8')
              const memory = JSON.parse(content) as ProjectMemory

              insertMemory.run(
                memory.projectId,
                memory.version || 1,
                JSON.stringify(memory.entries || []),
                JSON.stringify(memory.recentTasks || []),
                memory.structure ? JSON.stringify(memory.structure) : null,
                memory.lastSessionId,
                memory.lastCompactedAt || new Date().toISOString(),
                JSON.stringify(memory.stats || {})
              )
              result.migratedItems.memories++
            }
          }
        }
      } catch (e) {
        result.errors.push(`Memory migration failed: ${e}`)
      }

      // ============ Migrate Credentials ============
      try {
        const credentialsPath = join(getAppDataDir(), 'credentials.enc.json')
        if (existsSync(credentialsPath)) {
          const content = require('fs').readFileSync(credentialsPath, 'utf8')
          const store = JSON.parse(content) as { credentials: Record<string, string> }

          const insertCredential = db.prepare(`
            INSERT OR REPLACE INTO credentials (key, encrypted_value)
            VALUES (?, ?)
          `)

          for (const [key, value] of Object.entries(store.credentials || {})) {
            insertCredential.run(key, value)
            result.migratedItems.credentials++
          }
        }
      } catch (e) {
        result.errors.push(`Credentials migration failed: ${e}`)
      }
    })

    // Execute migration transaction
    migrate()

    // Clean up JSON files after successful migration
    cleanupJsonFiles()

    result.success = true
    console.log('[Migration] Successfully migrated from JSON to SQLite')
    console.log('[Migration] Items migrated:', result.migratedItems)

  } catch (error) {
    result.errors.push(`Migration failed: ${error}`)
    console.error('[Migration] Migration failed:', error)
  }

  return result
}
