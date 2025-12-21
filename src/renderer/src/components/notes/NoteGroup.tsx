/**
 * NoteGroup - Collapsible folder-like component for organizing notes
 *
 * Displays a group header with icon, name, and collapse/expand functionality.
 * Contains a list of notes that can be shown/hidden.
 */

import { useState, useRef, useEffect } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, MoreHorizontal, Trash2, Palette } from 'lucide-react'
import type { NoteGroup as NoteGroupType, Note } from '@shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { SortableNoteCard } from './SortableNoteCard'

const DEFAULT_COLORS = [
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ef4444', // red
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16'  // lime
]

interface NoteGroupProps {
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

  /** Whether drag-and-drop is enabled */
  dragEnabled?: boolean

  /** Drag attributes from dnd-kit */
  dragAttributes?: Record<string, any>

  /** Drag listeners from dnd-kit */
  dragListeners?: Record<string, any>

  /** Additional class names */
  className?: string
}

export function NoteGroup({
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
  onDeleteGroup,
  dragEnabled = false,
  dragAttributes,
  dragListeners,
  className
}: NoteGroupProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(group.name)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const hasAutoFocusedRef = useRef(false)
  const isCollapsed = group.isCollapsed

  // Auto-focus name input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName])

  // Auto-focus on newly created groups (name is "New Group")
  // Delay slightly to allow drag-drop context to initialize
  useEffect(() => {
    if (group.name === 'New Group' && !hasAutoFocusedRef.current) {
      hasAutoFocusedRef.current = true
      // Use setTimeout to defer editing state until after mount
      const timer = setTimeout(() => {
        setIsEditingName(true)
      }, 100)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [])

  // Sync editedName when group name changes externally (after save)
  useEffect(() => {
    if (!isEditingName) {
      setEditedName(group.name)
    }
  }, [group.name, isEditingName])

  const handleToggle = () => {
    if (!isEditingName) {
      onToggle?.(group.id)
    }
  }

  const handleNameClick = (e: React.MouseEvent) => {
    // Only enter edit mode on double-click to avoid conflicts with drag
    if (e.detail === 2) {
      setIsEditingName(true)
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedName(e.target.value)
  }

  const handleNameBlur = async () => {
    const trimmedName = editedName.trim()

    // Exit editing mode first for immediate UI feedback
    setIsEditingName(false)

    if (trimmedName && trimmedName !== group.name) {
      // Save asynchronously without blocking UI
      await onUpdateGroup?.(group.id, { name: trimmedName })
    } else {
      // Reset to original if empty or unchanged
      setEditedName(group.name)
    }
  }

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setEditedName(group.name)
      setIsEditingName(false)
    }
  }

  const handleColorChange = async (color: string) => {
    await onUpdateGroup?.(group.id, { color })
    setColorPickerOpen(false)
  }

  const handleDeleteGroup = () => {
    if (notes.length > 0) {
      if (!window.confirm(`Delete "${group.name}"? The ${notes.length} note(s) in this group will be moved to ungrouped notes.`)) {
        return
      }
    }
    onDeleteGroup?.(group.id)
  }

  return (
    <div className={cn('select-none', className)}>
      {/* Group Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors',
          'cursor-pointer group',
          dragEnabled && !isEditingName && 'cursor-grab active:cursor-grabbing'
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...(dragEnabled && !isEditingName && dragAttributes ? dragAttributes : {})}
        {...(dragEnabled && !isEditingName && dragListeners ? dragListeners : {})}
      >
        {/* Collapse/Expand Icon */}
        <button
          onClick={handleToggle}
          className="flex-shrink-0 p-0.5 hover:bg-muted rounded"
          aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Group Icon */}
        <div className="flex-shrink-0">
          {isCollapsed ? (
            <Folder className="h-4 w-4 text-muted-foreground" style={{ color: group.color ?? undefined }} />
          ) : (
            <FolderOpen className="h-4 w-4 text-muted-foreground" style={{ color: group.color ?? undefined }} />
          )}
        </div>

        {/* Group Name - Editable */}
        {isEditingName ? (
          <Input
            ref={nameInputRef}
            value={editedName}
            onChange={handleNameChange}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            className="flex-1 h-6 text-sm font-medium px-1.5 py-0 bg-background border-primary shadow-sm"
            style={{ color: group.color ?? undefined }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            onClick={handleNameClick}
            className="flex-1 min-w-0 text-sm font-medium truncate cursor-text hover:bg-muted/30 px-1.5 py-0.5 rounded transition-colors"
            style={{ color: group.color ?? undefined }}
            title="Double-click to rename"
          >
            {group.name}
          </div>
        )}

        {/* Color Picker */}
        <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
                (isHovered || colorPickerOpen) && 'opacity-100'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <Palette className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="end">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium mb-1">Choose Color</p>
              <div className="flex gap-1 flex-wrap max-w-[160px]">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleColorChange(color)}
                    className="h-6 w-6 rounded border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: color,
                      borderColor: group.color === color ? '#000' : 'transparent'
                    }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Note Count Badge */}
        <div className="flex-shrink-0 text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
          {notes.length}
        </div>

        {/* Group Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
                isHovered && 'opacity-100'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDeleteGroup} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Notes List */}
      {!isCollapsed && (
        <div className="ml-6 mt-1 space-y-1">
          {notes.length === 0 ? (
            <div className="px-2 py-4 text-xs text-muted-foreground text-center">
              No notes in this group
            </div>
          ) : (
            notes.map((note) => (
              <SortableNoteCard
                key={note.id}
                note={note}
                onClick={() => onNoteClick?.(note)}
                onTogglePin={() => onTogglePin?.(note.id)}
                onArchive={() => onArchive?.(note.id)}
                onUnarchive={() => onUnarchive?.(note.id)}
                onDelete={() => onDelete?.(note.id)}
                isSelected={note.id === selectedNoteId}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
