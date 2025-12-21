/**
 * SortableNoteGroup - Drag-and-drop enabled note group component
 *
 * This component:
 * 1. Is sortable among other groups (via useSortable)
 * 2. Is a droppable zone for notes (via useDroppable)
 * 3. Contains its own SortableContext for notes within the group
 */

import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { NoteGroup as NoteGroupType, Note } from '@shared/types'
import { NoteGroup } from './NoteGroup'
import { cn } from '@/lib/utils'

interface SortableNoteGroupProps {
  /** The group data */
  group: NoteGroupType

  /** Notes belonging to this group */
  notes: Note[]

  /** Selected note ID */
  selectedNoteId?: string | null

  /** Callback when group is toggled */
  onToggle?: (groupId: string) => void

  /** Callback when note is clicked */
  onNoteClick?: (note: Note) => void

  /** Callback when note pin is toggled */
  onTogglePin?: (noteId: string) => void

  /** Callback when note is archived */
  onArchive?: (noteId: string) => void

  /** Callback when note is unarchived */
  onUnarchive?: (noteId: string) => void

  /** Callback when note is deleted */
  onDelete?: (noteId: string) => void

  /** Callback when group is updated */
  onUpdateGroup?: (groupId: string, updates: Partial<NoteGroupType>) => Promise<NoteGroupType | null>

  /** Callback when group is deleted */
  onDeleteGroup?: (groupId: string) => void
}

export function SortableNoteGroup({
  group,
  notes,
  selectedNoteId,
  onToggle,
  onNoteClick,
  onTogglePin,
  onArchive,
  onUnarchive,
  onDelete,
  onUpdateGroup,
  onDeleteGroup
}: SortableNoteGroupProps) {
  // Sortable for reordering groups
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: group.id,
    data: {
      type: 'group',
      group
    }
  })

  // Droppable for receiving notes
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: group.id,
    data: {
      type: 'group',
      group
    }
  })

  // Combine refs
  const setNodeRef = (node: HTMLDivElement | null) => {
    setSortableRef(node)
    setDroppableRef(node)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 9999 } : {})
  }

  // Create sortable IDs for notes within this group
  const noteIds = notes.map(n => n.id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative',
        isDragging && 'opacity-30',
        isOver && 'ring-2 ring-primary shadow-lg rounded-md bg-primary/5'
      )}
    >
      {/* SortableContext for notes within this group */}
      <SortableContext items={noteIds} strategy={verticalListSortingStrategy}>
        <NoteGroup
          group={group}
          notes={notes}
          selectedNoteId={selectedNoteId}
          onToggle={onToggle}
          onNoteClick={onNoteClick}
          onTogglePin={onTogglePin}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onDelete={onDelete}
          onUpdateGroup={onUpdateGroup}
          onDeleteGroup={onDeleteGroup}
          dragEnabled
          dragAttributes={attributes}
          dragListeners={listeners}
        />
      </SortableContext>
    </div>
  )
}
