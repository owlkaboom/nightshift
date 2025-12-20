/**
 * SQLite Group Store
 *
 * High-performance group storage using SQLite.
 * Maintains same API as the file-based group store for compatibility.
 * Supports nested group hierarchy with tree operations.
 */

import type { Group, GroupTreeNode } from '@shared/types'
import { createGroup, generateGroupId, MAX_GROUP_NESTING_DEPTH } from '@shared/types'
import { getDatabase, runTransaction } from '@main/storage/database'

// ============ Type Conversions ============

interface GroupRow {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  color: string | null
  icon: string | null
  created_at: string
}

function rowToGroup(row: GroupRow, projectIds: string[]): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    projectIds,
    parentId: row.parent_id,
    color: row.color,
    icon: row.icon,
    createdAt: row.created_at
  }
}

function getGroupProjectIds(db: ReturnType<typeof getDatabase>, groupId: string): string[] {
  const rows = db
    .prepare('SELECT project_id FROM group_projects WHERE group_id = ?')
    .all(groupId) as { project_id: string }[]
  return rows.map((r) => r.project_id)
}

// ============ Core CRUD Operations ============

/**
 * Load all groups
 */
export async function loadGroups(): Promise<Group[]> {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM groups').all() as GroupRow[]

  return rows.map((row) => {
    const projectIds = getGroupProjectIds(db, row.id)
    return rowToGroup(row, projectIds)
  })
}

/**
 * Get a group by ID
 */
export async function getGroup(groupId: string): Promise<Group | null> {
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM groups WHERE id = ?')
    .get(groupId) as GroupRow | undefined

  if (!row) {
    return null
  }

  const projectIds = getGroupProjectIds(db, groupId)
  return rowToGroup(row, projectIds)
}

/**
 * Add a new group
 */
