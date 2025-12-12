/**
 * Local state store for ~/.nightshift/local-state.json
 * Contains machine-specific data that should NOT be synced
 */

import type { LocalState, ProjectEcosystemInfo } from '@shared/types'
import { createDefaultLocalState, generateMachineId } from '@shared/types'
import { getLocalStatePath } from '../utils/paths'
import { readJson, writeJson } from './file-store'

/**
 * Load the local state, creating default if it doesn't exist
 */
export async function loadLocalState(): Promise<LocalState> {
  const path = getLocalStatePath()
  const state = await readJson<LocalState>(path)

  if (state) {
    return state
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
  const path = getLocalStatePath()
  await writeJson(path, state)
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
