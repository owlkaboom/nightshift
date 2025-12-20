/**
 * SQLite Local State Store
 *
 * High-performance local state storage using SQLite.
 * Maintains same API as the file-based local state store for compatibility.
 */

import type { LocalState, ProjectEcosystemInfo } from '@shared/types'
import { createDefaultLocalState, generateMachineId } from '@shared/types'
import { getDatabase } from '@main/storage/database'

// ============ Type Conversions ============

interface LocalStateRow {
  id: number
  machine_id: string
  project_paths: string
  claude_code_ecosystem: string
  integrations: string
}

function rowToLocalState(row: LocalStateRow): LocalState {
  return {
    machineId: row.machine_id,
    projectPaths: JSON.parse(row.project_paths),
    claudeCodeEcosystem: JSON.parse(row.claude_code_ecosystem),
    integrations: JSON.parse(row.integrations)
  }
}

function localStateToParams(state: LocalState): Record<string, unknown> {
  return {
    machine_id: state.machineId,
    project_paths: JSON.stringify(state.projectPaths),
    claude_code_ecosystem: JSON.stringify(state.claudeCodeEcosystem),
    integrations: JSON.stringify(state.integrations)
  }
}

// ============ Core Operations ============

/**
 * Load the local state, creating default if it doesn't exist
 */
export async function loadLocalState(): Promise<LocalState> {
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM local_state WHERE id = 1')
    .get() as LocalStateRow | undefined

  if (row) {
    return rowToLocalState(row)
  }

  // Create new local state with generated machine ID
  const newState = createDefaultLocalState(generateMachineId())
  await saveLocalState(newState)
  return newState
}

/**
 * Save the local state
 */
export async function saveLocalState(state: LocalState): Promise<void> {
  const db = getDatabase()
  const params = localStateToParams(state)

  db.prepare(`
    INSERT OR REPLACE INTO local_state (
      id,
      machine_id,
      project_paths,
      claude_code_ecosystem,
      integrations
    ) VALUES (
      1,
      @machine_id,
      @project_paths,
      @claude_code_ecosystem,
      @integrations
    )
  `).run(params)
}

/**
 * Update specific local state fields
 */
export async function updateLocalState(
  updates: Partial<LocalState>
): Promise<LocalState> {
  const current = await loadLocalState()
  const updated = { ...current, ...updates }
  await saveLocalState(updated)
  return updated
}

// ============ Project Paths ============

/**
 * Get the local path for a project
 */
export async function getProjectPath(projectId: string): Promise<string | null> {
  const state = await loadLocalState()
  return state.projectPaths[projectId] ?? null
}

/**
 * Set the local path for a project
 */
export async function setProjectPath(
  projectId: string,
  localPath: string
): Promise<void> {
  const state = await loadLocalState()
  state.projectPaths[projectId] = localPath
  await saveLocalState(state)
}

/**
 * Remove a project path mapping
 */
export async function removeProjectPath(projectId: string): Promise<void> {
  const state = await loadLocalState()
  delete state.projectPaths[projectId]
  await saveLocalState(state)
}

/**
 * Get all project path mappings
 */
export async function getAllProjectPaths(): Promise<Record<string, string>> {
  const state = await loadLocalState()
  return { ...state.projectPaths }
}

// ============ Claude Code Ecosystem ============

/**
 * Get ecosystem info for a project
 */
export async function getProjectEcosystemInfo(
  projectId: string
): Promise<ProjectEcosystemInfo | null> {
  const state = await loadLocalState()
  return state.claudeCodeEcosystem[projectId] ?? null
}

/**
 * Set ecosystem info for a project
 */
export async function setProjectEcosystemInfo(
  projectId: string,
  info: ProjectEcosystemInfo
): Promise<void> {
  const state = await loadLocalState()
  state.claudeCodeEcosystem[projectId] = info
  await saveLocalState(state)
}

/**
 * Remove ecosystem info for a project
 */
export async function removeProjectEcosystemInfo(
  projectId: string
): Promise<void> {
  const state = await loadLocalState()
  delete state.claudeCodeEcosystem[projectId]
  await saveLocalState(state)
}

// ============ Machine ID ============

/**
 * Get the machine ID
 */
export async function getMachineId(): Promise<string> {
  const state = await loadLocalState()
  return state.machineId
}
