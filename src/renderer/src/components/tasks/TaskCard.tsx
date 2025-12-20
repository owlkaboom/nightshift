import { cn } from '@/lib/utils'
import type { TaskManifest } from '@shared/types'
import {
  AlertTriangle,
  Bot,
  Clock,
  Cpu,
  ListPlus,
  Pause,
  Pencil,
  Play,
  Square,
  Timer,
  Trash2
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MarkdownRenderer } from '@/components/ui/markdown-renderer'
import { useTaskStore } from '@/stores/task-store'
import { useConfigStore } from '@/stores/config-store'
import { useAgentCacheStore } from '@/stores/agent-cache-store'

interface TaskCardProps {
  task: TaskManifest
  projectName?: string
  onStatusChange?: (status: TaskManifest['status']) => void
  onEdit?: () => void
  onDelete?: () => void
  onClick?: () => void
  compact?: boolean
  isDragging?: boolean
  isFocused?: boolean
}

export function TaskCard({
  task,
  projectName,
  onStatusChange,
  onEdit,
  onDelete,
  onClick,
  compact = false,
  isDragging = false,
  isFocused = false
}: TaskCardProps) {
  const [runtime, setRuntime] = useState<string>('')

  // Get running tasks count and max concurrent limit
  // Use a selector that counts running tasks directly to avoid creating new arrays on each render
  const runningCount = useTaskStore((state) =>
    state.tasks.filter((t) => t.status === 'running' || t.status === 'awaiting_agent').length
  )
  const config = useConfigStore((state) => state.config)
  const maxConcurrentTasks = config?.maxConcurrentTasks ?? 1

  // Use cached agents for instant loading
  const agents = useAgentCacheStore((state) => state.agents)

  // Can start if task is queued AND we're below the max concurrent limit
  const canStart = task.status === 'queued' && runningCount < maxConcurrentTasks
  const canPause = task.status === 'running'
  const canResume = task.status === 'paused'
  const canCancel = ['queued', 'running', 'paused', 'awaiting_agent'].includes(task.status)

  // Format milliseconds to human readable string
  const formatRuntime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    if (totalSeconds < 60) {
      return `${totalSeconds}s`
    } else if (totalSeconds < 3600) {
      const mins = Math.floor(totalSeconds / 60)
      const secs = totalSeconds % 60
      return `${mins}m ${secs}s`
    } else {
      const hours = Math.floor(totalSeconds / 3600)
      const mins = Math.floor((totalSeconds % 3600) / 60)
      return `${hours}h ${mins}m`
    }
  }

  // Update runtime every second for running/awaiting_agent tasks
  // Uses accumulated runtimeMs + current session time for accurate tracking across pause/resume
  useEffect(() => {
    if (task.status !== 'running' && task.status !== 'awaiting_agent') {
      // For non-running tasks, show final accumulated runtime if available
      if (task.runtimeMs && task.runtimeMs > 0) {
        setRuntime(formatRuntime(task.runtimeMs))
      } else {
        setRuntime('')
      }
      return
    }

    const updateRuntime = () => {
      // Start with accumulated runtime from previous sessions
      let totalMs = task.runtimeMs || 0

      // Add current session time if running
      if (task.runningSessionStartedAt) {
        const sessionStart = new Date(task.runningSessionStartedAt).getTime()
        totalMs += Date.now() - sessionStart
      }

      setRuntime(formatRuntime(totalMs))
    }

    updateRuntime()
    const interval = setInterval(updateRuntime, 1000)
    return () => clearInterval(interval)
  }, [task.status, task.runtimeMs, task.runningSessionStartedAt])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Get agent display name from agent ID
  const getAgentName = (agentId: string | null): string | null => {
    if (!agentId) return null
    const agent = agents.find((a) => a.id === agentId)
    return agent?.name || agentId
  }

  // Format model name for display (shorten long model IDs)
  const formatModelName = (model: string | null): string | null => {
    if (!model) return null
    // Extract readable name from model ID (e.g., "claude-sonnet-4-20250514" -> "Sonnet 4")
    if (model.includes('sonnet-4')) return 'Sonnet 4'
    if (model.includes('opus-4')) return 'Opus 4'
    if (model.includes('3-5-sonnet')) return 'Sonnet 3.5'
    if (model.includes('3-5-haiku')) return 'Haiku 3.5'
    if (model.includes('gemini-2.5-pro')) return '2.5 Pro'
    if (model.includes('gemini-2.5-flash')) return '2.5 Flash'
    if (model.includes('gemini-2.0')) return '2.0'
    if (model.includes('gemini-1.5')) return '1.5'
    // For OpenRouter models like "anthropic/claude-sonnet-4"
    if (model.includes('/')) {
      const modelPart = model.split('/')[1]
      if (modelPart.includes('sonnet-4')) return 'Sonnet 4'
      if (modelPart.includes('opus-4')) return 'Opus 4'
      if (modelPart.includes('gpt-4o-mini')) return 'GPT-4o Mini'
      if (modelPart.includes('gpt-4o')) return 'GPT-4o'
      return modelPart
    }
    // Fallback: truncate to last segment
    const parts = model.split('-')
    return parts.slice(-2).join(' ')
  }

  const agentName = getAgentName(task.agentId)
  const modelDisplay = formatModelName(task.model)

  // Define all action buttons with their properties
  interface ActionButton {
    key: string
    icon: typeof Play
    onClick: () => void
    className?: string
    disabled?: boolean
    title: string
  }

  const actionButtons = useMemo(() => {
    const buttons: ActionButton[] = []

    if (task.status === 'queued') {
      buttons.push({
        key: 'start',
        icon: Play,
        onClick: () => onStatusChange?.('running'),
        className: 'text-green-500 hover:text-green-600 disabled:opacity-40 disabled:cursor-not-allowed',
        disabled: !canStart,
        title: canStart
          ? 'Start Task'
          : `At max concurrent tasks (${runningCount}/${maxConcurrentTasks})`
      })
      buttons.push({
        key: 'edit',
        icon: Pencil,
        onClick: () => onEdit?.(),
        title: 'Edit Task'
      })
    }

    if (task.status === 'backlog') {
      buttons.push({
        key: 'queue',
        icon: ListPlus,
        onClick: () => onStatusChange?.('queued'),
        className: 'text-blue-500 hover:text-blue-600',
        title: 'Move to Queue'
      })
      buttons.push({
        key: 'edit',
        icon: Pencil,
        onClick: () => onEdit?.(),
        title: 'Edit Task'
      })
    }

    if (canPause) {
      buttons.push({
        key: 'pause',
        icon: Pause,
        onClick: () => onStatusChange?.('paused'),
        title: 'Pause'
      })
    }

    if (canResume) {
      buttons.push({
        key: 'resume',
        icon: Play,
        onClick: () => onStatusChange?.('running'),
        title: 'Resume'
      })
    }

    if (canCancel) {
      buttons.push({
        key: 'cancel',
        icon: Square,
        onClick: () => onStatusChange?.('cancelled'),
        title: 'Cancel'
      })
    }

    buttons.push({
      key: 'delete',
      icon: Trash2,
      onClick: () => onDelete?.(),
      className: 'text-destructive hover:text-destructive',
      title: 'Delete'
    })

    return buttons
  }, [
    task.status,
    canStart,
    canPause,
    canResume,
    canCancel,
    runningCount,
    maxConcurrentTasks,
    onStatusChange,
    onEdit,
    onDelete
  ])

  return (
    <Card
      className={cn(
        'group relative cursor-pointer transition-all hover:shadow-md min-h-[180px]',
        isDragging && 'opacity-40 border-dashed border-2 border-muted-foreground/30',
        onClick && 'hover:border-primary/50',
        isFocused && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
      onClick={onClick}
      data-tour="task-card"
    >
      <CardContent className={cn('p-4', compact && 'p-3')}>
        {/* Prompt - show as much as possible */}
        <div className="mb-2 pr-8">
          <MarkdownRenderer
            content={task.prompt}
            maxHeight={compact ? '120px' : '180px'}
            className="text-sm font-medium leading-relaxed [&>p]:mb-1 [&>p:last-child]:mb-0"
          />
        </div>

        {/* Project name */}
        {projectName && (
          <p className="text-xs text-muted-foreground mb-2 truncate">{projectName}</p>
        )}

        {/* Meta info - two rows for better spacing */}
        <div className="flex flex-col gap-1.5">
          {/* First row: Runtime/time and status */}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              {task.status === 'awaiting_agent' ? (
                <div className="flex items-center gap-1 text-amber-500">
                  <Timer className="h-3 w-3 animate-pulse" />
                  <span className="font-medium">Starting...</span>
                </div>
              ) : task.status === 'running' && runtime ? (
                <div className="flex items-center gap-1 text-yellow-500">
                  <Timer className="h-3 w-3 animate-pulse" />
                  <span className="font-medium">{runtime}</span>
                </div>
              ) : runtime ? (
                <div className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  <span>{runtime}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(task.createdAt)}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {task.needsContinuation && task.status === 'needs_review' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="text-xs">
                      <div className="font-semibold mb-1">Additional Work Needed</div>
                      <div>{task.continuationDetails || 'Agent indicated more work is needed'}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
              <Badge variant={task.status} className="text-[10px]">
                {task.status}
              </Badge>
            </div>
          </div>

          {/* Second row: Agent and model info */}
          {(agentName || modelDisplay) && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {agentName && (
                <div className="flex items-center gap-1" title={`Agent: ${task.agentId}`}>
                  <Cpu className="h-3 w-3" />
                  <span>{agentName}</span>
                </div>
              )}
              {modelDisplay && (
                <div className="flex items-center gap-1" title={`Model: ${task.model}`}>
                  <Bot className="h-3 w-3" />
                  <span>{modelDisplay}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      {/* Actions - positioned as overlay on right side, wraps to multiple rows if needed */}
      <div
        className="absolute right-2 top-2 flex flex-wrap items-start justify-end gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity max-w-[40%]"
        onClick={(e) => e.stopPropagation()}
      >
        {actionButtons.map((button) => {
          const Icon = button.icon
          return (
            <Tooltip key={button.key} delayDuration={300}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-7 w-7 bg-background/95 backdrop-blur-sm rounded-md border shadow-sm', button.className)}
                  onClick={button.onClick}
                  disabled={button.disabled}
                >
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{button.title}</p>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </Card>
  )
}
