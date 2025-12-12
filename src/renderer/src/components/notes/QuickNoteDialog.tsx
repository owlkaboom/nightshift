/**
 * QuickNoteDialog - Minimal floating dialog for fast note capture
 *
 * Activated via Cmd+Shift+N, allows quick capture of ideas with minimal UI.
 * Auto-saves as draft when closed.
 */

import { useState, useCallback, useEffect } from 'react'
import type { CreateNoteData } from '@shared/types'
import { countWords, extractTitleFromContent } from '@shared/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Zap, Save } from 'lucide-react'
import { useKeyboardShortcuts, type KeyboardShortcut, kbd } from '@/hooks'

interface QuickNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: CreateNoteData) => Promise<void>
}

export function QuickNoteDialog({ open, onOpenChange, onSave }: QuickNoteDialogProps) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset content when dialog opens
  useEffect(() => {
    if (open) {
      setContent('')
    }
  }, [open])

  const handleSave = useCallback(async () => {
    if (!content.trim()) {
      onOpenChange(false)
      return
    }

    setSaving(true)
    try {
      const title = extractTitleFromContent(content)
      const data: CreateNoteData = {
        title,
        content,
        tags: []
      }

      await onSave(data)
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save quick note:', error)
    } finally {
      setSaving(false)
    }
  }, [content, onSave, onOpenChange])

  // Handle Cmd+S to save
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 's',
      meta: true,
      handler: handleSave,
      description: 'Save note',
      ignoreInputs: false
    },
    {
      key: 'Escape',
      handler: () => {
        // Auto-save on escape if there's content
        if (content.trim()) {
          handleSave()
        } else {
          onOpenChange(false)
        }
      },
      description: 'Close quick note',
      ignoreInputs: false
    }
  ]

  useKeyboardShortcuts(shortcuts, { enabled: open })

  const wordCount = countWords(content)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Quick Note
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Capture your idea... (${kbd.mod}+S to save)`}
            className="min-h-[150px] resize-none"
            autoFocus
          />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{wordCount} words</span>
            <span>Auto-saves as draft</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !content.trim()}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
