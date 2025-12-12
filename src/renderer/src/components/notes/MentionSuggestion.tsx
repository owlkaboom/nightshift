/**
 * Mention suggestion dropdown for @project and #group autocomplete
 */

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { cn } from '@/lib/utils'
import { FolderGit2, Layers } from 'lucide-react'

interface MentionItem {
  id: string
  name: string
  color?: string
}

interface MentionSuggestionProps {
  items: MentionItem[]
  command: (item: { id: string; label: string }) => void
  type: 'project' | 'group' | 'tag'
}

export interface MentionSuggestionRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

export const MentionSuggestion = forwardRef<MentionSuggestionRef, MentionSuggestionProps>(
  ({ items, command, type }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    const selectItem = (index: number) => {
      const item = items[index]
      if (item) {
        command({ id: item.id, label: item.name })
      }
    }

    const upHandler = () => {
      setSelectedIndex((selectedIndex + items.length - 1) % items.length)
    }

    const downHandler = () => {
      setSelectedIndex((selectedIndex + 1) % items.length)
    }

    const enterHandler = () => {
      selectItem(selectedIndex)
    }

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          upHandler()
          return true
        }

        if (event.key === 'ArrowDown') {
          downHandler()
          return true
        }

        if (event.key === 'Enter') {
          enterHandler()
          return true
        }

        return false
      }
    }))

    if (items.length === 0) {
      const label = type === 'project' ? 'projects' : type === 'tag' ? 'tags' : 'groups'
      return (
        <div className="bg-popover text-popover-foreground border rounded-md shadow-md p-2 text-sm text-muted-foreground">
          No {label} found
        </div>
      )
    }

    const Icon = type === 'project' ? FolderGit2 : Layers

    return (
      <div className="bg-popover text-popover-foreground border rounded-md shadow-md overflow-hidden">
        {items.map((item, index) => (
          <button
            key={item.id}
            className={cn(
              'flex items-center gap-2 w-full px-3 py-2 text-sm text-left cursor-pointer',
              index === selectedIndex
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50'
            )}
            onClick={() => selectItem(index)}
          >
            {(type === 'group' || type === 'tag') && item.color ? (
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
            ) : (
              <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
            )}
            <span>{item.name}</span>
          </button>
        ))}
      </div>
    )
  }
)

MentionSuggestion.displayName = 'MentionSuggestion'
