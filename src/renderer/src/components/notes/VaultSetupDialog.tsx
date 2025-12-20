/**
 * VaultSetupDialog Component
 *
 * Dialog for first-time vault configuration
 */

import { useState } from 'react'
import { FolderOpen, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

interface VaultSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onVaultSelected: (path: string) => Promise<void>
}

/**
 * Dialog for configuring the note vault location
 */
export function VaultSetupDialog({
  open,
  onOpenChange,
  onVaultSelected
}: VaultSetupDialogProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelectDirectory = async () => {
    setIsSelecting(true)
    setError(null)
    try {
      const path = await window.api.selectDirectory()
      if (path) {
        setSelectedPath(path)
      }
    } catch (err) {
      setError('Failed to select directory')
      console.error('Failed to select directory:', err)
    } finally {
      setIsSelecting(false)
    }
  }

  const handleSave = async () => {
    if (!selectedPath) return

    setIsSaving(true)
    setError(null)
    try {
      await onVaultSelected(selectedPath)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to configure vault')
      console.error('Failed to save vault path:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configure Note Vault</DialogTitle>
          <DialogDescription>
            Choose a folder to store your notes. This will be your note vault, similar to
            Obsidian. You can use an existing Obsidian vault or create a new folder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selection Button */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleSelectDirectory}
              disabled={isSelecting || isSaving}
            >
              <FolderOpen className="h-4 w-4" />
              {isSelecting ? 'Selecting...' : 'Select Vault Folder'}
            </Button>

            {/* Selected Path Display */}
            {selectedPath && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-sm font-medium">Selected folder:</p>
                <p className="mt-1 text-xs text-muted-foreground font-mono break-all">
                  {selectedPath}
                </p>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Info Box */}
          <div className="rounded-md bg-blue-500/10 p-3 text-sm text-blue-600 dark:text-blue-400">
            <p className="font-medium mb-1">About Note Vaults</p>
            <ul className="space-y-1 text-xs">
              <li>• Notes are stored as markdown files with YAML frontmatter</li>
              <li>• Compatible with Obsidian and other markdown editors</li>
              <li>• You can organize notes in folders</li>
              <li>• All metadata is stored in the frontmatter</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selectedPath || isSaving}>
            {isSaving ? 'Configuring...' : 'Configure Vault'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
