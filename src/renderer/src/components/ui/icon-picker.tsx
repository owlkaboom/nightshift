/**
 * IconPicker Component
 *
 * A reusable icon picker with search functionality for selecting Lucide icons or custom images.
 * Supports filtering icons by name and previewing selections.
 */

import { useState, useMemo } from 'react'
import * as LucideIcons from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'
import { Search, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IconPickerProps {
  /** Array of available icon names (from Lucide) */
  availableIcons: readonly string[]
  /** Currently selected icon name (for Lucide icons) */
  selectedIcon: string | null
  /** Custom icon URL/path (for custom images) */
  customIconUrl?: string
  /** Current icon type selection */
  iconType: 'lucide' | 'custom'
  /** Default icon component to show when nothing is selected */
  defaultIcon?: LucideIcons.LucideIcon
  /** Callback when Lucide icon is selected */
  onSelectIcon: (iconName: string | null) => void
  /** Callback when custom icon URL changes */
  onCustomIconChange?: (url: string) => void
  /** Callback when icon type changes */
  onIconTypeChange: (type: 'lucide' | 'custom') => void
  /** Callback to open file picker for custom images */
  onSelectImageFile?: () => Promise<void>
  /** Optional CSS class for the container */
  className?: string
}

export function IconPicker({
  availableIcons,
  selectedIcon,
  customIconUrl = '',
  iconType,
  defaultIcon: DefaultIcon = LucideIcons.Folder,
  onSelectIcon,
  onCustomIconChange,
  onIconTypeChange,
  onSelectImageFile,
  className
}: IconPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter icons based on search query
  const filteredIcons = useMemo(() => {
    if (!searchQuery.trim()) return availableIcons

    const query = searchQuery.toLowerCase()
    return availableIcons.filter((iconName) =>
      iconName.toLowerCase().includes(query)
    )
  }, [availableIcons, searchQuery])

  const getIconComponent = (iconName: string) => {
    const Icon = LucideIcons[iconName as keyof typeof LucideIcons] as LucideIcons.LucideIcon
    return Icon || DefaultIcon
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Icon Type Selector */}
      <div className="space-y-2">
        <Label>Icon Type</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={iconType === 'lucide' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onIconTypeChange('lucide')}
          >
            Built-in Icons
          </Button>
          <Button
            type="button"
            variant={iconType === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onIconTypeChange('custom')}
          >
            Custom Image
          </Button>
        </div>
      </div>

      {/* Lucide Icon Picker */}
      {iconType === 'lucide' && (
        <div className="space-y-2">
          <Label>Select Icon</Label>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search icons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Icon Grid */}
          <div className="grid grid-cols-8 gap-1.5 p-3 rounded-lg border max-h-[300px] overflow-y-auto">
            {filteredIcons.length > 0 ? (
              filteredIcons.map((iconName) => {
                const Icon = getIconComponent(iconName)
                const isSelected = selectedIcon === iconName
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => onSelectIcon(isSelected ? null : iconName)}
                    className={cn(
                      'p-2.5 rounded-md transition-colors flex items-center justify-center',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    )}
                    title={iconName}
                  >
                    <Icon className="h-6 w-6" />
                  </button>
                )
              })
            ) : (
              <div className="col-span-8 py-8 text-center text-sm text-muted-foreground">
                No icons found matching "{searchQuery}"
              </div>
            )}
          </div>

          {/* Selected Icon Info */}
          {selectedIcon && (
            <p className="text-xs text-muted-foreground">
              Selected: {selectedIcon}
            </p>
          )}

          {/* Results Count */}
          {searchQuery && (
            <p className="text-xs text-muted-foreground">
              Showing {filteredIcons.length} of {availableIcons.length} icons
            </p>
          )}
        </div>
      )}

      {/* Custom Image Input */}
      {iconType === 'custom' && onCustomIconChange && (
        <div className="space-y-2">
          <Label>Custom Image</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={customIconUrl}
              onChange={(e) => onCustomIconChange(e.target.value)}
              placeholder="Image URL or file path"
              className="flex-1"
            />
            {onSelectImageFile && (
              <Button type="button" variant="outline" onClick={onSelectImageFile}>
                <Upload className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Enter a URL or select an image file from your computer.
          </p>
          {customIconUrl && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex h-8 w-8 items-center justify-center rounded border bg-muted">
                <img
                  src={customIconUrl}
                  alt="Preview"
                  className="h-6 w-6 object-contain"
                  onError={(e) => {
                    e.currentTarget.src = ''
                    e.currentTarget.alt = 'Failed to load'
                  }}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onCustomIconChange('')}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
