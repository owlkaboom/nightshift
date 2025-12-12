/**
 * TagsView Component
 *
 * Manage all tags in the system - create, edit, delete tags
 */

import { useEffect, useState, useMemo } from 'react'
import { Pencil, Trash2, Tag as TagIcon, X } from 'lucide-react'
import { useTagStore } from '@/stores/tag-store'
import { TagChip } from '@/components/tags/TagChip'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TAG_COLORS } from '@shared/types/tag'
import { cn } from '@/lib/utils'
import type { Tag } from '@shared/types'

export function TagsView() {
  const { tags, loading, loadTags, createTag, updateTag, deleteTag } = useTagStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadTags()
  }, [loadTags])

  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags
    const query = searchQuery.toLowerCase()
    return tags.filter((tag) => tag.name.toLowerCase().includes(query))
  }, [tags, searchQuery])

  const exactMatch = useMemo(() => {
    if (!searchQuery.trim()) return null
    return tags.find((tag) => tag.name.toLowerCase() === searchQuery.toLowerCase())
  }, [tags, searchQuery])

  const handleQuickCreate = async () => {
    const trimmedQuery = searchQuery.trim()
    if (!trimmedQuery || exactMatch) return

    try {
      await createTag(trimmedQuery)
      setSearchQuery('')
    } catch (error) {
      console.error('Failed to create tag:', error)
      alert(error instanceof Error ? error.message : 'Failed to create tag')
    }
  }

  const handleOpenEdit = (tag: Tag) => {
    setEditingTag(tag)
    setTagName(tag.name)
    setTagColor(tag.color)
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    const trimmedName = tagName.trim()
    if (!trimmedName || !editingTag) return

    setSaving(true)
    try {
      await updateTag(editingTag.id, { name: trimmedName, color: tagColor })
      setEditDialogOpen(false)
    } catch (error) {
      console.error('Failed to save tag:', error)
      alert(error instanceof Error ? error.message : 'Failed to save tag')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (tag: Tag) => {
    if (!confirm(`Are you sure you want to delete the tag "${tag.name}"?`)) {
      return
    }

    try {
      await deleteTag(tag.id)
    } catch (error) {
      console.error('Failed to delete tag:', error)
      alert('Failed to delete tag')
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b">
        <div className="p-4 sm:p-6 pb-3 sm:pb-4 space-y-3 sm:space-y-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Tags</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Organize your projects with tags
            </p>
          </div>

          {/* Search and Quick Create */}
          <div className="relative">
            <Input
              placeholder="Search or create tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim() && !exactMatch) {
                  handleQuickCreate()
                }
              }}
              className="pr-8"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-sm hover:bg-accent transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Quick create hint */}
          {searchQuery.trim() && !exactMatch && (
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-dashed">
              <p className="text-sm text-muted-foreground">
                Press <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-background border rounded">Enter</kbd> to create "{searchQuery}"
              </p>
              <Button size="sm" onClick={handleQuickCreate}>
                Create
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading tags...</div>
          </div>
        ) : tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <TagIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No tags yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Type in the search box above to create your first tag
            </p>
          </div>
        ) : filteredTags.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <TagIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No tags found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              No tags match "{searchQuery}"
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
              >
                <TagChip tag={tag} size="md" />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(tag)}
                    className="p-2 rounded-md hover:bg-accent transition-colors"
                    aria-label={`Edit ${tag.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(tag)}
                    className="p-2 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
                    aria-label={`Delete ${tag.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update the tag name and color
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name input */}
            <div className="space-y-2">
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="e.g., Backend, Frontend, AI"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tagName.trim()) {
                    handleSaveEdit()
                  }
                }}
              />
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <Label>Color (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {/* No color option */}
                <button
                  type="button"
                  onClick={() => setTagColor(null)}
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-all',
                    tagColor === null
                      ? 'border-primary ring-2 ring-primary ring-offset-2'
                      : 'border-border hover:border-muted-foreground',
                    'bg-muted relative'
                  )}
                  title="No color"
                >
                  {tagColor === null && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-0.5 w-5 bg-muted-foreground rotate-45" />
                    </div>
                  )}
                </button>

                {/* Color options */}
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setTagColor(color)}
                    className={cn(
                      'h-8 w-8 rounded-full border-2 transition-all',
                      tagColor === color
                        ? 'border-primary ring-2 ring-primary ring-offset-2'
                        : 'border-transparent hover:border-muted-foreground'
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            {tagName.trim() && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="p-3 rounded-md border bg-muted/50">
                  <TagChip tag={{ id: 'preview', name: tagName.trim(), color: tagColor, createdAt: '' }} size="md" />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={!tagName.trim() || saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
