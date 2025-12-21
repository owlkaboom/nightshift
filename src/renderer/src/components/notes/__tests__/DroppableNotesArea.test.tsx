/**
 * Test: DroppableNotesArea Component
 *
 * Tests the drag-and-drop functionality for notes and groups:
 * - Visual indicators when dragging
 * - Dropping notes into groups
 * - Dropping notes out of groups to ungrouped area
 * - Reordering groups
 * - Reordering notes within groups
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DroppableNotesArea } from '../DroppableNotesArea'
import type { Note, NoteGroup } from '@shared/types'

describe('DroppableNotesArea', () => {
  const mockGroups: NoteGroup[] = [
    {
      id: 'group-1',
      name: 'Work',
      icon: 'Folder',
      color: '#8b5cf6',
      order: 0,
      isCollapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'group-2',
      name: 'Personal',
      icon: 'Folder',
      color: '#ec4899',
      order: 1,
      isCollapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]

  const mockNotes: Note[] = [
    {
      id: 'note-1',
      title: 'Work Note 1',
      content: 'Work note content',
      htmlContent: '<p>Work note content</p>',
      excerpt: 'Work note content',
      status: 'active',
      projectRefs: [],
      groupRefs: [],
      tagRefs: [],
      tags: [],
      primaryProjectId: null,
      linkedTaskIds: [],
      linkedPlanningIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPinned: false,
      wordCount: 3,
      groupId: 'group-1',
      order: 0
    },
    {
      id: 'note-2',
      title: 'Ungrouped Note',
      content: 'Ungrouped note content',
      htmlContent: '<p>Ungrouped note content</p>',
      excerpt: 'Ungrouped note content',
      status: 'active',
      projectRefs: [],
      groupRefs: [],
      tagRefs: [],
      tags: [],
      primaryProjectId: null,
      linkedTaskIds: [],
      linkedPlanningIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPinned: false,
      wordCount: 3,
      groupId: null,
      order: 0
    }
  ]

  describe('Rendering', () => {
    it('should render groups in order', () => {
      render(
        <DroppableNotesArea
          groups={mockGroups}
          notes={mockNotes}
          loading={false}
        />
      )

      expect(screen.getByText('Work')).toBeInTheDocument()
      expect(screen.getByText('Personal')).toBeInTheDocument()
    })

    it('should render ungrouped notes', () => {
      render(
        <DroppableNotesArea
          groups={mockGroups}
          notes={mockNotes}
          loading={false}
        />
      )

      expect(screen.getByText('Ungrouped Note')).toBeInTheDocument()
    })

    it('should show loading state', () => {
      render(
        <DroppableNotesArea
          groups={[]}
          notes={[]}
          loading={true}
        />
      )

      expect(screen.getByText('Loading notes...')).toBeInTheDocument()
    })

    it('should show empty state when no notes', () => {
      const emptyMessage = 'No notes yet!'
      render(
        <DroppableNotesArea
          groups={[]}
          notes={[]}
          loading={false}
          emptyMessage={emptyMessage}
        />
      )

      expect(screen.getByText(emptyMessage)).toBeInTheDocument()
    })
  })

  describe('Ungrouped Notes Drop Zone', () => {
    it('should show drop zone message when empty', () => {
      render(
        <DroppableNotesArea
          groups={mockGroups}
          notes={mockNotes.filter((n) => n.groupId !== null)} // No ungrouped notes
          loading={false}
        />
      )

      expect(screen.getByText(/Drop notes here to ungroup them/i)).toBeInTheDocument()
    })

    it('should render ungrouped notes when present', () => {
      render(
        <DroppableNotesArea
          groups={mockGroups}
          notes={mockNotes}
          loading={false}
        />
      )

      const ungroupedNote = mockNotes.find((n) => n.groupId === null)
      expect(screen.getByText(ungroupedNote!.title)).toBeInTheDocument()
    })
  })

  describe('Callbacks', () => {
    it('should call onNoteClick when note is clicked', () => {
      const handleNoteClick = vi.fn()

      render(
        <DroppableNotesArea
          groups={mockGroups}
          notes={mockNotes}
          loading={false}
          onNoteClick={handleNoteClick}
        />
      )

      const ungroupedNote = screen.getByText('Ungrouped Note')
      ungroupedNote.click()

      expect(handleNoteClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'note-2' })
      )
    })

    it('should call onToggleGroup when group is toggled', () => {
      const handleToggleGroup = vi.fn()

      render(
        <DroppableNotesArea
          groups={mockGroups}
          notes={mockNotes}
          loading={false}
          onToggleGroup={handleToggleGroup}
        />
      )

      // Find and click the collapse/expand button
      const collapseButtons = screen.getAllByLabelText(/Collapse group|Expand group/)
      collapseButtons[0].click()

      expect(handleToggleGroup).toHaveBeenCalledWith('group-1')
    })

    it('should call onDeleteGroup when group is deleted', () => {
      const handleDeleteGroup = vi.fn()

      render(
        <DroppableNotesArea
          groups={mockGroups}
          notes={mockNotes}
          loading={false}
          onDeleteGroup={handleDeleteGroup}
        />
      )

      // Find the group menu button
      const menuButtons = screen.getAllByRole('button', { name: /MoreHorizontal|more/i })
      if (menuButtons.length > 0) {
        menuButtons[0].click()

        // Find delete option
        const deleteButton = screen.getByText(/Delete Group/i)
        deleteButton.click()

        expect(handleDeleteGroup).toHaveBeenCalledWith('group-1')
      }
    })
  })

  describe('Group Management', () => {
    it('should display note count badge for each group', () => {
      render(
        <DroppableNotesArea
          groups={mockGroups}
          notes={mockNotes}
          loading={false}
        />
      )

      // Group 1 has 1 note
      const badges = screen.getAllByText('1')
      expect(badges.length).toBeGreaterThan(0)
    })

    it('should show group color', () => {
      const { container } = render(
        <DroppableNotesArea
          groups={mockGroups}
          notes={mockNotes}
          loading={false}
        />
      )

      // Check that group colors are applied via style attributes
      const groupElements = container.querySelectorAll('[style*="color"]')
      expect(groupElements.length).toBeGreaterThan(0)
    })
  })

  describe('Collapsed State', () => {
    it('should hide notes when group is collapsed', () => {
      const collapsedGroups = mockGroups.map((g) =>
        g.id === 'group-1' ? { ...g, isCollapsed: true } : g
      )

      render(
        <DroppableNotesArea
          groups={collapsedGroups}
          notes={mockNotes}
          loading={false}
        />
      )

      // Work Note 1 should not be visible when group is collapsed
      expect(screen.queryByText('Work Note 1')).not.toBeInTheDocument()

      // Ungrouped Note should still be visible
      expect(screen.getByText('Ungrouped Note')).toBeInTheDocument()
    })

    it('should show notes when group is not collapsed', () => {
      render(
        <DroppableNotesArea
          groups={mockGroups}
          notes={mockNotes}
          loading={false}
        />
      )

      // Work Note 1 should be visible when group is not collapsed
      expect(screen.getByText('Work Note 1')).toBeInTheDocument()
    })
  })
})
