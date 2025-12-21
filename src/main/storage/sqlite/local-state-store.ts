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
// DEPRECATED: Project paths are now stored directly on the Project object
// The local_state.project_paths field is kept for backward compatibility during migration
// but should not be used for new code

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
