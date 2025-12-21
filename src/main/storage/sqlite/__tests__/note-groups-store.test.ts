/**
 * Test: Note Groups Store
 *
 * Tests the SQLite note groups store functionality:
 * - Creating note groups
 * - Updating note groups
 * - Deleting note groups
 * - Reordering note groups
 * - Toggling collapsed state
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initializeDatabase, closeDatabase } from '@main/storage/database'
import * as noteGroupsStore from '../note-groups-store'
import type { CreateNoteGroupData } from '@shared/types/note'

describe('Note Groups Store', () => {
  beforeEach(async () => {
    // Initialize in-memory database for testing
    await initializeDatabase(':memory:')
  })

  afterEach(async () => {
    await closeDatabase()
  })

  describe('createNoteGroupRecord', () => {
    it('should create a note group with default values', async () => {
      const data: CreateNoteGroupData = {
        name: 'Test Group',
        icon: 'Folder',
        color: '#8b5cf6'
      }

      const group = await noteGroupsStore.createNoteGroupRecord(data)

      expect(group.id).toBeDefined()
      expect(group.name).toBe('Test Group')
      expect(group.icon).toBe('Folder')
      expect(group.color).toBe('#8b5cf6')
      expect(group.order).toBe(0) // First group gets order 0
      expect(group.isCollapsed).toBe(false)
      expect(group.createdAt).toBeDefined()
      expect(group.updatedAt).toBeDefined()
    })

    it('should assign incrementing order values to new groups', async () => {
      const group1 = await noteGroupsStore.createNoteGroupRecord({
        name: 'Group 1'
      })
      const group2 = await noteGroupsStore.createNoteGroupRecord({
        name: 'Group 2'
      })
      const group3 = await noteGroupsStore.createNoteGroupRecord({
        name: 'Group 3'
      })

      expect(group1.order).toBe(0)
      expect(group2.order).toBe(1)
      expect(group3.order).toBe(2)
    })
  })

  describe('getAllNoteGroups', () => {
    it('should return empty array when no groups exist', async () => {
      const groups = await noteGroupsStore.getAllNoteGroups()
      expect(groups).toEqual([])
    })

    it('should return all groups ordered by order field', async () => {
      await noteGroupsStore.createNoteGroupRecord({ name: 'Group 1' })
      await noteGroupsStore.createNoteGroupRecord({ name: 'Group 2' })
      await noteGroupsStore.createNoteGroupRecord({ name: 'Group 3' })

      const groups = await noteGroupsStore.getAllNoteGroups()

      expect(groups).toHaveLength(3)
      expect(groups[0].name).toBe('Group 1')
      expect(groups[1].name).toBe('Group 2')
      expect(groups[2].name).toBe('Group 3')
    })
  })

  describe('getNoteGroup', () => {
    it('should return null when group does not exist', async () => {
      const group = await noteGroupsStore.getNoteGroup('non-existent-id')
      expect(group).toBeNull()
    })

    it('should return group when it exists', async () => {
      const created = await noteGroupsStore.createNoteGroupRecord({
        name: 'Test Group',
        color: '#ec4899'
      })

      const fetched = await noteGroupsStore.getNoteGroup(created.id)

      expect(fetched).not.toBeNull()
      expect(fetched?.id).toBe(created.id)
      expect(fetched?.name).toBe('Test Group')
      expect(fetched?.color).toBe('#ec4899')
    })
  })

  describe('updateNoteGroup', () => {
    it('should return null when group does not exist', async () => {
      const updated = await noteGroupsStore.updateNoteGroup('non-existent-id', {
        name: 'New Name'
      })
      expect(updated).toBeNull()
    })

    it('should update group name', async () => {
      const created = await noteGroupsStore.createNoteGroupRecord({
        name: 'Original Name'
      })

      const updated = await noteGroupsStore.updateNoteGroup(created.id, {
        name: 'Updated Name'
      })

      expect(updated).not.toBeNull()
      expect(updated?.name).toBe('Updated Name')
      expect(updated?.updatedAt).not.toBe(created.updatedAt)
    })

    it('should update group color', async () => {
      const created = await noteGroupsStore.createNoteGroupRecord({
        name: 'Test Group',
        color: '#8b5cf6'
      })

      const updated = await noteGroupsStore.updateNoteGroup(created.id, {
        color: '#ec4899'
      })

      expect(updated?.color).toBe('#ec4899')
    })

    it('should update isCollapsed state', async () => {
      const created = await noteGroupsStore.createNoteGroupRecord({
        name: 'Test Group'
      })

      expect(created.isCollapsed).toBe(false)

      const updated = await noteGroupsStore.updateNoteGroup(created.id, {
        isCollapsed: true
      })

      expect(updated?.isCollapsed).toBe(true)
    })
  })

  describe('deleteNoteGroup', () => {
    it('should delete a group', async () => {
      const created = await noteGroupsStore.createNoteGroupRecord({
        name: 'Test Group'
      })

      const success = await noteGroupsStore.deleteNoteGroup(created.id)
      expect(success).toBe(true)

      const fetched = await noteGroupsStore.getNoteGroup(created.id)
      expect(fetched).toBeNull()
    })

    it('should return true even when group does not exist', async () => {
      const success = await noteGroupsStore.deleteNoteGroup('non-existent-id')
      expect(success).toBe(true)
    })
  })

  describe('reorderNoteGroups', () => {
    it('should reorder groups', async () => {
      const group1 = await noteGroupsStore.createNoteGroupRecord({ name: 'Group 1' })
      const group2 = await noteGroupsStore.createNoteGroupRecord({ name: 'Group 2' })
      const group3 = await noteGroupsStore.createNoteGroupRecord({ name: 'Group 3' })

      // Reverse the order
      await noteGroupsStore.reorderNoteGroups([
        { id: group3.id, order: 0 },
        { id: group2.id, order: 1 },
        { id: group1.id, order: 2 }
      ])

      const groups = await noteGroupsStore.getAllNoteGroups()
      expect(groups[0].id).toBe(group3.id)
      expect(groups[1].id).toBe(group2.id)
      expect(groups[2].id).toBe(group1.id)
    })

    it('should update updatedAt timestamp when reordering', async () => {
      const group = await noteGroupsStore.createNoteGroupRecord({ name: 'Test Group' })
      const originalUpdatedAt = group.updatedAt

      // Wait a moment to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10))

      await noteGroupsStore.reorderNoteGroups([{ id: group.id, order: 5 }])

      const updated = await noteGroupsStore.getNoteGroup(group.id)
      expect(updated?.order).toBe(5)
      expect(updated?.updatedAt).not.toBe(originalUpdatedAt)
    })
  })

  describe('toggleNoteGroupCollapsed', () => {
    it('should toggle collapsed state from false to true', async () => {
      const created = await noteGroupsStore.createNoteGroupRecord({
        name: 'Test Group'
      })

      expect(created.isCollapsed).toBe(false)

      const toggled = await noteGroupsStore.toggleNoteGroupCollapsed(created.id)

      expect(toggled?.isCollapsed).toBe(true)
    })

    it('should toggle collapsed state from true to false', async () => {
      const created = await noteGroupsStore.createNoteGroupRecord({
        name: 'Test Group'
      })

      // First toggle to true
      await noteGroupsStore.toggleNoteGroupCollapsed(created.id)

      // Then toggle back to false
      const toggled = await noteGroupsStore.toggleNoteGroupCollapsed(created.id)

      expect(toggled?.isCollapsed).toBe(false)
    })

    it('should return null when group does not exist', async () => {
      const result = await noteGroupsStore.toggleNoteGroupCollapsed('non-existent-id')
      expect(result).toBeNull()
    })

    it('should update updatedAt timestamp when toggling', async () => {
      const created = await noteGroupsStore.createNoteGroupRecord({
        name: 'Test Group'
      })
      const originalUpdatedAt = created.updatedAt

      // Wait a moment to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10))

      const toggled = await noteGroupsStore.toggleNoteGroupCollapsed(created.id)

      expect(toggled?.updatedAt).not.toBe(originalUpdatedAt)
    })
  })
})
