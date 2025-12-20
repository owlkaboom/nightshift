import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { TaskManifest, TaskStatus } from '@shared/types'
import { BoardColumn } from './BoardColumn'
import { TaskCard } from '@/components/tasks'
import { cn } from '@/lib/utils'

// Keyboard navigation focus state
type FocusPosition = {
  columnIndex: number
  taskIndex: number
} | null

interface TaskBoardProps {
  tasks: TaskManifest[]
  projectNames: Record<string, string>
  onTaskMove: (task: TaskManifest, newStatus: TaskStatus, sourceColumn: ColumnId, targetColumn: ColumnId, newIndex?: number) => void
  onStatusChange: (task: TaskManifest, status: TaskStatus) => void
  onEdit: (task: TaskManifest) => void
  onDelete: (task: TaskManifest) => void
  onTaskClick: (task: TaskManifest) => void
  onReorder: (updates: Array<{ projectId: string; taskId: string; queuePosition: number }>) => void
  isBacklogExpanded?: boolean
  onToggleBacklog?: () => void
}

export type ColumnId = 'backlog' | 'queued' | 'in-progress' | 'review'

type ColumnConfig = {
  id: ColumnId
  title: string
  statuses: TaskStatus[] // Which task statuses belong in this column
}

// Base columns - backlog is for shelved tasks, review includes tasks awaiting review
const columns: ColumnConfig[] = [
  { id: 'backlog', title: 'Backlog', statuses: ['backlog'] },
  { id: 'queued', title: 'Queued', statuses: ['queued'] },
  { id: 'in-progress', title: 'In Progress', statuses: ['awaiting_agent', 'running', 'paused'] },
  { id: 'review', title: 'Review', statuses: ['needs_review', 'failed'] }
]

// Done statuses that can be toggled to show in review column
const doneStatuses: TaskStatus[] = ['rejected', 'cancelled', 'completed']

// Custom collision detection that balances task and column detection
// Allows reordering within columns while still making cross-column drops easy
const customCollisionDetection: CollisionDetection = (args) => {
  const { active, droppableContainers } = args

  // Get the active item's current column
  const activeTaskData = active.data.current
  const activeTask = activeTaskData?.task as TaskManifest | undefined

  // First, check if pointer is within any droppable containers
  const pointerCollisions = pointerWithin(args)

  if (pointerCollisions.length > 0) {
    // Separate task and column collisions
    const taskCollisions = pointerCollisions.filter((collision) => {
      const id = String(collision.id)
      return !['backlog', 'queued', 'in-progress', 'review'].includes(id)
    })

    const columnCollisions = pointerCollisions.filter((collision) => {
      const id = String(collision.id)
      return ['backlog', 'queued', 'in-progress', 'review'].includes(id)
    })

    // If we have task collisions, check if any are in the same column as the active task
    if (taskCollisions.length > 0 && activeTask) {
      // Find which column this collision's task belongs to
      const firstTaskCollision = taskCollisions[0]

      // Get the task from the collision
      const collisionContainer = droppableContainers.find(c => c.id === firstTaskCollision.id)
      const collisionTaskData = collisionContainer?.data.current
      const collisionTask = collisionTaskData?.task as TaskManifest | undefined

      // If both tasks are in the same column, prefer task collision for reordering
      if (collisionTask && collisionTask.status === activeTask.status) {
        return taskCollisions
      }
    }

    // If we found column collisions and no same-column task collisions, prefer columns
    if (columnCollisions.length > 0) {
      return columnCollisions
    }

    // Otherwise use task collisions for cross-column drops
    return taskCollisions.length > 0 ? taskCollisions : pointerCollisions
  }

  // Fallback to rect intersection if pointer isn't within anything
  const intersectionCollisions = rectIntersection(args)

  if (intersectionCollisions.length > 0) {
    // Separate task and column collisions
    const taskCollisions = intersectionCollisions.filter((collision) => {
      const id = String(collision.id)
      return !['backlog', 'queued', 'in-progress', 'review'].includes(id)
    })

    const columnCollisions = intersectionCollisions.filter((collision) => {
      const id = String(collision.id)
      return ['backlog', 'queued', 'in-progress', 'review'].includes(id)
    })

    // Same logic as above for rect intersections
    if (taskCollisions.length > 0 && activeTask) {
      const firstTaskCollision = taskCollisions[0]
      const collisionContainer = droppableContainers.find(c => c.id === firstTaskCollision.id)
      const collisionTaskData = collisionContainer?.data.current
      const collisionTask = collisionTaskData?.task as TaskManifest | undefined

      if (collisionTask && collisionTask.status === activeTask.status) {
        return taskCollisions
      }
    }

    if (columnCollisions.length > 0) {
      return columnCollisions
    }

    return taskCollisions.length > 0 ? taskCollisions : intersectionCollisions
  }

  // Final fallback to closest center
  return closestCenter(args)
}

