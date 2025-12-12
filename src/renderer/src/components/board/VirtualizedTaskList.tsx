import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, useEffect } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { TaskManifest, TaskStatus } from '@shared/types'
import { SortableTaskCard } from './SortableTaskCard'

interface VirtualizedTaskListProps {
  tasks: TaskManifest[]
  taskIds: string[]
  projectNames: Record<string, string>
  onStatusChange?: (task: TaskManifest, status: TaskStatus) => void
  onEdit?: (task: TaskManifest) => void
  onDelete?: (task: TaskManifest) => void
  onTaskClick?: (task: TaskManifest) => void
  focusedTaskId?: string | null
}

export function VirtualizedTaskList({
  tasks,
  taskIds,
  projectNames,
  onStatusChange,
  onEdit,
  onDelete,
  onTaskClick,
  focusedTaskId
}: VirtualizedTaskListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  // Configure virtualizer with estimated task card height
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 130, // Estimated height of a task card + spacing in pixels
    overscan: 3, // Render 3 items before/after visible area for smoother scrolling
    measureElement:
      typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
        ? (element) => element.getBoundingClientRect().height
        : undefined // Dynamic measurement for better accuracy (except in Firefox due to performance issues)
  })

  // Scroll to focused task when it changes
  useEffect(() => {
    if (focusedTaskId) {
      const index = tasks.findIndex((t) => `${t.projectId}-${t.id}` === focusedTaskId)
      if (index !== -1) {
        virtualizer.scrollToIndex(index, { align: 'center', behavior: 'smooth' })
      }
    }
  }, [focusedTaskId, tasks, virtualizer])

  return (
    <div
      ref={parentRef}
      className="flex-1 min-h-0 px-3 py-4 overflow-y-auto"
    >
      {tasks.length === 0 ? (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          No tasks
        </div>
      ) : (
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const task = tasks[virtualItem.index]
              const taskKey = `${task.projectId}-${task.id}`

              return (
                <div
                  key={taskKey}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                    paddingBottom: '8px' // space-y-2 equivalent
                  }}
                >
                  <SortableTaskCard
                    task={task}
                    projectName={projectNames[task.projectId]}
                    onStatusChange={onStatusChange ? (status) => onStatusChange(task, status) : undefined}
                    onEdit={onEdit ? () => onEdit(task) : undefined}
                    onDelete={onDelete ? () => onDelete(task) : undefined}
                    onClick={onTaskClick ? () => onTaskClick(task) : undefined}
                    isFocused={focusedTaskId === taskKey}
                  />
                </div>
              )
            })}
          </div>
        </SortableContext>
      )}
    </div>
  )
}
