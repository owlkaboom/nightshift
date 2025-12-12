/**
 * PlanExtractionPanel - Panel for extracting and managing plan items
 */

import { useState, useCallback } from 'react'
import { CheckSquare, Square, GripVertical, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ExtractedPlanItem, PlanningSessionStatus, TaskManifest } from '@shared/types'

interface PlanExtractionPanelProps {
  /** Plan items to display */
  items: ExtractedPlanItem[]

  /** Called when items are updated */
  onUpdateItems: (items: ExtractedPlanItem[]) => Promise<void>

  /** Called when user wants to convert items to tasks */
  onConvertToTasks: (itemIds: string[]) => Promise<TaskManifest[]>

  /** Current session status */
  sessionStatus: PlanningSessionStatus
}

export function PlanExtractionPanel({
  items,
  onUpdateItems,
  onConvertToTasks,
  sessionStatus
}: PlanExtractionPanelProps) {
  const [converting, setConverting] = useState(false)
  const [convertedCount, setConvertedCount] = useState(0)

  // Toggle item selection
  const handleToggleItem = useCallback(
    async (itemId: string) => {
      const updatedItems = items.map((item) =>
        item.id === itemId ? { ...item, selected: !item.selected } : item
      )
      await onUpdateItems(updatedItems)
    },
    [items, onUpdateItems]
  )

  // Select all items
  const handleSelectAll = useCallback(async () => {
    const updatedItems = items.map((item) => ({ ...item, selected: true }))
    await onUpdateItems(updatedItems)
  }, [items, onUpdateItems])

  // Deselect all items
  const handleDeselectAll = useCallback(async () => {
    const updatedItems = items.map((item) => ({ ...item, selected: false }))
    await onUpdateItems(updatedItems)
  }, [items, onUpdateItems])

  // Convert selected items to tasks
  const handleConvert = useCallback(async () => {
    const selectedIds = items.filter((item) => item.selected).map((item) => item.id)
    if (selectedIds.length === 0) return

    setConverting(true)
    try {
      const tasks = await onConvertToTasks(selectedIds)
      setConvertedCount(tasks.length)
    } finally {
      setConverting(false)
    }
  }, [items, onConvertToTasks])

  const selectedCount = items.filter((item) => item.selected).length
  const allSelected = items.length > 0 && selectedCount === items.length
  const noneSelected = selectedCount === 0
  const isConverted = sessionStatus === 'converted'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm mb-2">Plan Items</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={allSelected ? handleDeselectAll : handleSelectAll}
            disabled={isConverted}
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>
          <span className="text-xs text-muted-foreground">
            {selectedCount} of {items.length} selected
          </span>
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto p-2">
        {items.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No plan items extracted yet.
            <br />
            The AI will extract items as you discuss the plan.
          </div>
        ) : (
          <ul className="space-y-2">
            {items
              .sort((a, b) => a.order - b.order)
              .map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'p-3 rounded-md border transition-colors',
                    item.selected && !isConverted
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border bg-background'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {/* Drag handle (placeholder for future reordering) */}
                    <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 opacity-30" />

                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleItem(item.id)}
                      disabled={isConverted}
                      className={cn(
                        'mt-0.5 flex-shrink-0',
                        isConverted && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {item.selected ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Footer - Convert button */}
      <div className="p-4 border-t">
        {isConverted ? (
          <div className="text-center text-sm text-green-600 dark:text-green-400">
            <CheckSquare className="h-5 w-5 mx-auto mb-2" />
            {convertedCount > 0
              ? `${convertedCount} tasks created`
              : 'Plan converted to tasks'}
          </div>
        ) : (
          <Button
            className="w-full"
            onClick={handleConvert}
            disabled={noneSelected || converting}
          >
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Tasks...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                Create {selectedCount} Task{selectedCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
