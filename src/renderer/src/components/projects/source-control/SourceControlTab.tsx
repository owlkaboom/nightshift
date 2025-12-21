/**
 * SourceControlTab - Main source control interface
 *
 * Provides VS Code-style source control with:
 * - Changed files list with staging
 * - Diff viewer
 * - Commit panel
 * - Branch selector
 * - Remote status
 * - Stash management
 */

import { useEffect } from 'react'
import { useSourceControlStore } from '@/stores'
import { RemoteStatusBar } from './RemoteStatusBar'
import { BranchSelector } from './BranchSelector'
import { ChangedFilesList } from './ChangedFilesList'
import { StashSection } from './StashSection'
import { CommitPanel } from './CommitPanel'
import { DiffViewer } from './DiffViewer'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SourceControlTabProps {
  projectId: string
}

export function SourceControlTab({ projectId }: SourceControlTabProps) {
  const {
    setProjectId,
    loadingStatus,
    error,
    clearError
  } = useSourceControlStore()

  // Initialize the store with this project
  useEffect(() => {
    setProjectId(projectId)
    return () => setProjectId(null)
  }, [projectId, setProjectId])

  return (
    <div className="flex h-full">
      {/* Left panel: file tree and controls */}
      <div className="w-80 border-r flex flex-col bg-muted/30">
        {/* Remote status bar */}
        <RemoteStatusBar />

        {/* Branch selector */}
        <BranchSelector />

        {/* Error display */}
        {error && (
          <Alert variant="destructive" className="mx-3 mt-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-start justify-between gap-2">
              <span className="text-xs">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-xs shrink-0"
                onClick={clearError}
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Loading state */}
        {loadingStatus ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Changed files list */}
            <div className="flex-1 overflow-hidden">
              <ChangedFilesList />
            </div>

            {/* Stash section */}
            <StashSection />

            {/* Commit panel */}
            <CommitPanel />
          </>
        )}
      </div>

      {/* Right panel: diff viewer */}
      <div className="flex-1 flex flex-col">
        <DiffViewer />
      </div>
    </div>
  )
}
