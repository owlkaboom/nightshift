/**
 * DiffViewer - Shows file diffs with syntax highlighting
 *
 * Uses a custom diff renderer with line-by-line highlighting.
 * Can be upgraded to use Monaco editor for a more VS Code-like experience.
 */

import { useSourceControlStore } from '@/stores'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  FileText,
  FilePlus,
  FileX,
  FileEdit,
  Plus,
  Minus,
  Loader2,
  X
} from 'lucide-react'
import type { DiffLine, FileDiff } from '@shared/types'

// Utility for future Monaco integration
// function getLanguageFromPath(path: string): string {
//   const ext = path.split('.').pop()?.toLowerCase() || ''
//   const langMap: Record<string, string> = {
//     ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
//     json: 'json', md: 'markdown', css: 'css', scss: 'scss', html: 'html',
//     py: 'python', rs: 'rust', go: 'go', java: 'java', rb: 'ruby',
//     sh: 'bash', yml: 'yaml', yaml: 'yaml'
//   }
//   return langMap[ext] || 'text'
// }

function DiffLineComponent({ line }: { line: DiffLine }) {
  const bgColor = {
    context: '',
    add: 'bg-green-500/10',
    delete: 'bg-red-500/10'
  }[line.type]

  const textColor = {
    context: 'text-muted-foreground',
    add: 'text-green-700 dark:text-green-400',
    delete: 'text-red-700 dark:text-red-400'
  }[line.type]

  const prefix = {
    context: ' ',
    add: '+',
    delete: '-'
  }[line.type]

  const prefixColor = {
    context: 'text-muted-foreground',
    add: 'text-green-600',
    delete: 'text-red-600'
  }[line.type]

  return (
    <div className={cn('flex font-mono text-sm', bgColor)}>
      {/* Line numbers */}
      <div className="flex shrink-0 border-r border-border/50">
        <span className="w-12 px-2 text-right text-xs text-muted-foreground select-none">
          {line.oldLineNumber || ''}
        </span>
        <span className="w-12 px-2 text-right text-xs text-muted-foreground select-none">
          {line.newLineNumber || ''}
        </span>
      </div>

      {/* Prefix (+/-/space) */}
      <span className={cn('w-6 text-center shrink-0 select-none', prefixColor)}>
        {prefix}
      </span>

      {/* Content */}
      <pre className={cn('flex-1 px-2 whitespace-pre-wrap break-all', textColor)}>
        {line.content}
      </pre>
    </div>
  )
}

function DiffHunk({ hunk, hunkIndex }: { hunk: FileDiff['hunks'][0]; hunkIndex: number }) {
  const header = hunk.header || `@@ ${hunk.oldStart},${hunk.oldLines} ${hunk.newStart},${hunk.newLines} @@`

  return (
    <div className="border-b border-border/50">
      {/* Hunk header */}
      <div className="px-4 py-1 bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-mono">
        {header}
      </div>

      {/* Lines */}
      <div>
        {hunk.lines.map((line, lineIndex) => (
          <DiffLineComponent key={`${hunkIndex}-${lineIndex}`} line={line} />
        ))}
      </div>
    </div>
  )
}

function DiffContent({ diff }: { diff: FileDiff }) {
  if (diff.hunks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">No changes in this file</p>
      </div>
    )
  }

  return (
    <div>
      {diff.hunks.map((hunk, index) => (
        <DiffHunk key={index} hunk={hunk} hunkIndex={index} />
      ))}
    </div>
  )
}

export function DiffViewer() {
  const {
    selectedFile,
    selectedFileStaged,
    currentDiff,
    loadingDiff,
    clearSelectedFile,
    stageFile,
    unstageFile
  } = useSourceControlStore()

  if (!selectedFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">No file selected</p>
          <p className="text-xs">Select a file to view its changes</p>
        </div>
      </div>
    )
  }

  if (loadingDiff) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!currentDiff) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">Failed to load diff</p>
        </div>
      </div>
    )
  }

  const statusIcon = {
    added: <FilePlus className="h-4 w-4 text-green-600" />,
    modified: <FileEdit className="h-4 w-4 text-yellow-600" />,
    deleted: <FileX className="h-4 w-4 text-red-600" />,
    renamed: <FileEdit className="h-4 w-4 text-blue-600" />,
    untracked: <FilePlus className="h-4 w-4 text-muted-foreground" />,
    conflicted: <FileText className="h-4 w-4 text-orange-600" />
  }[currentDiff.status]

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {statusIcon}
          <span className="font-mono text-sm truncate">{selectedFile}</span>
          {selectedFileStaged && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-green-600/20 text-green-700 dark:text-green-400">
              staged
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Stats */}
          <div className="flex items-center gap-2 text-xs">
            {currentDiff.additions > 0 && (
              <span className="flex items-center gap-0.5 text-green-600">
                <Plus className="h-3 w-3" />
                {currentDiff.additions}
              </span>
            )}
            {currentDiff.deletions > 0 && (
              <span className="flex items-center gap-0.5 text-red-600">
                <Minus className="h-3 w-3" />
                {currentDiff.deletions}
              </span>
            )}
          </div>

          {/* Stage/Unstage button */}
          {selectedFileStaged ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => unstageFile(selectedFile)}
            >
              <Minus className="h-3 w-3 mr-1" />
              Unstage
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => stageFile(selectedFile)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Stage
            </Button>
          )}

          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={clearSelectedFile}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Diff content */}
      <ScrollArea className="flex-1 min-h-0">
        <DiffContent diff={currentDiff} />
      </ScrollArea>
    </div>
  )
}
