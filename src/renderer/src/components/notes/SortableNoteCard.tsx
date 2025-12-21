/**
 * SortableNoteCard - Drag-and-drop enabled note card component
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Note } from '@shared/types'
import { NoteCard } from './NoteCard'
import { cn } from '@/lib/utils'

interface SortableNoteCardProps {
  /** The note data */
  note: Note

  /** Whether the note is selected */
  isSelected?: boolean

  /** Callback when note is clicked */
  onClick?: () => void

  /** Callback when note pin is toggled */
  onTogglePin?: () => void

  /** Callback when note is archived */
  onArchive?: () => void

  /** Callback when note is unarchived */
  onUnarchive?: () => void

  /** Callback when note is deleted */
  onDelete?: () => void

  /** Callback when note is converted to task */
  onConvertToTask?: () => void
}

export function SortableNoteCard({
  note,
  isSelected,
  onClick,
  onTogglePin,
  onArchive,
  onUnarchive,
  onDelete,
  onConvertToTask
}: SortableNoteCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver
  } = useSortable({
    id: note.id,
    data: {
      type: 'note',
      note
    }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 9999 } : {})
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'cursor-grab active:cursor-grabbing touch-none relative',
        isDragging && 'opacity-30',
        isOver && !isDragging && 'ring-2 ring-primary rounded-md'
      )}
      {...attributes}
      {...listeners}
    >
      <NoteCard
        note={note}
        isSelected={isSelected}
        onClick={onClick}
        onTogglePin={onTogglePin}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
        onDelete={onDelete}
        onConvertToTask={onConvertToTask}
        className="w-full"
      />
    </div>
  )
}
