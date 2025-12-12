import {
  ALL_SHORTCUTS,
  CATEGORY_LABELS,
  formatShortcutParts,
  type ShortcutCategory
} from '@/hooks/useKeyboardShortcuts'
import { Keyboard } from 'lucide-react'

export function ShortcutsView() {
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
    <div className="h-full flex flex-col">
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Keyboard className="h-6 w-6" />
          Keyboard Shortcuts
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quick access to common actions
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-8 max-w-4xl mx-auto">
          {categoryOrder.map((category) => {
            const shortcuts = shortcutsByCategory[category]
            if (!shortcuts || shortcuts.length === 0) return null

            return (
              <div key={category}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {CATEGORY_LABELS[category]}
                </h3>
                <div className="space-y-1">
                  {shortcuts.map((shortcut, index) => {
                    const parts = formatShortcutParts(shortcut)
                    return (
                      <div
                        key={`${shortcut.key}-${index}`}
                        className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-accent/50 transition-colors"
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
      </div>
    </div>
  )
}
