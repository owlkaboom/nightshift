/**
 * NoteGroupDialog - Dialog for creating or editing note groups
 */

import { useState, useEffect } from 'react'
import { Folder } from 'lucide-react'
import type { NoteGroup } from '@shared/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface NoteGroupDialogProps {
  /** Whether the dialog is open */
  open: boolean

  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void

  /** Group to edit (if null, creates new group) */
  group?: NoteGroup | null

  /** Callback when group is saved */
  onSave: (data: { name: string; icon?: string; color?: string }) => void
}

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

export function NoteGroupDialog({
  open,
  onOpenChange,
  group,
  onSave
}: NoteGroupDialogProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<string | null>(null)

  // Initialize form when dialog opens or group changes
  useEffect(() => {
    if (open) {
      setName(group?.name ?? '')
      setColor(group?.color ?? DEFAULT_COLORS[0])
    }
  }, [open, group])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      return
    }

    onSave({
      name: name.trim(),
      icon: 'Folder',
      color: color ?? undefined
    })

    // Reset form
    setName('')
    setColor(null)
    onOpenChange(false)
  }

  const handleCancel = () => {
    setName('')
    setColor(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {group ? 'Rename Group' : 'Create New Group'}
            </DialogTitle>
            <DialogDescription>
              {group
                ? 'Update the name and color for this group.'
                : 'Create a new group to organize your notes.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Group Name */}
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter group name..."
                autoFocus
                required
              />
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-8 w-8 rounded-md border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? '#000' : 'transparent'
                    }}
                    aria-label={`Select color ${c}`}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
                <Folder className="h-5 w-5" style={{ color: color ?? undefined }} />
                <span className="font-medium" style={{ color: color ?? undefined }}>
                  {name || 'Group Name'}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {group ? 'Save Changes' : 'Create Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
