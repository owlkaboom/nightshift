/**
 * SQLite Note Groups Store
 *
 * High-performance note group storage using SQLite.
 * Provides folder-like organization for notes.
 */

import type { NoteGroup, CreateNoteGroupData } from '@shared/types/note'
import { createNoteGroup } from '@shared/types/note'
import { getDatabase, runTransaction } from '@main/storage/database'

// ============ Type Conversions ============

interface NoteGroupRow {
  id: string
  name: string
  icon: string | null
  color: string | null
  order: number
  is_collapsed: number
  created_at: string
  updated_at: string
}

function rowToNoteGroup(row: NoteGroupRow): NoteGroup {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    order: row.order,
    isCollapsed: row.is_collapsed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function noteGroupToParams(group: NoteGroup): Record<string, unknown> {
  return {
    id: group.id,
    name: group.name,
    icon: group.icon,
    color: group.color,
    order: group.order,
    is_collapsed: group.isCollapsed ? 1 : 0,
    created_at: group.createdAt,
    updated_at: group.updatedAt
  }
}

// ============ Core Operations ============

/**
 * Get all note groups ordered by their order field
 */
export async function getAllNoteGroups(): Promise<NoteGroup[]> {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM note_groups ORDER BY "order" ASC').all() as NoteGroupRow[]
  return rows.map(rowToNoteGroup)
}

/**
 * Get a note group by ID
 */
export async function getNoteGroup(id: string): Promise<NoteGroup | null> {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM note_groups WHERE id = ?').get(id) as NoteGroupRow | undefined
  return row ? rowToNoteGroup(row) : null
}

/**
 * Create a new note group
 */
export async function createNoteGroupRecord(data: CreateNoteGroupData): Promise<NoteGroup> {
  const db = getDatabase()

  // Get the max order to append to the end
  const maxOrder = db.prepare('SELECT MAX("order") as maxOrder FROM note_groups').get() as { maxOrder: number | null }
  const newOrder = (maxOrder.maxOrder ?? -1) + 1

  const group = createNoteGroup(data)
  group.order = newOrder

  const insertStmt = db.prepare(`
    INSERT INTO note_groups (
      id, name, icon, color, "order", is_collapsed, created_at, updated_at
    ) VALUES (
      @id, @name, @icon, @color, @order, @is_collapsed, @created_at, @updated_at
    )
  `)

  insertStmt.run(noteGroupToParams(group))
  return group
}

/**
 * Update a note group
 */
export async function updateNoteGroup(
  id: string,
  updates: Partial<Omit<NoteGroup, 'id' | 'createdAt'>>
): Promise<NoteGroup | null> {
  const db = getDatabase()

  const existing = await getNoteGroup(id)
  if (!existing) return null

  const updated: NoteGroup = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  }

  const updateStmt = db.prepare(`
    UPDATE note_groups
    SET name = @name,
        icon = @icon,
        color = @color,
        "order" = @order,
        is_collapsed = @is_collapsed,
        updated_at = @updated_at
    WHERE id = @id
  `)

  updateStmt.run(noteGroupToParams(updated))
  return updated
}

/**
 * Delete a note group
 * Notes in this group will have their groupId set to NULL
 *
 * NOTE: Notes are stored in markdown files in the vault, not in SQLite.
 * The vault-store handles updating the notes' groupId field.
 * This function only deletes the group record from SQLite.
 */
export async function deleteNoteGroup(id: string): Promise<boolean> {
  const db = getDatabase()

  // Delete the group from SQLite
  db.prepare('DELETE FROM note_groups WHERE id = ?').run(id)

  return true
}

/**
 * Reorder note groups
 * Updates the order field for multiple groups at once
 */
export async function reorderNoteGroups(groupOrders: Array<{ id: string; order: number }>): Promise<void> {
  const db = getDatabase()

  runTransaction(() => {
    const updateStmt = db.prepare(`
      UPDATE note_groups
      SET "order" = @order, updated_at = @updated_at
      WHERE id = @id
    `)

    const now = new Date().toISOString()
    for (const { id, order } of groupOrders) {
      updateStmt.run({ id, order, updated_at: now })
    }
  })
}

/**
 * Toggle the collapsed state of a note group
 */
export async function toggleNoteGroupCollapsed(id: string): Promise<NoteGroup | null> {
  const db = getDatabase()

  const existing = await getNoteGroup(id)
  if (!existing) return null

  const updated: NoteGroup = {
    ...existing,
    isCollapsed: !existing.isCollapsed,
    updatedAt: new Date().toISOString()
  }

  const updateStmt = db.prepare(`
    UPDATE note_groups
    SET is_collapsed = @is_collapsed, updated_at = @updated_at
    WHERE id = @id
  `)

  updateStmt.run({
    id: updated.id,
    is_collapsed: updated.isCollapsed ? 1 : 0,
    updated_at: updated.updatedAt
  })

  return updated
}
