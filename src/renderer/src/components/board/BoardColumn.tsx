import { useDroppable } from '@dnd-kit/core'
import { History, ChevronRight, ChevronLeft } from 'lucide-react'
import type { TaskManifest, TaskStatus } from '@shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { VirtualizedTaskList } from './VirtualizedTaskList'

interface BoardColumnProps {
  id: TaskStatus | string
  title: string
  tasks: TaskManifest[]
  projectNames: Record<string, string>
  onStatusChange?: (task: TaskManifest, status: TaskStatus) => void
  onEdit?: (task: TaskManifest) => void
  onDelete?: (task: TaskManifest) => void
  onTaskClick?: (task: TaskManifest) => void
  // For review column toggle
  showCompletedToggle?: boolean
  showCompleted?: boolean
  onToggleCompleted?: () => void
  completedCount?: number
  // Keyboard navigation
  focusedTaskId?: string | null
  // For backlog column
  isBacklog?: boolean
  isBacklogExpanded?: boolean
  onToggleBacklog?: () => void
  backlogCount?: number
}

const columnColors: Record<string, string> = {
  backlog: 'border-t-gray-500',
  queued: 'border-t-blue-500',
  'in-progress': 'border-t-yellow-500', // Compound column
  awaiting_agent: 'border-t-amber-500',
  running: 'border-t-yellow-500',
  paused: 'border-t-orange-500',
  review: 'border-t-purple-500', // Compound column
  completed: 'border-t-green-500',
  failed: 'border-t-red-500',
  cancelled: 'border-t-slate-500',
  needs_review: 'border-t-purple-500',
  rejected: 'border-t-rose-500'
}

export function BoardColumn({
  id,
  title,
  tasks,
  projectNames,
  onStatusChange,
  onEdit,
  onDelete,
  onTaskClick,
  showCompletedToggle,
  showCompleted,
  onToggleCompleted,
  completedCount = 0,
  focusedTaskId,
  isBacklog = false,
  isBacklogExpanded = false,
  onToggleBacklog,
  backlogCount = 0
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'column',
      columnId: id
    }
  })

  const taskIds = tasks.map((t) => `${t.projectId}-${t.id}`)

  // Get the color for the column border - use 'completed' for review column
  const colorKey = id as TaskStatus
  const borderColor = columnColors[colorKey] || 'border-t-green-500'

  return (
    <div
      className={cn(
        'flex h-full transition-all',
        isBacklog && 'relative'
      )}
    >
      {/* Backlog toggle tab (visible when collapsed) */}
      {isBacklog && !isBacklogExpanded && (
        <button
          onClick={onToggleBacklog}
          className={cn(
            'absolute right-0 top-0 bottom-0 w-12 bg-muted/30 border-t-4 border-r rounded-r-lg',
            'flex flex-col items-center justify-start pt-4 gap-3',
            'hover:bg-muted/50 transition-colors group z-20',
            borderColor
          )}
          title="Show backlog"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors [writing-mode:vertical-lr] rotate-180">
              Backlog
            </span>
            {backlogCount > 0 && (
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {backlogCount}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Column content - entire column is droppable */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col min-w-[280px] sm:min-w-[300px] max-w-[350px] h-full bg-muted/30 rounded-lg border-t-4 transition-all duration-200',
          borderColor,
          isOver && 'ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/10',
          isBacklog && !isBacklogExpanded && 'opacity-0 pointer-events-none',
          isBacklog && isBacklogExpanded && 'opacity-100 shadow-2xl'
        )}
      >
        {/* Column Header */}
        <div className="p-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold capitalize">{title}</h3>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {tasks.length}
              </span>
            </div>
            {showCompletedToggle && (
              <Button
                variant={showCompleted ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={onToggleCompleted}
                title={showCompleted ? 'Hide completed tasks' : 'Show completed tasks'}
              >
                <History className="h-3 w-3" />
                {completedCount > 0 && (
                  <span className="text-muted-foreground">{completedCount}</span>
                )}
              </Button>
            )}
            {isBacklog && isBacklogExpanded && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={onToggleBacklog}
                title="Hide backlog"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Task List */}
        <VirtualizedTaskList
          tasks={tasks}
          taskIds={taskIds}
          projectNames={projectNames}
          onStatusChange={onStatusChange}
          onEdit={onEdit}
          onDelete={onDelete}
          onTaskClick={onTaskClick}
          focusedTaskId={focusedTaskId}
        />
      </div>
    </div>
  )
}
