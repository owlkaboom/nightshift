/**
 * List component for displaying notes in a grid or list layout
 */

import type { Note } from '@shared/types'
import { cn } from '@/lib/utils'
import { NoteCard } from './NoteCard'
import { FileText, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NoteListProps {
  notes: Note[]
  loading?: boolean
  onNoteClick?: (note: Note) => void
  onTogglePin?: (noteId: string) => void
  onArchive?: (noteId: string) => void
  onUnarchive?: (noteId: string) => void
  onDelete?: (noteId: string) => void
  onConvertToTask?: (note: Note) => void
  onCreateNote?: () => void
  emptyMessage?: string
  className?: string
  layout?: 'grid' | 'list'
  selectedNoteId?: string | null
}

export function NoteList({
  notes,
  loading = false,
  onNoteClick,
  onTogglePin,
  onArchive,
  onUnarchive,
  onDelete,
  onConvertToTask,
  onCreateNote,
  emptyMessage = 'No notes yet',
  className,
  layout = 'grid',
  selectedNoteId
}: NoteListProps) {
  if (loading) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12', className)}>
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-3" />
        <p className="text-muted-foreground text-sm">Loading notes...</p>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12', className)}>
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground text-center mb-4">{emptyMessage}</p>
        {onCreateNote && (
          <Button onClick={onCreateNote} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create Note
          </Button>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        layout === 'grid'
          ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
          : 'flex flex-col gap-3',
        className
      )}
    >
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onClick={() => onNoteClick?.(note)}
          onTogglePin={() => onTogglePin?.(note.id)}
          onArchive={() => onArchive?.(note.id)}
          onUnarchive={() => onUnarchive?.(note.id)}
          onDelete={() => onDelete?.(note.id)}
          onConvertToTask={() => onConvertToTask?.(note)}
          isSelected={note.id === selectedNoteId}
          className={layout === 'list' ? 'w-full' : undefined}
        />
      ))}
    </div>
  )
}
