/**
 * Group store for ~/.nightshift/sync/groups.json
 */

import type { Group, GroupsRegistry } from '@shared/types'
import { createGroup, generateGroupId } from '@shared/types'
import { getGroupsPath } from '@main/utils/paths'
import { readJsonWithDefault, writeJson } from './file-store'

const DEFAULT_REGISTRY: GroupsRegistry = { groups: [] }

/**
 * Load all groups
 */
export async function loadGroups(): Promise<Group[]> {
  const path = getGroupsPath()
  const registry = await readJsonWithDefault(path, DEFAULT_REGISTRY)
  return registry.groups
}

/**
 * Save all groups
 */
async function saveGroups(groups: Group[]): Promise<void> {
  const path = getGroupsPath()
  await writeJson(path, { groups })
}

/**
 * Get a group by ID
 */
export async function getGroup(groupId: string): Promise<Group | null> {
  const groups = await loadGroups()
  return groups.find((g) => g.id === groupId) ?? null
}

/**
 * Add a new group
 */
export async function addGroup(
  name: string,
  options: Partial<Omit<Group, 'id' | 'name' | 'createdAt'>> = {}
): Promise<Group> {
  const groups = await loadGroups()

  const id = generateGroupId()
  const group = createGroup(id, name, options)

  groups.push(group)
  await saveGroups(groups)

  return group
}

/**
 * Update a group
 */
export async function updateGroup(
  groupId: string,
  updates: Partial<Omit<Group, 'id' | 'createdAt'>>
): Promise<Group | null> {
  const groups = await loadGroups()
  const index = groups.findIndex((g) => g.id === groupId)

  if (index === -1) {
    return null
  }

  const updated = { ...groups[index], ...updates }
  groups[index] = updated
  await saveGroups(groups)

  return updated
}

/**
 * Remove a group
 */
export async function removeGroup(groupId: string): Promise<boolean> {
  const groups = await loadGroups()
  const index = groups.findIndex((g) => g.id === groupId)

  if (index === -1) {
    return false
  }

  groups.splice(index, 1)
  await saveGroups(groups)

  return true
}

/**
 * Add a project to a group
 */
export async function addProjectToGroup(
  groupId: string,
  projectId: string
): Promise<Group | null> {
  const groups = await loadGroups()
  const index = groups.findIndex((g) => g.id === groupId)

  if (index === -1) {
    return null
  }

  const group = groups[index]

  // Don't add duplicate
  if (group.projectIds.includes(projectId)) {
    return group
  }

  group.projectIds.push(projectId)
  await saveGroups(groups)

  return group
}

/**
 * Remove a project from a group
 */
export async function removeProjectFromGroup(
  groupId: string,
  projectId: string
): Promise<Group | null> {
  const groups = await loadGroups()
  const index = groups.findIndex((g) => g.id === groupId)

  if (index === -1) {
    return null
  }

  const group = groups[index]
  const projectIndex = group.projectIds.indexOf(projectId)

  if (projectIndex === -1) {
    return group
  }

  group.projectIds.splice(projectIndex, 1)
  await saveGroups(groups)

  return group
}

/**
 * Remove a project from all groups
 * (Call this when deleting a project)
 */
export async function removeProjectFromAllGroups(
  projectId: string
): Promise<void> {
  const groups = await loadGroups()
  let changed = false

  for (const group of groups) {
    const index = group.projectIds.indexOf(projectId)
    if (index !== -1) {
      group.projectIds.splice(index, 1)
      changed = true
    }
  }

  if (changed) {
    await saveGroups(groups)
  }
}

/**
 * Get all groups that contain a project
 */
export async function getGroupsForProject(projectId: string): Promise<Group[]> {
  const groups = await loadGroups()
  return groups.filter((g) => g.projectIds.includes(projectId))
}
