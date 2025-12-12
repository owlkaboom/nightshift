/**
 * TaskDayPanel Component
 *
 * Displays detailed task list for a selected day
 */

import { format } from 'date-fns'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCalendarStore } from '@/stores'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { MarkdownRenderer } from '@/components/ui/markdown-renderer'
import type { TaskManifest } from '@shared/types'

interface TaskDayPanelProps {
  /** Optional className for styling */
  className?: string
  /** Callback when task is clicked */
  onTaskClick?: (task: TaskManifest) => void
}

export function TaskDayPanel({ className, onTaskClick }: TaskDayPanelProps) {
  const { selectedDate, getTasksForDate } = useCalendarStore()

  if (!selectedDate) {
    return (
      <div
        className={cn(
          'flex items-center justify-center p-8 text-center text-muted-foreground',
          className
        )}
      >
        <p>Select a day to view completed tasks</p>
      </div>
    )
  }

  const tasks = getTasksForDate(selectedDate)
  const dateObj = new Date(selectedDate)

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="border-b pb-3 p-4 flex-shrink-0">
        <h3 className="text-lg font-semibold">
          {format(dateObj, 'EEEE, MMMM d, yyyy')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} completed
        </p>
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="flex items-center justify-center p-8 text-center text-muted-foreground flex-1">
          <p>No tasks completed on this day</p>
        </div>
      ) : (
        <TooltipProvider>
          <div className="flex flex-col gap-2 overflow-y-auto p-4 flex-1">
            {tasks.map((task) => (
              <TaskDayItem
                key={task.id}
                task={task}
                onClick={() => onTaskClick?.(task)}
              />
            ))}
          </div>
        </TooltipProvider>
      )}
    </div>
  )
}

interface TaskDayItemProps {
  task: TaskManifest
  onClick?: () => void
}

function TaskDayItem({ task, onClick }: TaskDayItemProps) {
  // Status icon and color
  const statusInfo = getStatusInfo(task.status)

  // Extract first line of prompt as title
  const title = task.prompt.split('\n')[0].slice(0, 100)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
            'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring'
          )}
        >
          {/* Status icon */}
          <div className={cn('mt-0.5', statusInfo.color)}>{statusInfo.icon}</div>

          {/* Task info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{title}</p>

            {/* Metadata */}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className={cn('flex items-center gap-1', statusInfo.color)}>
                {statusInfo.label}
              </span>

              {task.completedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(task.completedAt), 'h:mm a')}
                </span>
              )}

              {task.runtimeMs > 0 && (
                <span>{formatRuntime(task.runtimeMs)}</span>
              )}
            </div>
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-md">
        <MarkdownRenderer content={task.prompt} className="text-sm" />
      </TooltipContent>
    </Tooltip>
  )
}

function getStatusInfo(status: string): {
  icon: React.ReactNode
  label: string
  color: string
} {
  switch (status) {
    case 'completed':
      return {
        icon: <CheckCircle2 className="w-4 h-4" />,
        label: 'Completed',
        color: 'text-green-600 dark:text-green-500'
      }
    case 'rejected':
      return {
        icon: <XCircle className="w-4 h-4" />,
        label: 'Rejected',
        color: 'text-red-600 dark:text-red-500'
      }
    case 'needs_review':
      return {
        icon: <Clock className="w-4 h-4" />,
        label: 'Needs Review',
        color: 'text-yellow-600 dark:text-yellow-500'
      }
    default:
      return {
        icon: <CheckCircle2 className="w-4 h-4" />,
        label: status,
        color: 'text-muted-foreground'
      }
  }
}

function formatRuntime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}
