/**
 * GroupParentSelector Component
 *
 * A dropdown for selecting a parent group, showing the group hierarchy.
 */

import { useMemo } from 'react'
import * as LucideIcons from 'lucide-react'
import { Layers, ChevronRight } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { Group, GroupTreeNode } from '@shared/types'
import { GROUP_COLORS, GROUP_ICONS } from '@shared/types'

interface GroupParentSelectorProps {
  /** Currently selected parent ID */
  value: string | null
  /** Called when parent selection changes */
  onChange: (parentId: string | null) => void
  /** All groups (flat list) */
  groups: Group[]
  /** Group tree for hierarchy display */
  groupTree: GroupTreeNode[]
  /** ID of the group being edited (to exclude from options) */
  excludeGroupId?: string
  /** Placeholder text */
  placeholder?: string
}

export function GroupParentSelector({
  value,
  onChange,
  groups,
  groupTree,
  excludeGroupId,
  placeholder = 'Select parent group'
}: GroupParentSelectorProps) {
  // Flatten the tree into a list with depth info, excluding the current group and its descendants
  const flatOptions = useMemo(() => {
    const options: Array<{ group: Group; depth: number }> = []

    const collectExcludedIds = (nodes: GroupTreeNode[]): Set<string> => {
      const excluded = new Set<string>()
      const findGroup = (nodes: GroupTreeNode[]) => {
        for (const node of nodes) {
          if (node.id === excludeGroupId) {
            // Add this group and all its descendants to excluded
            const addDescendants = (n: GroupTreeNode) => {
              excluded.add(n.id)
              for (const child of n.children) {
                addDescendants(child)
              }
            }
            addDescendants(node)
          } else {
            findGroup(node.children)
          }
        }
      }
      findGroup(nodes)
      return excluded
    }

    const excludedIds = excludeGroupId ? collectExcludedIds(groupTree) : new Set<string>()

    const flatten = (nodes: GroupTreeNode[], depth: number) => {
      for (const node of nodes) {
        if (!excludedIds.has(node.id)) {
          options.push({ group: node, depth })
          flatten(node.children, depth + 1)
        }
      }
    }

    flatten(groupTree, 0)
    return options
  }, [groups, groupTree, excludeGroupId])

  const getIconComponent = (iconName: string) => {
    const Icon = LucideIcons[iconName as keyof typeof LucideIcons] as LucideIcons.LucideIcon
    return Icon || Layers
  }

  const renderGroupIcon = (group: Group, size: string = 'h-4 w-4') => {
    if (group.icon) {
      if (GROUP_ICONS.includes(group.icon as (typeof GROUP_ICONS)[number])) {
        const Icon = getIconComponent(group.icon)
        return <Icon className={size} style={{ color: group.color || GROUP_COLORS[0] }} />
      }
      return (
        <img
          src={group.icon}
          alt=""
          className={`${size} object-contain`}
        />
      )
    }
    return <Layers className={size} style={{ color: group.color || GROUP_COLORS[0] }} />
  }

  const selectedGroup = value ? groups.find(g => g.id === value) : null

  return (
    <Select
      value={value || 'none'}
      onValueChange={(v) => onChange(v === 'none' ? null : v)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder}>
          {selectedGroup ? (
            <div className="flex items-center gap-2">
              {renderGroupIcon(selectedGroup)}
              <span>{selectedGroup.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">No parent (root level)</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <span className="text-muted-foreground">No parent (root level)</span>
        </SelectItem>
        {flatOptions.map(({ group, depth }) => (
          <SelectItem key={group.id} value={group.id}>
            <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 16}px` }}>
              {depth > 0 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
              {renderGroupIcon(group)}
              <span>{group.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
