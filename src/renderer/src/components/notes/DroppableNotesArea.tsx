/**
 * DroppableNotesArea - Drag-and-drop enabled notes list with groups
 *
 * Allows reordering of both groups and notes within groups.
 * Architecture follows the TaskBoard pattern:
 * - Groups are sortable at the top level
 * - Each group has its own SortableContext for notes
 * - Notes can be dragged between groups
 */

import { useState, useMemo, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { RefreshCw, FileText } from 'lucide-react'
import type { Note, NoteGroup } from '@shared/types'
import { SortableNoteGroup } from './SortableNoteGroup'
import { SortableNoteCard } from './SortableNoteCard'

/**
 * Custom collision detection that properly handles notes vs groups
 * Similar to TaskBoard's custom collision detection
 */
const customCollisionDetection: CollisionDetection = (args) => {
  // First check pointer collisions
  const pointerCollisions = pointerWithin(args)

  if (pointerCollisions.length > 0) {
    // Separate note and group collisions
    const noteCollisions = pointerCollisions.filter((collision) => {
      const data = args.droppableContainers.find(c => c.id === collision.id)?.data.current
      return data?.type === 'note'
    })

    const groupCollisions = pointerCollisions.filter((collision) => {
      const data = args.droppableContainers.find(c => c.id === collision.id)?.data.current
      return data?.type === 'group' || data?.type === 'ungrouped-area'
    })

    // Prefer note collisions when dragging a note (for reordering)
    const activeData = args.active.data.current
    if (activeData?.type === 'note') {
      // If we have note collisions, use those for precise positioning
      if (noteCollisions.length > 0) {
        return noteCollisions
      }
      // Otherwise use group collisions for dropping into groups
      if (groupCollisions.length > 0) {
        return groupCollisions
      }
    }

    // For group drags, prefer group collisions
    if (activeData?.type === 'group') {
      if (groupCollisions.length > 0) {
        return groupCollisions.filter(c => {
          const data = args.droppableContainers.find(container => container.id === c.id)?.data.current
          return data?.type === 'group'
        })
      }
    }

    return pointerCollisions
  }

  // Fallback to rect intersection
  const intersectionCollisions = rectIntersection(args)
  if (intersectionCollisions.length > 0) {
    return intersectionCollisions
  }

  // Final fallback
  return closestCenter(args)
}

interface DroppableNotesAreaProps {
  /** All note groups */
  groups: NoteGroup[]

  /** All notes */
  notes: Note[]

  /** Loading state */
  loading?: boolean

  /** Selected note ID */
  selectedNoteId?: string | null

  /** Callback when a note is clicked */
  onNoteClick?: (note: Note) => void

  /** Callback when a note pin is toggled */
  onTogglePin?: (noteId: string) => void

  /** Callback when a note is archived */
  onArchive?: (noteId: string) => void

  /** Callback when a note is unarchived */
  onUnarchive?: (noteId: string) => void

  /** Callback when a note is deleted */
  onDelete?: (noteId: string) => void

  /** Callback when a group is toggled */
  onToggleGroup?: (groupId: string) => void

  /** Callback when a group is updated */
  onUpdateGroup?: (groupId: string, updates: Partial<NoteGroup>) => Promise<NoteGroup | null>

  /** Callback when a group is deleted */
  onDeleteGroup?: (groupId: string) => void

  /** Callback when notes are reordered */
  onReorderNotes?: (noteOrders: Array<{ id: string; order: number; groupId: string | null }>) => void

  /** Callback when groups are reordered */
  onReorderGroups?: (groupOrders: Array<{ id: string; order: number }>) => void

  /** Active filter tab */
  activeTab?: string

  /** Empty message */
  emptyMessage?: string
}

export function DroppableNotesArea({
  groups,
  notes,
  loading = false,
  selectedNoteId,
  onNoteClick,
  onTogglePin,
  onArchive,
  onUnarchive,
  onDelete,
  onToggleGroup,
  onUpdateGroup,
  onDeleteGroup,
  onReorderNotes,
  onReorderGroups,
  activeTab = 'all',
  emptyMessage = 'No notes yet. Create your first note!'
}: DroppableNotesAreaProps) {
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [, setActiveGroup] = useState<NoteGroup | null>(null)

  // Organize notes by groups
  const { groupedNotes, ungroupedNotes } = useMemo(() => {
    const grouped = new Map<string, Note[]>()
    const ungrouped: Note[] = []

    notes.forEach((note) => {
      if (note.groupId) {
        const existing = grouped.get(note.groupId) || []
        grouped.set(note.groupId, [...existing, note])
      } else {
        ungrouped.push(note)
      }
    })

    // Sort notes within each group
    grouped.forEach((groupNotes, groupId) => {
      grouped.set(groupId, groupNotes.sort((a, b) => a.order - b.order))
    })

    return {
      groupedNotes: grouped,
      ungroupedNotes: ungrouped.sort((a, b) => a.order - b.order)
    }
  }, [notes])

  // Sort groups - must be memoized before being used in callbacks
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => a.order - b.order)
  }, [groups])

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // Require 8px movement before drag starts
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeData = event.active.data.current
    if (activeData?.type === 'note') {
      setActiveNote(activeData.note as Note)
    } else if (activeData?.type === 'group') {
      setActiveGroup(activeData.group as NoteGroup)
    }
  }, [])

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // We rely on collision detection for this now
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveNote(null)
    setActiveGroup(null)

    if (!over || active.id === over.id) {
      return
    }

    const activeData = active.data.current
    const overData = over.data.current

    // Handle group reordering (including reordering among ungrouped notes)
    if (activeData?.type === 'group') {
      // Check if we're dropping on a group or an ungrouped note
      if (overData?.type === 'group' || overData?.type === 'note') {
        // Build combined list of items at top level (groups + ungrouped notes)
        const topLevelItems: Array<{ id: string; order: number; type: 'group' | 'note' }> = []

        sortedGroups.forEach(group => {
          topLevelItems.push({ id: group.id, order: group.order, type: 'group' })
        })

        ungroupedNotes.forEach(note => {
          topLevelItems.push({ id: note.id, order: note.order, type: 'note' })
        })

        topLevelItems.sort((a, b) => a.order - b.order)

        const oldIndex = topLevelItems.findIndex((item) => item.id === active.id)
        const newIndex = topLevelItems.findIndex((item) => item.id === over.id)

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          // Reorder the array
          const reordered = [...topLevelItems]
          const [movedItem] = reordered.splice(oldIndex, 1)
          reordered.splice(newIndex, 0, movedItem)

          // Generate new order values
          const updates: Array<{ id: string; order: number; type: 'group' | 'note' }> = reordered.map((item, idx) => ({
            id: item.id,
            order: idx * 1000,
            type: item.type
          }))

          // Apply group updates
          const groupUpdates = updates.filter(u => u.type === 'group')
          if (groupUpdates.length > 0 && onReorderGroups) {
            onReorderGroups(groupUpdates.map(u => ({ id: u.id, order: u.order })))
          }

          // Apply note updates (for ungrouped notes that got reordered)
          const noteUpdates = updates.filter(u => u.type === 'note')
          if (noteUpdates.length > 0 && onReorderNotes) {
            onReorderNotes(noteUpdates.map(u => ({ id: u.id, order: u.order, groupId: null })))
          }
        }
      }
      return
    }

    // Handle note operations
    if (activeData?.type === 'note') {
      const draggedNote = activeData.note as Note

      // Moving to ungrouped area (drop zone)
      if (overData?.type === 'ungrouped-area') {
        if (onReorderNotes) {
          onReorderNotes([{
            id: draggedNote.id,
            order: ungroupedNotes.length * 1000, // Add to end of ungrouped notes
            groupId: null
          }])
        }
        return
      }

      // Moving to a group (drop on group header/body)
      if (overData?.type === 'group') {
        const targetGroupId = over.id as string
        const targetGroupNotes = groupedNotes.get(targetGroupId) || []

        if (onReorderNotes) {
          onReorderNotes([{
            id: draggedNote.id,
            order: targetGroupNotes.length * 1000, // Add to end of group
            groupId: targetGroupId
          }])
        }
        return
      }

      // Moving to position relative to another note
      if (overData?.type === 'note') {
        const overNote = overData.note as Note

        // Same group or both ungrouped - reorder within
        if (draggedNote.groupId === overNote.groupId) {
          const relevantNotes = draggedNote.groupId
            ? (groupedNotes.get(draggedNote.groupId) || [])
            : ungroupedNotes

          const oldIndex = relevantNotes.findIndex((n) => n.id === active.id)
          const newIndex = relevantNotes.findIndex((n) => n.id === over.id)

          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex && onReorderNotes) {
            // If both notes are ungrouped, we need to handle this in the context of all top-level items
            if (!draggedNote.groupId && !overNote.groupId) {
              // Build combined list of items at top level (groups + ungrouped notes)
              const topLevelItems: Array<{ id: string; order: number; type: 'group' | 'note' }> = []

              sortedGroups.forEach(group => {
                topLevelItems.push({ id: group.id, order: group.order, type: 'group' })
              })

              ungroupedNotes.forEach(note => {
                topLevelItems.push({ id: note.id, order: note.order, type: 'note' })
              })

              topLevelItems.sort((a, b) => a.order - b.order)

              const topOldIndex = topLevelItems.findIndex((item) => item.id === active.id)
              const topNewIndex = topLevelItems.findIndex((item) => item.id === over.id)

              if (topOldIndex !== -1 && topNewIndex !== -1 && topOldIndex !== topNewIndex) {
                // Reorder the array
                const reordered = [...topLevelItems]
                const [movedItem] = reordered.splice(topOldIndex, 1)
                reordered.splice(topNewIndex, 0, movedItem)

                // Generate new order values for all items
                const updates: Array<{ id: string; order: number; type: 'group' | 'note' }> = reordered.map((item, idx) => ({
                  id: item.id,
                  order: idx * 1000,
                  type: item.type
                }))

                // Apply group updates
                const groupUpdates = updates.filter(u => u.type === 'group')
                if (groupUpdates.length > 0 && onReorderGroups) {
                  onReorderGroups(groupUpdates.map(u => ({ id: u.id, order: u.order })))
                }

                // Apply note updates
                const noteUpdates = updates.filter(u => u.type === 'note')
                if (noteUpdates.length > 0) {
                  onReorderNotes(noteUpdates.map(u => ({ id: u.id, order: u.order, groupId: null })))
                }
              }
            } else {
              // Notes within a group - simple reorder
              const reordered = [...relevantNotes]
              const [movedNote] = reordered.splice(oldIndex, 1)
              reordered.splice(newIndex, 0, movedNote)

              // Generate new order values with spacing
              const noteOrders = reordered.map((note, idx) => ({
                id: note.id,
                order: idx * 1000,
                groupId: note.groupId
              }))

              onReorderNotes(noteOrders)
            }
          }
        } else {
          // Moving to different group - insert at the position of the target note
          if (onReorderNotes) {
            const targetGroupId = overNote.groupId
            const targetGroupNotes = targetGroupId
              ? (groupedNotes.get(targetGroupId) || [])
              : ungroupedNotes

            const targetIndex = targetGroupNotes.findIndex((n) => n.id === over.id)

            // Calculate order to insert at the target position
            const order = targetIndex >= 0 ? targetIndex * 1000 : targetGroupNotes.length * 1000

            onReorderNotes([{
              id: draggedNote.id,
              order,
              groupId: targetGroupId
            }])
          }
        }
      }
    }
  }, [sortedGroups, groupedNotes, ungroupedNotes, onReorderGroups, onReorderNotes])

  // Build a combined list of sortable items (groups and ungrouped notes)
  const sortableItems = useMemo(() => {
    const items: Array<{ id: string; order: number; type: 'group' | 'note' }> = []

    // Add groups
    sortedGroups.forEach(group => {
      items.push({ id: group.id, order: group.order, type: 'group' })
    })

    // Add ungrouped notes
    ungroupedNotes.forEach(note => {
      items.push({ id: note.id, order: note.order, type: 'note' })
    })

    // Sort by order to interleave groups and notes
    return items.sort((a, b) => a.order - b.order)
  }, [sortedGroups, ungroupedNotes])

  const sortableIds = sortableItems.map(item => item.id)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin mb-3" />
        <p className="text-muted-foreground text-sm">Loading notes...</p>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground text-center mb-4">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* Unified sortable context for both groups and ungrouped notes */}
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col space-y-2">
          {sortableItems.map((item) => {
            if (item.type === 'group') {
              const group = sortedGroups.find(g => g.id === item.id)
              if (!group) return null

              const groupNotes = groupedNotes.get(group.id) || []
              if (groupNotes.length === 0 && activeTab !== 'all') {
                return null
              }

              return (
                <SortableNoteGroup
                  key={group.id}
                  group={group}
                  notes={groupNotes}
                  selectedNoteId={selectedNoteId}
                  onToggle={onToggleGroup}
                  onNoteClick={onNoteClick}
                  onTogglePin={onTogglePin}
                  onArchive={onArchive}
                  onUnarchive={onUnarchive}
                  onDelete={onDelete}
                  onUpdateGroup={onUpdateGroup}
                  onDeleteGroup={onDeleteGroup}
                />
              )
            } else {
              // Ungrouped note
              const note = ungroupedNotes.find(n => n.id === item.id)
              if (!note) return null

              return (
                <SortableNoteCard
                  key={note.id}
                  note={note}
                  isSelected={note.id === selectedNoteId}
                  onClick={() => onNoteClick?.(note)}
                  onTogglePin={() => onTogglePin?.(note.id)}
                  onArchive={() => onArchive?.(note.id)}
                  onUnarchive={() => onUnarchive?.(note.id)}
                  onDelete={() => onDelete?.(note.id)}
                />
              )
            }
          })}
        </div>
      </SortableContext>

      {/* Drag Overlay - Shows actual note card during drag */}
      <DragOverlay>
        {activeNote ? (
          <div className="opacity-90 cursor-grabbing shadow-2xl">
            <SortableNoteCard
              note={activeNote}
              isSelected={activeNote.id === selectedNoteId}
              onClick={() => {}}
              onTogglePin={() => {}}
              onArchive={() => {}}
              onUnarchive={() => {}}
              onDelete={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

