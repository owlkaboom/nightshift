/**
 * LogViewer - Displays task execution logs with rich formatting
 */

import { cn } from '@/lib/utils'
import { AgentLogViewer } from '@/components/tasks'

interface LogViewerProps {
  logs: string
  autoScroll?: boolean
  className?: string
}

export function LogViewer({ logs, className }: LogViewerProps) {
  if (!logs || logs.trim() === '') {
    return (
      <div className={cn('rounded-md border border-border bg-muted/50 p-4', className)}>
        <p className="text-sm text-muted-foreground text-center">No logs available</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-zinc-950 overflow-hidden',
        className
      )}
    >
      <AgentLogViewer logs={logs} />
    </div>
  )
}
