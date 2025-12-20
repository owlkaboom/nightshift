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
import { Label } from '@/components/ui/label'
import { FolderOpen, Loader2, AlertCircle, Check, FolderGit2, Folder } from 'lucide-react'
import type { GitRepoInfo } from '@shared/ipc-types'

interface AddProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (data: {
    name: string
    localPath: string
    gitUrl?: string | null
    defaultBranch?: string | null
  }) => Promise<void>
}

type Step = 'choose-type' | 'select' | 'validating' | 'confirm' | 'error'
type ProjectType = 'git' | 'directory'

export function AddProjectDialog({ open, onOpenChange, onAdd }: AddProjectDialogProps) {
  const [step, setStep] = useState<Step>('choose-type')
  const [projectType, setProjectType] = useState<ProjectType | null>(null)
  const [localPath, setLocalPath] = useState('')
  const [repoInfo, setRepoInfo] = useState<GitRepoInfo | null>(null)
  const [projectName, setProjectName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const reset = () => {
    setStep('choose-type')
    setProjectType(null)
    setLocalPath('')
    setRepoInfo(null)
    setProjectName('')
    setError(null)
    setIsAdding(false)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset()
    }
    onOpenChange(open)
  }

  const handleChooseType = (type: ProjectType) => {
    setProjectType(type)
    setStep('select')
  }

  const handleSelectDirectory = async () => {
    const path = await window.api.selectDirectory()
    if (!path) return

    setLocalPath(path)
    setStep('validating')
    setError(null)

    try {
      const info = await window.api.getRepoInfo(path)

      if (projectType === 'git') {
        // For git projects, validate it's a proper git repo
        if (!info.isRepo) {
          setError('The selected directory is not a git repository.')
          setStep('error')
          return
        }

        if (!info.hasRemote) {
          setError('The repository has no remote configured. Please add a remote first.')
          setStep('error')
          return
        }

        if (!info.remoteUrl) {
          setError('Could not determine the remote URL.')
          setStep('error')
          return
        }

        setRepoInfo(info)

        // Extract project name from URL
        const name = await window.api.extractRepoName(info.remoteUrl)
        setProjectName(name)
      } else {
        // For plain directories, just get the folder name
        const folderName = path.split('/').pop() || path.split('\\').pop() || 'Project'
        setProjectName(folderName)

        // If it happens to be a git repo, store the info but don't require it
        if (info.isRepo) {
          setRepoInfo(info)
        }
      }

      setStep('confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate directory')
      setStep('error')
    }
  }

  const handleAdd = async () => {
    setIsAdding(true)
    try {
      await onAdd({
        name: projectName,
        localPath,
        gitUrl: projectType === 'git' && repoInfo?.remoteUrl ? repoInfo.remoteUrl : null,
        defaultBranch:
          projectType === 'git' && repoInfo
            ? repoInfo.defaultBranch || repoInfo.currentBranch || 'main'
            : null
      })
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add project')
      setStep('error')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Project</DialogTitle>
          <DialogDescription>
            {step === 'choose-type'
              ? 'Choose the type of project to add.'
              : projectType === 'git'
                ? 'Select a local git repository.'
                : 'Select any directory to use as a project.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 'choose-type' && (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleChooseType('git')}
                className="flex flex-col items-center gap-3 p-6 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div className="rounded-full bg-muted p-4">
                  <FolderGit2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Git Repository</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Track branches and remotes
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleChooseType('directory')}
                className="flex flex-col items-center gap-3 p-6 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div className="rounded-full bg-muted p-4">
                  <Folder className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Directory</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Any folder on your system
                  </p>
                </div>
              </button>
            </div>
          )}

          {step === 'select' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="rounded-full bg-muted p-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {projectType === 'git'
                  ? 'Select a directory containing a git repository with a remote configured.'
                  : 'Select any directory to add as a project.'}
              </p>
              <Button onClick={handleSelectDirectory}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Select Directory
              </Button>
            </div>
          )}

          {step === 'validating' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Validating directory...</p>
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

          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <Check className="h-5 w-5 text-green-500 shrink-0" />
                <p className="text-sm text-green-600">
                  {projectType === 'git' ? 'Valid git repository detected' : 'Directory selected'}
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="My Project"
                  />
                </div>

                {projectType === 'git' && repoInfo?.remoteUrl && (
                  <div className="space-y-2">
                    <Label>Git URL</Label>
                    <div className="p-2 rounded-md bg-muted font-mono text-xs break-all">
                      {repoInfo.remoteUrl}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Local Path</Label>
                  <div className="p-2 rounded-md bg-muted font-mono text-xs break-all">
                    {localPath}
                  </div>
                </div>

                {projectType === 'git' && repoInfo && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Current Branch</Label>
                      <div className="p-2 rounded-md bg-muted font-mono text-xs">
                        {repoInfo.currentBranch || 'unknown'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Default Branch</Label>
                      <div className="p-2 rounded-md bg-muted font-mono text-xs">
                        {repoInfo.defaultBranch || repoInfo.currentBranch || 'main'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'choose-type' && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}
          {(step === 'select' || step === 'error') && (
            <Button variant="outline" onClick={() => setStep('choose-type')}>
              Back
            </Button>
          )}
          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>
                Back
              </Button>
              <Button onClick={handleAdd} disabled={!projectName || isAdding}>
                {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Project
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
