/**
 * CommitPanel - Commit message input with AI generation
 */

import { useSourceControlStore } from '@/stores'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Sparkles, Loader2, Check } from 'lucide-react'

export function CommitPanel() {
  const {
    stagedFiles,
    commitMessage,
    setCommitMessage,
    generateCommitMessage,
    commit,
    isCommitting,
    isGeneratingMessage
  } = useSourceControlStore()

  const canCommit = stagedFiles.length > 0 && commitMessage.trim().length > 0

  return (
    <div className="p-3 border-t space-y-2 bg-background">
      {/* Commit message input */}
      <div className="relative">
        <Textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder={
            stagedFiles.length === 0
              ? 'Stage changes to commit...'
              : 'Enter commit message...'
          }
          disabled={stagedFiles.length === 0}
          className="min-h-[80px] text-sm pr-10 resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canCommit) {
              e.preventDefault()
              commit()
            }
          }}
        />

        {/* Generate button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-7 w-7"
          onClick={generateCommitMessage}
          disabled={stagedFiles.length === 0 || isGeneratingMessage}
          title="Generate commit message with AI"
        >
          {isGeneratingMessage ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Commit button */}
      <Button
        className="w-full"
        size="sm"
        onClick={commit}
        disabled={!canCommit || isCommitting}
      >
        {isCommitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Committing...
          </>
        ) : (
          <>
            <Check className="mr-2 h-4 w-4" />
            Commit
            {stagedFiles.length > 0 && (
              <span className="ml-1 text-xs opacity-70">
                ({stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''})
              </span>
            )}
          </>
        )}
      </Button>

      {/* Keyboard shortcut hint */}
      {canCommit && (
        <p className="text-[10px] text-center text-muted-foreground">
          Press <kbd className="px-1 py-0.5 rounded bg-muted font-mono">Cmd+Enter</kbd> to commit
        </p>
      )}
    </div>
  )
}
