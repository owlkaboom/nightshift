import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TaskManifest, TaskStatus } from '@shared/types'
import { TaskCard } from '@/components/tasks'
import { cn } from '@/lib/utils'
import { memo } from 'react'

interface SortableTaskCardProps {
  task: TaskManifest
  projectName?: string
  onStatusChange?: (status: TaskStatus) => void
  onEdit?: () => void
  onDelete?: () => void
  onClick?: () => void
  isFocused?: boolean
}

export const SortableTaskCard = memo(function SortableTaskCard({
  task,
  projectName,
  onStatusChange,
  onEdit,
  onDelete,
  onClick,
  isFocused = false
}: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: `${task.projectId}-${task.id}`,
    data: {
      type: 'task',
      task
    }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Ensure dragged items appear above others but don't interfere with drop detection
    ...(isDragging ? { zIndex: 9999 } : {})
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative cursor-grab active:cursor-grabbing touch-none',
        isDragging && 'opacity-50'
      )}
      {...attributes}
      {...listeners}
    >
      <TaskCard
        task={task}
        projectName={projectName}
        onStatusChange={onStatusChange}
        onEdit={onEdit}
        onDelete={onDelete}
        onClick={onClick}
        compact
        isDragging={isDragging}
        isFocused={isFocused}
      />
    </div>
  )
})
