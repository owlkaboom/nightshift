import { useState } from 'react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  FolderOpen,
  Loader2,
  AlertCircle,
  FolderGit2,
  Check,
  AlertTriangle,
  Link
} from 'lucide-react'
import type { ScannedRepo } from '@shared/ipc-types'

interface ScanProjectsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectsAdded: () => void
}

type Step = 'select' | 'scanning' | 'results' | 'error'

interface RepoSelection {
  repo: ScannedRepo
  selected: boolean
  name: string
  projectIdToMap?: string
}

export function ScanProjectsDialog({
  open,
  onOpenChange,
  onProjectsAdded
}: ScanProjectsDialogProps) {
  const [step, setStep] = useState<Step>('select')
  const [rootPath, setRootPath] = useState('')
  const [scannedRepos, setScannedRepos] = useState<ScannedRepo[]>([])
  const [selections, setSelections] = useState<RepoSelection[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const reset = () => {
    setStep('select')
    setRootPath('')
    setScannedRepos([])
    setSelections([])
    setError(null)
    setIsAdding(false)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset()
    }
    onOpenChange(open)
  }

  const handleSelectDirectory = async () => {
    const path = await window.api.selectDirectory()
    if (!path) return

    setRootPath(path)
    setStep('scanning')
    setError(null)

    try {
      const repos = await window.api.scanDirectory(path)

      if (repos.length === 0) {
        setError('No git repositories found in the selected directory.')
        setStep('error')
        return
      }

      setScannedRepos(repos)

      // Initialize selections
      // Only select repos that are NOT already added
      const initialSelections: RepoSelection[] = repos.map((repo) => ({
        repo,
        selected: !repo.alreadyAdded,
        name: repo.name,
        projectIdToMap: repo.alreadyAdded ? repo.existingProjectId || undefined : undefined
      }))

      setSelections(initialSelections)
      setStep('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan directory')
      setStep('error')
    }
  }

  const handleToggleSelection = (index: number) => {
    setSelections((prev) =>
      prev.map((sel, i) => (i === index ? { ...sel, selected: !sel.selected } : sel))
    )
  }

  const handleUpdateName = (index: number, name: string) => {
    setSelections((prev) => prev.map((sel, i) => (i === index ? { ...sel, name } : sel)))
  }

  const handleAddProjects = async () => {
    setIsAdding(true)
    try {
      const selectedRepos = selections.filter((sel) => sel.selected)

      for (const selection of selectedRepos) {
        if (selection.repo.alreadyAdded && selection.projectIdToMap) {
          // Map to existing project by updating its path
          await window.api.setProjectPath(selection.projectIdToMap, selection.repo.path)
        } else if (!selection.repo.alreadyAdded) {
          // Add as new project
          await window.api.addProject({
            name: selection.name,
            path: selection.repo.path,
            gitUrl: selection.repo.gitUrl,
            defaultBranch: selection.repo.defaultBranch
          })
        }
      }

      onProjectsAdded()
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add projects')
      setStep('error')
    } finally {
      setIsAdding(false)
    }
  }

  const selectedCount = selections.filter((s) => s.selected).length
  const newProjectsCount = selections.filter((s) => s.selected && !s.repo.alreadyAdded).length
  const mappingsCount = selections.filter((s) => s.selected && s.repo.alreadyAdded).length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Scan for Projects</DialogTitle>
          <DialogDescription>
            {step === 'select' && 'Select a directory to scan for git repositories.'}
            {step === 'scanning' && 'Scanning for git repositories...'}
            {step === 'results' &&
              `Found ${scannedRepos.length} ${scannedRepos.length === 1 ? 'repository' : 'repositories'}. Select which to add or map.`}
            {step === 'error' && 'An error occurred while scanning.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 'select' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="rounded-full bg-muted p-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Select a directory to scan. We'll search for git repositories and let you add them
                as projects or map them to existing ones.
              </p>
              <Button onClick={handleSelectDirectory}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Select Directory
              </Button>
            </div>
          )}

          {step === 'scanning' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Scanning {rootPath}...</p>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <p className="text-sm text-destructive text-center">{error}</p>
              <Button variant="outline" onClick={() => setStep('select')}>
                Try Again
              </Button>
            </div>
          )}

          {step === 'results' && (
            <div className="space-y-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {selections.map((selection, index) => (
                    <div
                      key={index}
                      className={`border rounded-lg p-4 space-y-3 transition-colors ${
                        selection.selected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selection.selected}
                          onChange={() => handleToggleSelection(index)}
                          disabled={selection.repo.alreadyAdded}
                          className="mt-1 h-4 w-4"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <FolderGit2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            {selection.repo.alreadyAdded ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium break-all">{selection.repo.name}</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-500/10 text-green-600 text-xs">
                                  <Check className="h-3 w-3" />
                                  Already added
                                </span>
                              </div>
                            ) : (
                              <Input
                                value={selection.name}
                                onChange={(e) => handleUpdateName(index, e.target.value)}
                                className="h-7 font-medium"
                                placeholder="Project name"
                              />
                            )}
                          </div>

                          <div className="space-y-1.5 text-xs text-muted-foreground">
                            <div className="flex items-start gap-2">
                              <span className="shrink-0">Path:</span>
                              <span className="font-mono break-all">{selection.repo.path}</span>
                            </div>

                            {selection.repo.gitUrl && (
                              <div className="flex items-start gap-2">
                                <span className="shrink-0">URL:</span>
                                <span className="font-mono break-all">{selection.repo.gitUrl}</span>
                              </div>
                            )}

                            {selection.repo.currentBranch && (
                              <div className="flex items-start gap-2">
                                <span className="shrink-0">Branch:</span>
                                <span className="font-mono">{selection.repo.currentBranch}</span>
                              </div>
                            )}

                            {selection.repo.warning && (
                              <div className="flex items-center gap-1.5 text-amber-600">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                <span>{selection.repo.warning}</span>
                              </div>
                            )}
                          </div>

                          {selection.repo.alreadyAdded && selection.repo.existingProjectId && (
                            <div className="mt-2 pt-2 border-t border-border">
                              <div className="flex items-center gap-2 text-xs">
                                <Link className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                  Will update path for existing project
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {selectedCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  <span>
                    {newProjectsCount > 0 && (
                      <>
                        <strong>{newProjectsCount}</strong> new{' '}
                        {newProjectsCount === 1 ? 'project' : 'projects'}
                      </>
                    )}
                    {newProjectsCount > 0 && mappingsCount > 0 && ', '}
                    {mappingsCount > 0 && (
                      <>
                        <strong>{mappingsCount}</strong> path{' '}
                        {mappingsCount === 1 ? 'update' : 'updates'}
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'select' && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step === 'results' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>
                Scan Again
              </Button>
              <Button onClick={handleAddProjects} disabled={selectedCount === 0 || isAdding}>
                {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {newProjectsCount > 0 && mappingsCount > 0 && 'Add & Update'}
                {newProjectsCount > 0 && mappingsCount === 0 && 'Add Projects'}
                {newProjectsCount === 0 && mappingsCount > 0 && 'Update Paths'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
