/**
 * InitSetupDialog Component
 *
 * First-run initialization dialog that guides users through essential setup
 */

import { useState } from 'react'
import { FolderOpen, AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'

interface InitSetupDialogProps {
  open: boolean
  onComplete: (config: { vaultPath: string }) => Promise<void>
  onSkip: () => void
}

/**
 * Multi-step initialization dialog for first-run setup
 */
export function InitSetupDialog({ open, onComplete, onSkip }: InitSetupDialogProps) {
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

  const handleComplete = async () => {
    if (!selectedPath) return

    setIsSaving(true)
    setError(null)
    try {
      await onComplete({ vaultPath: selectedPath })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup')
      console.error('Failed to complete setup:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[600px]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome to Nightshift</DialogTitle>
          <DialogDescription className="text-base">
            Let's set up some essential settings to get you started
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Vault Setup Section */}
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="mt-0.5">
                {selectedPath ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <h3 className="font-semibold text-base">Configure Note Vault</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose a folder to store your planning notes and task documentation
                  </p>
                </div>

                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={handleSelectDirectory}
                  disabled={isSelecting || isSaving}
                >
                  <FolderOpen className="h-4 w-4" />
                  {isSelecting ? 'Selecting...' : 'Select Vault Folder'}
                </Button>

                {selectedPath && (
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs font-medium text-muted-foreground">Selected:</p>
                    <p className="mt-1 text-xs font-mono break-all">{selectedPath}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Info Box */}
          <div className="rounded-md bg-blue-500/10 p-4 text-sm">
            <div className="flex items-start gap-2 text-blue-600 dark:text-blue-400">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="font-medium">What you need to know:</p>
                <ul className="space-y-1 text-xs">
                  <li>
                    <strong>Note Vault:</strong> Stores planning sessions and task notes as markdown
                    files (compatible with Obsidian)
                  </li>
                  <li>
                    <strong>Agent Configuration:</strong> After setup, configure at least one AI
                    agent in Settings to start running tasks
                  </li>
                  <li>
                    <strong>Skip Setup:</strong> You can skip this and configure everything later in
                    Settings
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={onSkip}
            disabled={isSaving}
            className="flex-1 sm:flex-none"
          >
            Skip for Now
          </Button>
          <Button
            onClick={handleComplete}
            disabled={!selectedPath || isSaving}
            className="flex-1 sm:flex-none"
          >
            {isSaving ? 'Completing Setup...' : 'Complete Setup'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
