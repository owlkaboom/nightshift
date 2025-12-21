/**
 * TaskDetailView - Task detail panel with logs viewer and review actions
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { formatKbd, formatKbdParts } from '@/hooks/useKeyboardShortcuts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { LogViewer } from './LogViewer'
import { RepromptDialog } from './RepromptDialog'
import { ReplyDialog } from './ReplyDialog'
import { PlanReviewPanel } from './PlanReviewPanel'
import { AcceptPlanDialog } from './AcceptPlanDialog'
import { MarkdownRenderer } from '@/components/ui/markdown-renderer'
import {
  ArrowLeft,
  Clock,
  RefreshCw,
  Check,
  X,
  RotateCcw,
  History,
  Play,
  FileText,
  Bot,
  Cpu,
  Square,
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Coins
} from 'lucide-react'
import { useTaskStore } from '@/stores'
import { useKeyboardShortcuts, type KeyboardShortcut } from '@/hooks'
import type { TaskManifest } from '@shared/types'
import { calculateTokenMetrics } from '@shared/types'
import type { AgentInfo } from '@shared/ipc-types'

interface TaskDetailViewProps {
  task: TaskManifest
  projectName: string
  onBack: () => void
  onTaskUpdated?: () => void
}

const statusColors: Record<string, string> = {
  queued: 'bg-slate-500',
  running: 'bg-blue-500',
  paused: 'bg-yellow-500',
  cancelled: 'bg-gray-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  needs_review: 'bg-purple-500',
  rejected: 'bg-rose-500'
}

export function TaskDetailView({
  task,
  projectName,
  onBack,
  onTaskUpdated
}: TaskDetailViewProps) {
  const [logs, setLogs] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [viewingIteration, setViewingIteration] = useState<number>(task.currentIteration || 1)
  const [repromptDialogOpen, setRepromptDialogOpen] = useState(false)
  const [replyDialogOpen, setReplyDialogOpen] = useState(false)
  const [acceptPlanDialogOpen, setAcceptPlanDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [isPromptCollapsed, setIsPromptCollapsed] = useState(false)

  const { acceptTask, rejectTask, repromptTask, replyToTask, acceptPlanAndCreateTask } = useTaskStore()

  // Check if this is a plan mode task
  const isPlanMode = task.isPlanMode === true
  const planFilePath = task.planFilePath || null

  // Determine what actions to show based on task status
  // Using useMemo to ensure these are recalculated when task.status changes
  const hasMultipleIterations = useMemo(
    () => task.iterations && task.iterations.length > 0,
    [task.iterations]
  )
  const showReviewActions = useMemo(() => task.status === 'needs_review', [task.status])
  const showRepromptForFailed = useMemo(() => task.status === 'failed', [task.status])
  const showPlanModeActions = useMemo(
    () => showReviewActions && isPlanMode,
    [showReviewActions, isPlanMode]
  )
  const showRunningActions = useMemo(
    () => task.status === 'running' || task.status === 'awaiting_agent',
    [task.status]
  )
  // Show Reply button only for Claude Code tasks with sessionId (supports --resume)
  const canReply = useMemo(
    () => (showReviewActions || showRepromptForFailed) &&
          task.sessionId &&
          task.agentId === 'claude-code',
    [showReviewActions, showRepromptForFailed, task.sessionId, task.agentId]
  )

  // Get the prompt for the currently viewing iteration
  const getIterationPrompt = useCallback(() => {
    if (!task.iterations || task.iterations.length === 0) {
      return task.prompt
    }
    const iteration = task.iterations.find((i) => i.iteration === viewingIteration)
    return iteration?.prompt || task.prompt
  }, [task, viewingIteration])

  const loadData = useCallback(async () => {
    setIsLoading(true)

    try {
      // Load logs for the selected iteration
      const logData = await window.api.readIterationLog(
        task.projectId,
        task.id,
        viewingIteration
      )
      setLogs(logData || '')
    } catch (error) {
      console.error('Failed to load task data:', error)
      // Fallback to legacy log reading
      try {
        const legacyLogs = await window.api.readTaskLog(task.projectId, task.id)
        setLogs(legacyLogs || '')
      } catch {
        setLogs('')
      }
    } finally {
      setIsLoading(false)
    }
  }, [task.projectId, task.id, viewingIteration])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Auto-refresh logs for running tasks
  useEffect(() => {
    if (!showRunningActions) return

    // Refresh logs every second while task is running
    const interval = setInterval(() => {
      loadData()
    }, 1000)

    return () => clearInterval(interval)
  }, [showRunningActions, loadData])

  // Reset to current iteration when task changes
  useEffect(() => {
    setViewingIteration(task.currentIteration || 1)
  }, [task.id, task.currentIteration])

  // Load agents list
  useEffect(() => {
    window.api.listAgents().then(setAgents).catch(console.error)
  }, [])

  const getDuration = () => {
    if (!task.startedAt) return null
    const start = new Date(task.startedAt)
    const end = task.completedAt ? new Date(task.completedAt) : new Date()
    const diff = Math.floor((end.getTime() - start.getTime()) / 1000)

    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
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

  // Format usage stats for display
  const formatUsageStats = () => {
    if (!task.totalUsage) return null

    const metrics = calculateTokenMetrics(task.totalUsage)
    const { inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens, costUsd } = task.totalUsage

    // Format tokens with K/M suffix for readability
    const formatTokenCount = (count: number): string => {
      if (count >= 1_000_000) {
        return `${(count / 1_000_000).toFixed(1)}M`
      } else if (count >= 1_000) {
        return `${(count / 1_000).toFixed(1)}K`
      }
      return count.toString()
    }

    // Format cost if available
    const costDisplay = costUsd !== null ? ` ($${costUsd.toFixed(4)})` : ''

    return {
      // True tokens (what actually matters for usage)
      trueTokens: formatTokenCount(metrics.trueTokens),
      cachedTokens: formatTokenCount(metrics.cachedTokens),
      totalTokens: formatTokenCount(metrics.totalTokens),
      // Breakdown for tooltip
      inputTokens: formatTokenCount(inputTokens),
      outputTokens: formatTokenCount(outputTokens),
      cacheRead: formatTokenCount(cacheReadInputTokens),
      cacheCreation: formatTokenCount(cacheCreationInputTokens),
      cost: costDisplay,
      hasCacheUsage: metrics.hasCacheUsage
    }
  }

  const usageStats = formatUsageStats()

  const handleAccept = async () => {
    setIsSubmitting(true)
    try {
      await acceptTask(task.projectId, task.id)
      onTaskUpdated?.()
      onBack()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    setIsSubmitting(true)
    try {
      await rejectTask(task.projectId, task.id)
      onTaskUpdated?.()
      onBack()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReprompt = async (newPrompt: string) => {
    setIsSubmitting(true)
    try {
      await repromptTask(task.projectId, task.id, newPrompt)
      onTaskUpdated?.()
      onBack()
    } finally {
      setIsSubmitting(false)
      setRepromptDialogOpen(false)
    }
  }

  const handleReply = async (replyMessage: string) => {
    setIsSubmitting(true)
    try {
      await replyToTask(task.projectId, task.id, replyMessage)
      onTaskUpdated?.()
      onBack()
    } finally {
      setIsSubmitting(false)
      setReplyDialogOpen(false)
    }
  }

  const handleAcceptPlanAndExecute = async (executionPrompt: string) => {
    setIsSubmitting(true)
    try {
      await acceptPlanAndCreateTask(task.projectId, task.id, executionPrompt)
      onTaskUpdated?.()
      onBack()
    } finally {
      setIsSubmitting(false)
      setAcceptPlanDialogOpen(false)
    }
  }

  const handleCancel = async () => {
    setIsSubmitting(true)
    try {
      await window.api.cancelTask(task.id)
      onTaskUpdated?.()
      // Don't navigate back, let user see final logs
    } finally {
      setIsSubmitting(false)
    }
  }

  // Keyboard shortcut handlers
  const handleOpenReprompt = useCallback(() => {
    if ((showReviewActions || showRepromptForFailed) && !isSubmitting) {
      setRepromptDialogOpen(true)
    }
  }, [showReviewActions, showRepromptForFailed, isSubmitting])

  // Review view keyboard shortcuts
  const reviewShortcuts: KeyboardShortcut[] = useMemo(
    () => [
      {
        key: 'y',
        meta: true,
        handler: () => { if (showReviewActions && !isSubmitting) handleAccept() },
        description: 'Accept task'
      },
      {
        key: 'u',
        meta: true,
        handler: () => { if (showReviewActions && !isSubmitting) handleReject() },
        description: 'Reject task'
      },
      {
        key: 'p',
        meta: true,
        shift: true,
        handler: handleOpenReprompt,
        description: 'Re-prompt task'
      },
      {
        key: 'x',
        handler: () => { if (showRunningActions && !isSubmitting) handleCancel() },
        description: 'Cancel running task'
      },
      {
        key: 'Escape',
        handler: () => {
          if (repromptDialogOpen) {
            setRepromptDialogOpen(false)
          } else if (acceptPlanDialogOpen) {
            setAcceptPlanDialogOpen(false)
          } else {
            onBack()
          }
        },
        description: 'Go back / Close dialog'
      },
    ],
    [showReviewActions, showRunningActions, isSubmitting, handleAccept, handleReject, handleOpenReprompt, handleCancel, repromptDialogOpen, acceptPlanDialogOpen, onBack]
  )

  useKeyboardShortcuts(reviewShortcuts, { enabled: !repromptDialogOpen || true })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium">{projectName}</span>
            {hasMultipleIterations && (
              <span className="text-xs">
                • Run {task.currentIteration}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status & Actions Bar - Running */}
      {showRunningActions && (
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border-b border-border">
          <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300 mr-auto">
            {task.status === 'awaiting_agent' ? 'Starting agent...' : 'Task running...'}
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCancel}
            disabled={isSubmitting}
            title="Cancel task (X)"
          >
            <Square className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
        </div>
      )}

      {/* Status & Actions Bar - Plan Mode Review */}
      {showPlanModeActions && (
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border-b border-border">
          <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300 mr-auto">
            Review this plan:
          </span>
          <Button
            variant="outline"
            size="sm"
            className="border-blue-300 hover:bg-blue-100 dark:border-blue-700 dark:hover:bg-blue-900"
            onClick={() => setRepromptDialogOpen(true)}
            disabled={isSubmitting}
            title="Re-prompt task"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Re-prompt
            <div className="hidden md:flex items-center gap-0.5 ml-1.5">
              {formatKbdParts('⌘⇧P').map((part, index, array) => (
                <span key={index} className="flex items-center gap-0.5">
                  <kbd className="text-muted-foreground bg-muted px-1 py-0.5 rounded text-xs opacity-60">
                    {part}
                  </kbd>
                  {index < array.length - 1 && (
                    <span className="text-muted-foreground text-xs px-0.5 opacity-60">+</span>
                  )}
                </span>
              ))}
            </div>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleReject}
            disabled={isSubmitting}
            title={`Reject plan (${formatKbd('⌘U')})`}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Reject
            <kbd className="hidden md:inline ml-1.5 text-xs opacity-60">{formatKbd('⌘U')}</kbd>
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleAccept}
            disabled={isSubmitting}
            title={`Accept plan only (${formatKbd('⌘Y')})`}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Accept
            <kbd className="hidden md:inline ml-1.5 text-xs opacity-60">{formatKbd('⌘Y')}</kbd>
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setAcceptPlanDialogOpen(true)}
            disabled={isSubmitting}
            title="Accept plan and create execution task"
          >
            <Play className="h-3.5 w-3.5 mr-1" />
            Accept & Execute
          </Button>
        </div>
      )}

      {/* Status & Actions Bar - Regular Review */}
      {showReviewActions && !isPlanMode && (
        <div className="flex items-center gap-2 px-4 py-3 bg-purple-50 dark:bg-purple-950/30 border-b border-border">
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300 mr-auto">
            Review this task:
          </span>
          <Button
            variant="outline"
            size="sm"
            className="border-purple-300 hover:bg-purple-100 dark:border-purple-700 dark:hover:bg-purple-900"
            onClick={() => setRepromptDialogOpen(true)}
            disabled={isSubmitting}
            title="Re-prompt task"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Re-prompt
            <div className="hidden md:flex items-center gap-0.5 ml-1.5">
              {formatKbdParts('⌘⇧P').map((part, index, array) => (
                <span key={index} className="flex items-center gap-0.5">
                  <kbd className="text-muted-foreground bg-muted px-1 py-0.5 rounded text-xs opacity-60">
                    {part}
                  </kbd>
                  {index < array.length - 1 && (
                    <span className="text-muted-foreground text-xs px-0.5 opacity-60">+</span>
                  )}
                </span>
              ))}
            </div>
          </Button>
          {canReply && (
            <Button
              variant="outline"
              size="sm"
              className="border-blue-300 hover:bg-blue-100 dark:border-blue-700 dark:hover:bg-blue-900"
              onClick={() => setReplyDialogOpen(true)}
              disabled={isSubmitting}
              title="Reply to continue conversation"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Reply
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={handleReject}
            disabled={isSubmitting}
            title={`Reject task (${formatKbd('⌘U')})`}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Reject
            <kbd className="hidden md:inline ml-1.5 text-xs opacity-60">{formatKbd('⌘U')}</kbd>
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleAccept}
            disabled={isSubmitting}
            title={`Accept task (${formatKbd('⌘Y')})`}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Accept
            <kbd className="hidden md:inline ml-1.5 text-xs opacity-60">{formatKbd('⌘Y')}</kbd>
          </Button>
        </div>
      )}

      {/* Status & Actions Bar - Failed */}
      {showRepromptForFailed && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/30 border-b border-border">
          <span className="text-sm text-red-700 dark:text-red-300 mr-auto">
            This task failed. You can retry with context or modify the prompt.
          </span>
          <Button
            variant="outline"
            size="sm"
            className="border-red-300 hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900"
            onClick={() => setRepromptDialogOpen(true)}
            disabled={isSubmitting}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Re-prompt
          </Button>
          {canReply && (
            <Button
              variant="outline"
              size="sm"
              className="border-blue-300 hover:bg-blue-100 dark:border-blue-700 dark:hover:bg-blue-900"
              onClick={() => setReplyDialogOpen(true)}
              disabled={isSubmitting}
              title="Reply to continue conversation"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Reply
            </Button>
          )}
        </div>
      )}

      {/* Status Badge - for non-actionable states */}
      {!showRunningActions && !showReviewActions && !showRepromptForFailed && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Badge className={statusColors[task.status]}>
            {task.status === 'needs_review' ? 'Needs Review' : task.status}
          </Badge>
        </div>
      )}

      {/* Incomplete Work Warning - shows when agent indicated more work is needed */}
      {task.needsContinuation && showReviewActions && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">
                Additional Work Needed
              </div>
              <div className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                {task.continuationDetails ||
                  'The agent indicated that more work is needed to complete this task.'}
              </div>
              {task.continuationReason && (
                <div className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                  Reason:{' '}
                  {task.continuationReason === 'multi-phase'
                    ? 'Multi-phase task'
                    : task.continuationReason === 'todo-items'
                      ? 'TODO items remaining'
                      : task.continuationReason === 'continuation-signal'
                        ? 'Agent plans to continue'
                        : task.continuationReason === 'approval-needed'
                          ? 'Approval needed to proceed'
                          : task.continuationReason === 'token-limit'
                            ? 'Output limit reached'
                            : task.continuationReason}
                </div>
              )}
              {task.suggestedNextSteps && task.suggestedNextSteps.length > 0 && (
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  <div className="font-medium mb-1">Suggested next steps:</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {task.suggestedNextSteps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task Prompt - displayed prominently */}
      <div className="border-b border-border bg-muted/20 shrink-0">
        <button
          onClick={() => setIsPromptCollapsed(!isPromptCollapsed)}
          className="w-full px-4 py-3 flex items-center gap-2 hover:bg-muted/40 transition-colors"
        >
          {isPromptCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
          <div className="text-xs text-muted-foreground">
            {hasMultipleIterations && viewingIteration !== task.currentIteration
              ? `Prompt (Iteration ${viewingIteration})`
              : 'Task Prompt'}
          </div>
        </button>
        {!isPromptCollapsed && (
          <div className="px-4 pb-3">
            <MarkdownRenderer
              content={getIterationPrompt()}
              className="text-sm"
              maxHeight="12rem"
            />
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-6 px-4 py-2 bg-muted/30 border-b border-border text-sm">
        {getDuration() && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{getDuration()}</span>
          </div>
        )}

        {/* Iteration Selector */}
        {hasMultipleIterations && (
          <div className="flex items-center gap-2">
            <History className="h-3.5 w-3.5 text-muted-foreground" />
            <Select
              value={viewingIteration.toString()}
              onValueChange={(val) => setViewingIteration(parseInt(val))}
            >
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Generate all iteration numbers from 1 to currentIteration */}
                {Array.from({ length: task.currentIteration }, (_, i) => i + 1).map((iterNum) => {
                  const iterData = task.iterations?.find(it => it.iteration === iterNum)
                  return (
                    <SelectItem key={iterNum} value={iterNum.toString()}>
                      Run {iterNum}
                      {iterNum === task.currentIteration && ' (current)'}
                      {iterData && iterData.finalStatus === 'failed' && ' (failed)'}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Agent & Model Display */}
        {(agentName || modelDisplay) && (
          <div className="flex items-center gap-3 text-muted-foreground">
            {agentName && (
              <div className="flex items-center gap-1.5" title={`Agent: ${task.agentId}`}>
                <Cpu className="h-3.5 w-3.5" />
                <span>{agentName}</span>
              </div>
            )}
            {modelDisplay && (
              <div className="flex items-center gap-1.5" title={`Model: ${task.model}`}>
                <Bot className="h-3.5 w-3.5" />
                <span>{modelDisplay}</span>
              </div>
            )}
          </div>
        )}

        {/* Usage Stats Display */}
        {usageStats && (
          <div
            className="flex items-center gap-1.5 text-muted-foreground"
            title={usageStats.hasCacheUsage
              ? `True Usage: ${usageStats.trueTokens} tokens (Input: ${usageStats.inputTokens} | Output: ${usageStats.outputTokens} | Cache Creation: ${usageStats.cacheCreation})\nCached: ${usageStats.cachedTokens} tokens (90% discount)\nTotal: ${usageStats.totalTokens} tokens${usageStats.cost}`
              : `Usage: ${usageStats.trueTokens} tokens (Input: ${usageStats.inputTokens} | Output: ${usageStats.outputTokens})${usageStats.cost}`
            }
          >
            <Coins className="h-3.5 w-3.5" />
            {usageStats.hasCacheUsage ? (
              <span className="flex items-center gap-1">
                <span>{usageStats.trueTokens} tokens</span>
                <span className="text-xs opacity-60">+ {usageStats.cachedTokens} cached</span>
                <span>{usageStats.cost}</span>
              </span>
            ) : (
              <span>{usageStats.trueTokens} tokens{usageStats.cost}</span>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={loadData}
          disabled={isLoading}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Plan Review Panel - show plan content for plan mode tasks */}
      {isPlanMode && planFilePath && (
        <PlanReviewPanel planFilePath={planFilePath} />
      )}

      {/* Logs Content */}
      <div className="flex-1 overflow-auto p-4 min-h-0">
        <LogViewer logs={logs} className="h-full" />
      </div>

      {/* Re-prompt Dialog */}
      <RepromptDialog
        open={repromptDialogOpen}
        onOpenChange={setRepromptDialogOpen}
        task={task}
        onReprompt={handleReprompt}
        isSubmitting={isSubmitting}
        showRetryWithContext={task.status === 'failed'}
      />

      {/* Reply Dialog */}
      <ReplyDialog
        open={replyDialogOpen}
        onOpenChange={setReplyDialogOpen}
        task={task}
        onReply={handleReply}
        isSubmitting={isSubmitting}
      />

      {/* Accept Plan Dialog */}
      <AcceptPlanDialog
        open={acceptPlanDialogOpen}
        onOpenChange={setAcceptPlanDialogOpen}
        task={task}
        planFilePath={planFilePath}
        onAcceptAndExecute={handleAcceptPlanAndExecute}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