export function TaskBoard({
  tasks,
  projectNames,
  onTaskMove,
  onStatusChange,
  onEdit,
  onDelete,
  onTaskClick,
  onReorder,
  isBacklogExpanded: isBacklogExpandedProp,
  onToggleBacklog
}: TaskBoardProps) {
  const [activeTask, setActiveTask] = useState<TaskManifest | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [focusPosition, setFocusPosition] = useState<FocusPosition>(null)
  const [isBacklogExpandedInternal, setIsBacklogExpandedInternal] = useState(false)

  // Use prop if provided, otherwise use internal state
  const isBacklogExpanded = isBacklogExpandedProp ?? isBacklogExpandedInternal

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // Count of done tasks (for the toggle badge)
  const doneCount = useMemo(() => {
    return tasks.filter((t) => doneStatuses.includes(t.status)).length
  }, [tasks])

  // Group tasks by column (each column can contain multiple statuses)
  const tasksByColumn = useMemo(() => {
    const grouped: Record<ColumnId, TaskManifest[]> = {
      'backlog': [],
      'queued': [],
      'in-progress': [],
      'review': []
    }

    tasks.forEach((task) => {
      // Check if it's a done status
      if (doneStatuses.includes(task.status)) {
        // Only add to review if showCompleted is true
        if (showCompleted) {
          grouped.review.push(task)
        }
        return
      }

      // Find which column this task belongs to
      const column = columns.find((col) => col.statuses.includes(task.status))
      if (column) {
        grouped[column.id].push(task)
      }
    })

    // Sort backlog tasks by queuePosition (or createdAt as fallback)
    grouped.backlog.sort((a, b) => a.queuePosition - b.queuePosition)

    // Sort queued tasks by queuePosition
    grouped.queued.sort((a, b) => a.queuePosition - b.queuePosition)

    // Sort in-progress: running first, then paused, then failed, then awaiting_agent (at bottom)
    const statusOrder: Record<string, number> = { running: 0, paused: 1, failed: 2, awaiting_agent: 3 }
    grouped['in-progress'].sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99))

    // Sort review: needs_review and failed first, then all done tasks purely by completedAt (most recent first)
    grouped.review.sort((a, b) => {
      // Active items (needs_review, failed) come before done items
      const aIsDone = doneStatuses.includes(a.status)
      const bIsDone = doneStatuses.includes(b.status)

      if (aIsDone !== bIsDone) {
        return aIsDone ? 1 : -1 // Active items first
      }

      // If both are done, sort by completedAt descending (most recent first)
      if (aIsDone && bIsDone) {
        const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0
        const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0
        return bTime - aTime
      }

      // If both are active (needs_review/failed), maintain order: needs_review before failed
      const reviewStatusOrder: Record<string, number> = {
        needs_review: 0,
        failed: 1
      }
      return (reviewStatusOrder[a.status] ?? 99) - (reviewStatusOrder[b.status] ?? 99)
    })

    return grouped
  }, [tasks, showCompleted])

  // Get ordered columns for navigation
  const orderedColumns = useMemo(() => {
    return columns.map((col) => ({
      id: col.id,
      tasks: tasksByColumn[col.id]
    }))
  }, [tasksByColumn])

  // Get the currently focused task
  const focusedTask = useMemo(() => {
    if (!focusPosition) return null
    const column = orderedColumns[focusPosition.columnIndex]
    if (!column) return null
    return column.tasks[focusPosition.taskIndex] || null
  }, [focusPosition, orderedColumns])

  // Navigation handlers
  const moveUp = useCallback(() => {
    setFocusPosition((prev) => {
      if (!prev) {
        // Start at first task in first non-empty column
        for (let i = 0; i < orderedColumns.length; i++) {
          if (orderedColumns[i].tasks.length > 0) {
            return { columnIndex: i, taskIndex: 0 }
          }
        }
        return null
      }
      if (prev.taskIndex > 0) {
        return { ...prev, taskIndex: prev.taskIndex - 1 }
      }
      return prev
    })
  }, [orderedColumns])

  const moveDown = useCallback(() => {
    setFocusPosition((prev) => {
      if (!prev) {
        // Start at first task in first non-empty column
        for (let i = 0; i < orderedColumns.length; i++) {
          if (orderedColumns[i].tasks.length > 0) {
            return { columnIndex: i, taskIndex: 0 }
          }
        }
        return null
      }
      const column = orderedColumns[prev.columnIndex]
      if (column && prev.taskIndex < column.tasks.length - 1) {
        return { ...prev, taskIndex: prev.taskIndex + 1 }
      }
      return prev
    })
  }, [orderedColumns])

  const moveLeft = useCallback(() => {
    setFocusPosition((prev) => {
      if (!prev) {
        // Start at first task in first non-empty column
        for (let i = 0; i < orderedColumns.length; i++) {
          if (orderedColumns[i].tasks.length > 0) {
            return { columnIndex: i, taskIndex: 0 }
          }
        }
        return null
      }
      // Find previous column with tasks
      for (let i = prev.columnIndex - 1; i >= 0; i--) {
        if (orderedColumns[i].tasks.length > 0) {
          // Keep same task index if possible, otherwise go to last task
          const taskIndex = Math.min(prev.taskIndex, orderedColumns[i].tasks.length - 1)
          return { columnIndex: i, taskIndex }
        }
      }
      return prev
    })
  }, [orderedColumns])

  const moveRight = useCallback(() => {
    setFocusPosition((prev) => {
      if (!prev) {
        // Start at first task in first non-empty column
        for (let i = 0; i < orderedColumns.length; i++) {
          if (orderedColumns[i].tasks.length > 0) {
            return { columnIndex: i, taskIndex: 0 }
          }
        }
        return null
      }
      // Find next column with tasks
      for (let i = prev.columnIndex + 1; i < orderedColumns.length; i++) {
        if (orderedColumns[i].tasks.length > 0) {
          // Keep same task index if possible, otherwise go to last task
          const taskIndex = Math.min(prev.taskIndex, orderedColumns[i].tasks.length - 1)
          return { columnIndex: i, taskIndex }
        }
      }
      return prev
    })
  }, [orderedColumns])

  const openFocusedTask = useCallback(() => {
    if (focusedTask) {
      onTaskClick(focusedTask)
    }
  }, [focusedTask, onTaskClick])

  const clearFocus = useCallback(() => {
    setFocusPosition(null)
  }, [])

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is in an input or textarea
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Don't handle if a dialog/modal is open (role="dialog" is the standard accessibility attribute)
      if (document.querySelector('[role="dialog"]')) {
        return
      }

      // Don't handle if a modifier key is pressed (except shift for some keys)
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 'j':
        case 'arrowdown':
          e.preventDefault()
          moveDown()
          break
        case 'k':
        case 'arrowup':
          e.preventDefault()
          moveUp()
          break
        case 'h':
        case 'arrowleft':
          e.preventDefault()
          moveLeft()
          break
        case 'l':
        case 'arrowright':
          e.preventDefault()
          moveRight()
          break
        case 'enter':
          if (focusedTask) {
            e.preventDefault()
            openFocusedTask()
          }
          break
        case 'escape':
          if (focusPosition) {
            e.preventDefault()
            clearFocus()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [moveUp, moveDown, moveLeft, moveRight, openFocusedTask, clearFocus, focusedTask, focusPosition])

  // Clear focus when tasks change significantly
  useEffect(() => {
    if (focusPosition) {
      const column = orderedColumns[focusPosition.columnIndex]
      if (!column || column.tasks.length === 0) {
        // Column is empty, try to find another column
        for (let i = 0; i < orderedColumns.length; i++) {
          if (orderedColumns[i].tasks.length > 0) {
            setFocusPosition({ columnIndex: i, taskIndex: 0 })
            return
          }
        }
        setFocusPosition(null)
      } else if (focusPosition.taskIndex >= column.tasks.length) {
        // Task index is out of bounds
        setFocusPosition({ ...focusPosition, taskIndex: column.tasks.length - 1 })
      }
    }
  }, [orderedColumns, focusPosition])

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string
    const [projectId, id] = taskId.split('-')
    const task = tasks.find((t) => t.projectId === projectId && t.id === id)
    if (task) {
      setActiveTask(task)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event

    // Expand backlog only when dragging over it or a task within it
    if (over) {
      const overId = over.id as string

      // Check if dragging over backlog column
      if (overId === 'backlog') {
        if (onToggleBacklog && !isBacklogExpanded) {
          onToggleBacklog()
        } else if (!onToggleBacklog) {
          setIsBacklogExpandedInternal(true)
        }
        return
      }

      // Check if dragging over a task in backlog column
      const [overProjectId, overTaskId] = overId.split('-')
      if (overProjectId && overTaskId) {
        const overTask = tasks.find((t) => t.projectId === overProjectId && t.id === overTaskId)
        if (overTask && overTask.status === 'backlog') {
          if (onToggleBacklog && !isBacklogExpanded) {
            onToggleBacklog()
          } else if (!onToggleBacklog) {
            setIsBacklogExpandedInternal(true)
          }
          return
        }
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) {
      // Collapse backlog if drag ended without a drop
      if (onToggleBacklog && isBacklogExpanded) {
        onToggleBacklog()
      } else if (!onToggleBacklog) {
        setIsBacklogExpandedInternal(false)
      }
      return
    }

    const activeId = active.id as string
    const [activeProjectId, activeTaskId] = activeId.split('-')
    const task = tasks.find((t) => t.projectId === activeProjectId && t.id === activeTaskId)

    if (!task) return

    const overId = over.id as string

    // Find which column the task belongs to
    const getColumnForTask = (t: TaskManifest): ColumnId | null => {
      // Done statuses go to review column when visible
      if (doneStatuses.includes(t.status)) {
        return showCompleted ? 'review' : null
      }
      const col = columns.find((c) => c.statuses.includes(t.status))
      return col?.id ?? null
    }

    // Check if dropped on a column
    const droppedColumn = columns.find((col) => col.id === overId)

    if (droppedColumn) {
      const sourceColumn = getColumnForTask(task)
      if (!sourceColumn) return

      // Don't allow dropping onto the same column
      if (sourceColumn === droppedColumn.id) return

      // Moving to a column - use the first status in that column
      const newStatus = droppedColumn.statuses[0]
      onTaskMove(task, newStatus, sourceColumn, droppedColumn.id)
      return
    }

    // Dropped on another task - reorder within same column or move to new column
    const [overProjectId, overTaskId] = overId.split('-')
    const overTask = tasks.find((t) => t.projectId === overProjectId && t.id === overTaskId)

    if (!overTask) return

    const taskColumn = getColumnForTask(task)
    const overTaskColumn = getColumnForTask(overTask)

    if (taskColumn === overTaskColumn && taskColumn) {
      // Reordering within same column
      const columnTasks = [...tasksByColumn[taskColumn]]
      const oldIndex = columnTasks.findIndex(
        (t) => t.projectId === task.projectId && t.id === task.id
      )
      const newIndex = columnTasks.findIndex(
        (t) => t.projectId === overTask.projectId && t.id === overTask.id
      )

      if (oldIndex !== newIndex) {
        // Reorder the array
        const [movedTask] = columnTasks.splice(oldIndex, 1)
        columnTasks.splice(newIndex, 0, movedTask)

        // Generate new queue positions for all tasks in the new order
        // Use index * 1000 to leave room for future insertions
        const updates = columnTasks.map((t, idx) => ({
          projectId: t.projectId,
          taskId: t.id,
          queuePosition: idx * 1000
        }))

        onReorder(updates)
      }
    } else if (overTaskColumn && taskColumn) {
      // Moving to different column - use the first status of that column
      const targetColumn = columns.find((c) => c.id === overTaskColumn)
      if (targetColumn) {
        const newStatus = targetColumn.statuses[0]
        const newColumnTasks = tasksByColumn[overTaskColumn]
        const newIndex = newColumnTasks.findIndex(
          (t) => t.projectId === overTask.projectId && t.id === overTask.id
        )
        onTaskMove(task, newStatus, taskColumn, overTaskColumn, newIndex)
      }
    }

    // Collapse backlog only if the drop target was NOT the backlog
    const isDropTargetBacklog = overId === 'backlog' ||
      (overTask && overTask.status === 'backlog')

    if (!isDropTargetBacklog) {
      if (onToggleBacklog && isBacklogExpanded) {
        onToggleBacklog()
      } else if (!onToggleBacklog) {
        setIsBacklogExpandedInternal(false)
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 sm:gap-6 h-full overflow-x-auto py-10 px-2 relative" data-feature="virtualized-board">
        {/* Spacer for backlog shelf - pushes other columns to the right */}
        <div
          className={cn(
            'shrink-0 transition-all duration-300 ease-in-out',
            isBacklogExpanded ? 'w-[300px]' : 'w-12'
          )}
          aria-hidden="true"
        />

        {columns.map((column) => {
          const isBacklog = column.id === 'backlog'

          return (
            <div
              key={column.id}
              className={cn(
                'transition-all duration-300 ease-in-out',
                isBacklog && [
                  'absolute left-2 top-10 bottom-10 z-10',
                  isBacklogExpanded ? 'translate-x-0' : '-translate-x-[calc(100%-3rem)]'
                ]
              )}
              style={
                isBacklog
                  ? {
                      width: '300px'
                    }
                  : undefined
              }
            >
              <BoardColumn
                id={column.id}
                title={column.title}
                tasks={tasksByColumn[column.id]}
                projectNames={projectNames}
                onStatusChange={onStatusChange}
                onEdit={onEdit}
                onDelete={onDelete}
                onTaskClick={onTaskClick}
                // Add toggle for review column
                showCompletedToggle={column.id === 'review'}
                showCompleted={showCompleted}
                onToggleCompleted={() => setShowCompleted(!showCompleted)}
                completedCount={doneCount}
                // Keyboard navigation
                focusedTaskId={focusedTask ? `${focusedTask.projectId}-${focusedTask.id}` : null}
                // Backlog specific
                isBacklog={isBacklog}
                isBacklogExpanded={isBacklogExpanded}
                onToggleBacklog={isBacklog ? (onToggleBacklog ?? (() => setIsBacklogExpandedInternal(!isBacklogExpandedInternal))) : undefined}
                backlogCount={isBacklog ? tasksByColumn.backlog.length : undefined}
              />
            </div>
          )
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask && (
          <div className="rotate-3 scale-110">
            <div className="rounded-lg shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] ring-2 ring-primary ring-offset-4 ring-offset-background bg-background">
              <TaskCard
                task={activeTask}
                projectName={projectNames[activeTask.projectId]}
                compact
              />
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
