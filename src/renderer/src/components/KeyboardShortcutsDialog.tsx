/**
 * Keyboard shortcuts help dialog - displays all available shortcuts
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import {
  ALL_SHORTCUTS,
  CATEGORY_LABELS,
  formatShortcutParts,
  type ShortcutCategory
} from '@/hooks/useKeyboardShortcuts'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  // Group shortcuts by category
  const shortcutsByCategory = ALL_SHORTCUTS.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = []
      }
      acc[shortcut.category].push(shortcut)
      return acc
    },
    {} as Record<ShortcutCategory, typeof ALL_SHORTCUTS>
  )

  const categoryOrder: ShortcutCategory[] = ['navigation', 'board', 'task', 'review', 'notes', 'general']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>Quick access to common actions</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          {categoryOrder.map((category) => {
            const shortcuts = shortcutsByCategory[category]
            if (!shortcuts || shortcuts.length === 0) return null

            return (
              <div key={category}>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {CATEGORY_LABELS[category]}
                </h3>
                <div className="space-y-1">
                  {shortcuts.map((shortcut, index) => {
                    const parts = formatShortcutParts(shortcut)
                    return (
                      <div
                        key={`${shortcut.key}-${index}`}
                        className="flex items-center justify-between py-1.5"
                      >
                        <span className="text-sm">{shortcut.description}</span>
                        <div className="flex items-center gap-1">
                          {parts.map((part, partIndex) => (
                            <span key={partIndex} className="flex items-center gap-1">
                              <kbd className="px-2 py-1 font-medium bg-muted rounded border border-border min-w-[1.75rem] text-center">
                                {part}
                              </kbd>
                              {partIndex < parts.length - 1 && (
                                <span className="text-muted-foreground text-xs">+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
