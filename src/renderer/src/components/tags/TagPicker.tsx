/**
 * TagPicker Component
 *
 * Multi-select picker for associating tags with projects/tasks
 */

import { useState, useMemo, useEffect } from 'react'
import { Check, Plus, Search, X } from 'lucide-react'
import type { Tag } from '@shared/types'
import { useTagStore } from '@/stores/tag-store'
import { TagChip } from './TagChip'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

interface TagPickerProps {
  /** Currently selected tag IDs */
  selectedTagIds: string[]
  /** Callback when tag selection changes */
  onChange: (tagIds: string[]) => void
  /** Optional trigger element (defaults to button with selected tags) */
  trigger?: React.ReactNode
  /** Placeholder text when no tags are selected */
  placeholder?: string
}

export function TagPicker({
  selectedTagIds,
  onChange,
  trigger,
  placeholder = 'Select tags...'
}: TagPickerProps) {
  const { tags, loadTags, createTag } = useTagStore()
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)

  // Load tags when component mounts
  useEffect(() => {
    loadTags()
  }, [loadTags])

  // Selected tags for display
  const selectedTags = useMemo(() => {
    return tags.filter((tag) => selectedTagIds.includes(tag.id))
  }, [tags, selectedTagIds])

  // Filtered tags based on search query
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags

    const query = searchQuery.toLowerCase()
    return tags.filter((tag) => tag.name.toLowerCase().includes(query))
  }, [tags, searchQuery])

  // Check if search query exactly matches an existing tag
  const exactMatch = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return tags.some((tag) => tag.name.toLowerCase() === query)
  }, [tags, searchQuery])

  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId))
    } else {
      onChange([...selectedTagIds, tagId])
    }
  }

  const handleCreateTag = async () => {
    const trimmedQuery = searchQuery.trim()
    if (!trimmedQuery || exactMatch) return

    setCreatingTag(true)
    try {
      const newTag = await createTag(trimmedQuery)
      onChange([...selectedTagIds, newTag.id])
      setSearchQuery('')
    } catch (error) {
      console.error('Failed to create tag:', error)
    } finally {
      setCreatingTag(false)
    }
  }

  const handleRemoveTag = (tag: Tag) => {
    onChange(selectedTagIds.filter((id) => id !== tag.id))
  }

  const defaultTrigger = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className="min-w-[200px] justify-start text-left font-normal"
    >
      {selectedTags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <TagChip key={tag.id} tag={tag} size="sm" />
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground">{placeholder}</span>
      )}
    </Button>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger || defaultTrigger}</PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="flex flex-col">
          {/* Search input */}
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Search or create tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !exactMatch && searchQuery.trim()) {
                  handleCreateTag()
                }
              }}
              className="h-8 border-0 p-0 focus-visible:ring-0"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="ml-2 rounded-sm opacity-50 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Selected tags */}
          {selectedTags.length > 0 && (
            <div className="border-b p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">Selected</div>
              <div className="flex flex-wrap gap-1">
                {selectedTags.map((tag) => (
                  <TagChip
                    key={tag.id}
                    tag={tag}
                    size="sm"
                    removable
                    onRemove={handleRemoveTag}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Tag list */}
          <ScrollArea className="max-h-[300px]">
            <div className="p-1">
              {filteredTags.length === 0 && !searchQuery && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No tags created yet
                </div>
              )}

              {filteredTags.length === 0 && searchQuery && !exactMatch && (
                <button
                  onClick={handleCreateTag}
                  disabled={creatingTag}
                  className={cn(
                    'w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                    'hover:bg-accent focus:bg-accent focus:outline-none',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <Plus className="h-4 w-4" />
                  <span>
                    Create &quot;{searchQuery.trim()}&quot;
                  </span>
                </button>
              )}

              {filteredTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => handleToggleTag(tag.id)}
                    className={cn(
                      'w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                      'hover:bg-accent focus:bg-accent focus:outline-none',
                      isSelected && 'bg-accent'
                    )}
                  >
                    <div
                      className={cn(
                        'h-4 w-4 rounded-sm border flex items-center justify-center',
                        isSelected && 'bg-primary border-primary'
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <TagChip tag={tag} size="sm" className="flex-1" />
                  </button>
                )
              })}

              {/* Create option when searching */}
              {searchQuery && !exactMatch && filteredTags.length > 0 && (
                <button
                  onClick={handleCreateTag}
                  disabled={creatingTag}
                  className={cn(
                    'w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm mt-1 border-t',
                    'hover:bg-accent focus:bg-accent focus:outline-none',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <Plus className="h-4 w-4" />
                  <span>
                    Create &quot;{searchQuery.trim()}&quot;
                  </span>
                </button>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  )
}
