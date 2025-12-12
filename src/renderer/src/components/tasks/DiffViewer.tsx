import { diffLines, type Change } from 'diff'
import { useMemo } from 'react'

interface DiffViewerProps {
  oldContent: string
  newContent: string
  fileName?: string
}

export function DiffViewer({ oldContent, newContent, fileName }: DiffViewerProps) {
  const diff = useMemo(() => {
    return diffLines(oldContent || '', newContent || '')
  }, [oldContent, newContent])

  return (
    <div className="border border-border rounded-md overflow-hidden">
      {fileName && (
        <div className="bg-muted/50 px-3 py-1.5 border-b border-border">
          <span className="text-xs font-medium text-muted-foreground">Changes Preview</span>
          {fileName && <span className="text-xs text-muted-foreground ml-2">• {fileName}</span>}
        </div>
      )}
      <div className="max-h-[400px] overflow-y-auto bg-background/50">
        <div className="font-mono text-xs">
          {diff.map((change: Change, index: number) => {
            const lines = change.value.split('\n')
            // Remove last empty line if it exists
            if (lines[lines.length - 1] === '') {
              lines.pop()
            }

            return lines.map((line: string, lineIndex: number) => {
              const key = `${index}-${lineIndex}`

              if (change.added) {
                return (
                  <div
                    key={key}
                    className="bg-green-500/10 border-l-2 border-green-500/50 px-3 py-0.5"
                  >
                    <span className="text-green-400 select-none mr-2">+</span>
                    <span className="text-green-300/90">{line || ' '}</span>
                  </div>
                )
              }

              if (change.removed) {
                return (
                  <div
                    key={key}
                    className="bg-red-500/10 border-l-2 border-red-500/50 px-3 py-0.5"
                  >
                    <span className="text-red-400 select-none mr-2">-</span>
                    <span className="text-red-300/90">{line || ' '}</span>
                  </div>
                )
              }

              // Unchanged lines
              return (
                <div
                  key={key}
                  className="px-3 py-0.5 text-muted-foreground/70"
                >
                  <span className="select-none mr-2 opacity-0"> </span>
                  <span>{line || ' '}</span>
                </div>
              )
            })
          })}
        </div>
      </div>
    </div>
  )
}
