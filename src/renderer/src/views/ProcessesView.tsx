import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  StopCircle,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw
} from 'lucide-react'
import type { RunningTaskInfo } from '@shared/ipc-types'

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

function getStateColor(state: RunningTaskInfo['state']): string {
  switch (state) {
    case 'running':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/30'
    case 'paused':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
    case 'completed':
      return 'bg-green-500/10 text-green-500 border-green-500/30'
    case 'failed':
    case 'timed_out':
      return 'bg-red-500/10 text-red-500 border-red-500/30'
    case 'cancelled':
      return 'bg-gray-500/10 text-gray-500 border-gray-500/30'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

interface ProcessCardProps {
  process: RunningTaskInfo
  onCancel: () => void
  isCancelling: boolean
}

function ProcessCard({ process, onCancel, isCancelling }: ProcessCardProps) {
  const isRunning = process.state === 'running'
  const canCancel = isRunning && !isCancelling

  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={getStateColor(process.state)}>
              {process.state === 'timed_out' ? 'Timed Out' : process.state}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono truncate">
              PID: {process.pid}
            </span>
          </div>

          <p className="text-sm font-medium truncate" title={process.taskId}>
            Task: {process.taskId.slice(0, 8)}...
          </p>

          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(process.elapsedMs)}
            </span>
            <span>Agent: {process.agentId}</span>
          </div>

          {process.error && (
            <div className="flex items-center gap-1 mt-2 text-xs text-red-500">
              <AlertTriangle className="h-3 w-3" />
              {process.error}
            </div>
          )}
        </div>

        {canCancel && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onCancel}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <StopCircle className="h-4 w-4 mr-1" />
                Kill
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

export function ProcessesView() {
  const [processes, setProcesses] = useState<RunningTaskInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [cancellingTask, setCancellingTask] = useState<string | null>(null)

  const fetchProcesses = useCallback(async () => {
    try {
      const result = await window.api.getRunningTasks()
      setProcesses(result)
    } catch (err) {
      console.error('Failed to fetch processes:', err)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchProcesses().finally(() => setLoading(false))

    // Poll every 2 seconds
    const interval = setInterval(fetchProcesses, 2000)
    return () => clearInterval(interval)
  }, [fetchProcesses])

  const handleCancelTask = async (taskId: string) => {
    setCancellingTask(taskId)
    try {
      await window.api.cancelTask(taskId)
      // Refresh immediately after cancel
      await fetchProcesses()
    } catch (err) {
      console.error('Failed to cancel task:', err)
    } finally {
      setCancellingTask(null)
    }
  }

  const runningProcesses = processes.filter((p) => p.state === 'running')
  const otherProcesses = processes.filter((p) => p.state !== 'running')

  return (
    <div className="h-full flex flex-col">
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Activity className="h-6 w-6" />
              Process Monitor
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and manage active agent processes
            </p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-xs text-muted-foreground">
              Auto-refreshes every 2 seconds
            </p>
            <Button variant="outline" size="sm" onClick={fetchProcesses}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : processes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mb-3 opacity-50" />
            <p>No active processes</p>
            <p className="text-sm">Processes will appear here when tasks are running</p>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            {runningProcesses.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Running ({runningProcesses.length})
                </h3>
                <div className="space-y-2">
                  {runningProcesses.map((process) => (
                    <ProcessCard
                      key={process.taskId}
                      process={process}
                      onCancel={() => handleCancelTask(process.taskId)}
                      isCancelling={cancellingTask === process.taskId}
                    />
                  ))}
                </div>
              </div>
            )}

            {otherProcesses.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Recent ({otherProcesses.length})
                </h3>
                <div className="space-y-2">
                  {otherProcesses.map((process) => (
                    <ProcessCard
                      key={process.taskId}
                      process={process}
                      onCancel={() => handleCancelTask(process.taskId)}
                      isCancelling={cancellingTask === process.taskId}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
