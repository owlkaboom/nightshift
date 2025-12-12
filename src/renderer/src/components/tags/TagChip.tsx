/**
 * TagChip Component
 *
 * Displays a tag as a colored chip with optional remove button
 */

import { X } from 'lucide-react'
import type { Tag } from '@shared/types'
import { cn } from '@/lib/utils'

interface TagChipProps {
  tag: Tag
  /** Whether to show the remove button */
  removable?: boolean
  /** Callback when remove is clicked */
  onRemove?: (tag: Tag) => void
  /** Optional className for styling */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Generates text color based on background color for better contrast
 */
function getContrastColor(hexColor: string | null): string {
  if (!hexColor) return 'text-foreground'

  // Convert hex to RGB
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? 'text-black' : 'text-white'
}

export function TagChip({ tag, removable = false, onRemove, className, size = 'md' }: TagChipProps) {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-sm px-2 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2'
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4'
  }

  const backgroundColor = tag.color || 'hsl(var(--muted))'
  const textColor = tag.color ? getContrastColor(tag.color) : 'text-muted-foreground'

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full font-medium transition-colors',
        sizeClasses[size],
        textColor,
        className
      )}
      style={{ backgroundColor }}
    >
      <span className="truncate">{tag.name}</span>
      {removable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove(tag)
          }}
          className={cn(
            'rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors',
            iconSizes[size]
          )}
          aria-label={`Remove ${tag.name} tag`}
        >
          <X className={iconSizes[size]} />
        </button>
      )}
    </div>
  )
}