export async function addGroup(
  name: string,
  options: Partial<Omit<Group, 'id' | 'name' | 'createdAt'>> = {}
): Promise<Group> {
  const db = getDatabase()

  // Validate nesting depth if parentId is provided
  if (options.parentId) {
    const isValid = await validateNestingDepth(options.parentId)
    if (!isValid) {
      throw new Error(`Cannot create group: maximum nesting depth of ${MAX_GROUP_NESTING_DEPTH} would be exceeded`)
    }
  }

  const id = generateGroupId()
  const group = createGroup(id, name, options)

  runTransaction(() => {
    // Insert group
    db.prepare(`
      INSERT INTO groups (id, name, description, parent_id, color, icon, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      group.id,
      group.name,
      group.description,
      group.parentId,
      group.color,
      group.icon,
      group.createdAt
    )

    // Insert project associations
    if (options.projectIds && options.projectIds.length > 0) {
      const insertProjectStmt = db.prepare(`
        INSERT INTO group_projects (group_id, project_id) VALUES (?, ?)
      `)
      for (const projectId of options.projectIds) {
        insertProjectStmt.run(group.id, projectId)
      }
    }
  })

  return group
}

/**
 * Update a group
 */
export async function updateGroup(
  groupId: string,
  updates: Partial<Omit<Group, 'id' | 'createdAt'>>
): Promise<Group | null> {
  const db = getDatabase()

  const existing = await getGroup(groupId)
  if (!existing) {
    return null
  }

  // Validate parentId change if provided
  if (updates.parentId !== undefined && updates.parentId !== existing.parentId) {
    // Prevent setting self as parent
    if (updates.parentId === groupId) {
      throw new Error('Cannot set group as its own parent')
    }

    // Prevent circular references (ensure new parent is not a descendant)
    if (updates.parentId !== null) {
      const descendants = await getGroupDescendants(groupId)
      if (descendants.some(d => d.id === updates.parentId)) {
        throw new Error('Cannot set a descendant group as parent (circular reference)')
      }

      // Validate nesting depth
      const isValid = await validateNestingDepthForMove(groupId, updates.parentId)
      if (!isValid) {
        throw new Error(`Cannot move group: maximum nesting depth of ${MAX_GROUP_NESTING_DEPTH} would be exceeded`)
      }
    }
  }

  const updated = { ...existing, ...updates }

  runTransaction(() => {
    // Update group
    db.prepare(`
      UPDATE groups SET
        name = ?,
        description = ?,
        parent_id = ?,
        color = ?,
        icon = ?
      WHERE id = ?
    `).run(
      updated.name,
      updated.description,
      updated.parentId,
      updated.color,
      updated.icon,
      groupId
    )

    // Update project associations if provided
    if (updates.projectIds !== undefined) {
      // Remove all existing associations
      db.prepare('DELETE FROM group_projects WHERE group_id = ?').run(groupId)

      // Add new associations
      if (updates.projectIds.length > 0) {
        const insertProjectStmt = db.prepare(`
          INSERT INTO group_projects (group_id, project_id) VALUES (?, ?)
        `)
        for (const projectId of updates.projectIds) {
          insertProjectStmt.run(groupId, projectId)
        }
      }
    }
  })

  return updated
}

/**
 * Remove a group
 */
export async function removeGroup(groupId: string): Promise<boolean> {
  const db = getDatabase()

  const result = db.prepare('DELETE FROM groups WHERE id = ?').run(groupId)
  // Junction table rows are automatically deleted via ON DELETE CASCADE

  return result.changes > 0
}

/**
 * Add a project to a group
 */
export async function addProjectToGroup(
  groupId: string,
  projectId: string
): Promise<Group | null> {
  const db = getDatabase()

  const group = await getGroup(groupId)
  if (!group) {
    return null
  }

  // Check if already exists
  if (group.projectIds.includes(projectId)) {
    return group
  }

  db.prepare(`
    INSERT OR IGNORE INTO group_projects (group_id, project_id) VALUES (?, ?)
  `).run(groupId, projectId)

  // Return updated group
  return getGroup(groupId)
}

/**
 * Remove a project from a group
 */
export async function removeProjectFromGroup(
  groupId: string,
  projectId: string
): Promise<Group | null> {
  const db = getDatabase()

  const group = await getGroup(groupId)
  if (!group) {
    return null
  }

  db.prepare(`
    DELETE FROM group_projects WHERE group_id = ? AND project_id = ?
  `).run(groupId, projectId)

  // Return updated group
  return getGroup(groupId)
}

/**
 * Remove a project from all groups
 */
export async function removeProjectFromAllGroups(
  projectId: string
): Promise<void> {
  const db = getDatabase()
  db.prepare('DELETE FROM group_projects WHERE project_id = ?').run(projectId)
}

/**
 * Get all groups that contain a project
 */
export async function getGroupsForProject(projectId: string): Promise<Group[]> {
  const db = getDatabase()
  const rows = db
    .prepare(`
      SELECT g.* FROM groups g
      JOIN group_projects gp ON g.id = gp.group_id
      WHERE gp.project_id = ?
    `)
    .all(projectId) as GroupRow[]

  return rows.map((row) => {
    const projectIds = getGroupProjectIds(db, row.id)
    return rowToGroup(row, projectIds)
  })
}

// ============ Tree Operations ============

/**
 * Get all root-level groups (parentId is null)
 */
export async function getRootGroups(): Promise<Group[]> {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT * FROM groups WHERE parent_id IS NULL')
    .all() as GroupRow[]

  return rows.map((row) => {
    const projectIds = getGroupProjectIds(db, row.id)
    return rowToGroup(row, projectIds)
  })
}

/**
 * Get direct children of a group
 */
export async function getChildGroups(parentId: string): Promise<Group[]> {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT * FROM groups WHERE parent_id = ?')
    .all(parentId) as GroupRow[]

  return rows.map((row) => {
    const projectIds = getGroupProjectIds(db, row.id)
    return rowToGroup(row, projectIds)
  })
}

/**
 * Get ancestors of a group (ordered from root to direct parent)
 */
export async function getGroupAncestors(groupId: string): Promise<Group[]> {
  const ancestors: Group[] = []
  let currentGroup = await getGroup(groupId)

  while (currentGroup?.parentId) {
    const parent = await getGroup(currentGroup.parentId)
    if (parent) {
      ancestors.unshift(parent) // Add to beginning to maintain root→parent order
      currentGroup = parent
    } else {
      break
    }
  }

  return ancestors
}

/**
 * Get all descendants of a group (all children, grandchildren, etc.)
 */
export async function getGroupDescendants(groupId: string): Promise<Group[]> {
  const descendants: Group[] = []
  const queue = [groupId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    const children = await getChildGroups(currentId)
    for (const child of children) {
      descendants.push(child)
      queue.push(child.id)
    }
  }

  return descendants
}

/**
 * Get the full group tree starting from root groups
 */
export async function getGroupTree(): Promise<GroupTreeNode[]> {
  const rootGroups = await getRootGroups()
  return buildTreeNodes(rootGroups, 0)
}

/**
 * Build tree nodes recursively
 */
async function buildTreeNodes(groups: Group[], depth: number): Promise<GroupTreeNode[]> {
  const nodes: GroupTreeNode[] = []

  for (const group of groups) {
    const children = await getChildGroups(group.id)
    const childNodes = await buildTreeNodes(children, depth + 1)

    nodes.push({
      ...group,
      children: childNodes,
      depth
    })
  }

  return nodes
}

/**
 * Get the depth of a group (0 = root level)
 */
export async function getGroupDepth(groupId: string): Promise<number> {
  const ancestors = await getGroupAncestors(groupId)
  return ancestors.length
}

/**
 * Validate that creating a child under this parent won't exceed max depth
 */
export async function validateNestingDepth(parentId: string): Promise<boolean> {
  const parentDepth = await getGroupDepth(parentId)
  // New child would be at parentDepth + 1
  // Max depth is MAX_GROUP_NESTING_DEPTH - 1 (0-indexed)
  return parentDepth + 1 < MAX_GROUP_NESTING_DEPTH
}

/**
 * Validate that moving a group to a new parent won't exceed max depth
 * Considers both the group's own descendants and the new parent's depth
 */
export async function validateNestingDepthForMove(
  groupId: string,
  newParentId: string
): Promise<boolean> {
  // Get depth of new parent
  const newParentDepth = await getGroupDepth(newParentId)

  // Get max depth among the group's descendants
  const descendants = await getGroupDescendants(groupId)
  let maxDescendantLevels = 0
  for (const descendant of descendants) {
    const descendantDepth = await getGroupDepth(descendant.id)
    const currentGroupDepth = await getGroupDepth(groupId)
    const relativeDepth = descendantDepth - currentGroupDepth
    maxDescendantLevels = Math.max(maxDescendantLevels, relativeDepth)
  }

  // New position would put the group at newParentDepth + 1
  // And deepest descendant at newParentDepth + 1 + maxDescendantLevels
  const deepestLevel = newParentDepth + 1 + maxDescendantLevels
  return deepestLevel < MAX_GROUP_NESTING_DEPTH
}

/**
 * Move a group to a new parent (or to root level if newParentId is null)
 */
export async function moveGroup(
  groupId: string,
  newParentId: string | null
): Promise<Group | null> {
  return updateGroup(groupId, { parentId: newParentId })
}

/**
 * Get all projects in a group tree (including descendants)
 */
export async function getProjectsInGroupTree(groupId: string): Promise<string[]> {
  const group = await getGroup(groupId)
  if (!group) return []

  const projectIds = new Set<string>(group.projectIds)

  const descendants = await getGroupDescendants(groupId)
  for (const descendant of descendants) {
    for (const projectId of descendant.projectIds) {
      projectIds.add(projectId)
    }
  }

  return Array.from(projectIds)
}
