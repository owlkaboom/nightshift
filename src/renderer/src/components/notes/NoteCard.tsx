/**
 * Card component for displaying a note in a list
 */

import type { Note } from '@shared/types'
import { NOTE_ICONS } from '@shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Trash2,
  MoreVertical,
  ListTodo,
  StickyNote
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'

interface NoteCardProps {
  note: Note
  onClick?: () => void
  onTogglePin?: () => void
  onArchive?: () => void
  onUnarchive?: () => void
  onDelete?: () => void
  onConvertToTask?: () => void
  className?: string
  isSelected?: boolean
}

export function NoteCard({
  note,
  onClick,
  onTogglePin,
  onArchive,
  onUnarchive,
  onDelete,
  onConvertToTask,
  className,
  isSelected = false
}: NoteCardProps) {
  const getIconComponent = (iconName: string) => {
    const Icon = LucideIcons[iconName as keyof typeof LucideIcons] as LucideIcons.LucideIcon
    return Icon || StickyNote
  }

  const renderNoteIcon = () => {
    if (note.icon) {
      if (NOTE_ICONS.includes(note.icon as (typeof NOTE_ICONS)[number])) {
        const Icon = getIconComponent(note.icon)
        return <Icon className="h-4 w-4 text-muted-foreground" />
      }
      return (
        <img
          src={note.icon}
          alt=""
          className="h-4 w-4 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )
    }
    return null
  }

  return (
    <div
      className={cn(
        'group cursor-pointer hover:bg-accent/50 transition-colors px-3 py-2 rounded-md border',
        note.status === 'archived' && 'opacity-60',
        isSelected ? 'bg-accent border-border' : 'border-transparent hover:border-border',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Left: Icon + Title + Pin indicator */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {renderNoteIcon()}
          {note.isPinned && (
            <Pin className="h-3 w-3 text-primary shrink-0" />
          )}
          <h3 className="font-medium text-sm truncate">{note.title}</h3>
        </div>

        {/* Right: Actions menu */}
        <div className="flex items-center shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={onTogglePin}>
                {note.isPinned ? (
                  <>
                    <PinOff className="h-4 w-4 mr-2" />
                    Unpin
                  </>
                ) : (
                  <>
                    <Pin className="h-4 w-4 mr-2" />
                    Pin
                  </>
                )}
              </DropdownMenuItem>

              {onConvertToTask && note.status !== 'converted' && (
                <DropdownMenuItem onClick={onConvertToTask}>
                  <ListTodo className="h-4 w-4 mr-2" />
                  Convert to Task
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {note.status === 'archived' ? (
                <DropdownMenuItem onClick={onUnarchive}>
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Unarchive
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onArchive}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
