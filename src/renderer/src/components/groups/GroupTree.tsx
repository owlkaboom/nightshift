/**
 * GroupTree Component
 *
 * Renders groups in a hierarchical tree structure with expand/collapse functionality.
 */

import { useState, useMemo } from 'react'
import * as LucideIcons from 'lucide-react'
import {
  ChevronRight,
  Folder,
  FolderPlus,
  Edit2,
  Trash2,
  Layers
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { GroupTreeNode } from '@shared/types'
import { GROUP_COLORS, GROUP_ICONS, PROJECT_ICONS } from '@shared/types'
import { FolderGit2 } from 'lucide-react'

interface GroupTreeProps {
  tree: GroupTreeNode[]
  onSelect?: (group: GroupTreeNode) => void
  onCreateChild?: (parentId: string) => void
  onEdit?: (group: GroupTreeNode) => void
  onDelete?: (group: GroupTreeNode) => void
  onManageProjects?: (group: GroupTreeNode) => void
  selectedGroupId?: string
  getProjectName?: (projectId: string) => string
  getProject?: (projectId: string) => any
}

export function GroupTree({
  tree,
  onSelect,
  onCreateChild,
  onEdit,
  onDelete,
  onManageProjects,
  selectedGroupId,
  getProjectName,
  getProject
}: GroupTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (groupId: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  const expandAll = () => {
    const allIds = new Set<string>()
    const collectIds = (nodes: GroupTreeNode[]) => {
      for (const node of nodes) {
        allIds.add(node.id)
        collectIds(node.children)
      }
    }
    collectIds(tree)
    setExpandedIds(allIds)
  }

  const collapseAll = () => {
    setExpandedIds(new Set())
  }

  if (tree.length === 0) {
    return null
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-end gap-2 mb-2">
        <Button variant="ghost" size="sm" onClick={expandAll}>
          Expand All
        </Button>
        <Button variant="ghost" size="sm" onClick={collapseAll}>
          Collapse All
        </Button>
      </div>
      {tree.map(node => (
        <GroupTreeNode
          key={node.id}
          node={node}
          expandedIds={expandedIds}
          onToggleExpand={toggleExpand}
          onSelect={onSelect}
          onCreateChild={onCreateChild}
          onEdit={onEdit}
          onDelete={onDelete}
          onManageProjects={onManageProjects}
          selectedGroupId={selectedGroupId}
          getProjectName={getProjectName}
          getProject={getProject}
        />
      ))}
    </div>
  )
}

interface GroupTreeNodeProps {
  node: GroupTreeNode
  expandedIds: Set<string>
  onToggleExpand: (groupId: string) => void
  onSelect?: (group: GroupTreeNode) => void
  onCreateChild?: (parentId: string) => void
  onEdit?: (group: GroupTreeNode) => void
  onDelete?: (group: GroupTreeNode) => void
  onManageProjects?: (group: GroupTreeNode) => void
  selectedGroupId?: string
  getProjectName?: (projectId: string) => string
  getProject?: (projectId: string) => any
}

function GroupTreeNode({
  node,
  expandedIds,
  onToggleExpand,
  onSelect,
  onCreateChild,
  onEdit,
  onDelete,
  onManageProjects,
  selectedGroupId,
  getProjectName,
  getProject
}: GroupTreeNodeProps) {
  const isExpanded = expandedIds.has(node.id)
  const isSelected = selectedGroupId === node.id
  const hasChildren = node.children.length > 0 || node.projectIds.length > 0

  const getIconComponent = (iconName: string) => {
    const Icon = LucideIcons[iconName as keyof typeof LucideIcons] as LucideIcons.LucideIcon
    return Icon || Layers
  }

  const renderGroupIcon = () => {
    if (node.icon) {
      if (GROUP_ICONS.includes(node.icon as (typeof GROUP_ICONS)[number])) {
        const Icon = getIconComponent(node.icon)
        return <Icon className="h-4 w-4" style={{ color: node.color || GROUP_COLORS[0] }} />
      }
      return (
        <img
          src={node.icon}
          alt=""
          className="h-4 w-4 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )
    }
    return <Layers className="h-4 w-4" style={{ color: node.color || GROUP_COLORS[0] }} />
  }

  const renderProjectIcon = (project: any) => {
    if (!project) return <Folder className="h-3 w-3" />

    const isGitProject = !!project.gitUrl

    if (project.icon) {
      // Check if it's a Lucide icon name
      if (PROJECT_ICONS.includes(project.icon as (typeof PROJECT_ICONS)[number])) {
        const Icon = getIconComponent(project.icon)
        return <Icon className="h-3 w-3 text-muted-foreground" />
      }
      // It's a custom image URL/path
      return (
        <img
          src={project.icon}
          alt=""
          className="h-3 w-3 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            const fallback = e.currentTarget.nextSibling as HTMLElement
            if (fallback) fallback.style.display = 'inline-block'
          }}
        />
      )
    }
    // Default icon based on project type
    return isGitProject ? (
      <FolderGit2 className="h-3 w-3 text-muted-foreground" />
    ) : (
      <Folder className="h-3 w-3 text-muted-foreground" />
    )
  }

  // Count total projects including descendants
  const totalProjectCount = useMemo(() => {
    let count = node.projectIds.length
    const countDescendants = (children: GroupTreeNode[]) => {
      for (const child of children) {
        count += child.projectIds.length
        countDescendants(child.children)
      }
    }
    countDescendants(node.children)
    return count
  }, [node])

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors',
          isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'
        )}
        style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
        onClick={() => {
          onSelect?.(node)
          if (hasChildren) {
            onToggleExpand(node.id)
          }
        }}
      >
        {/* Expand/Collapse button */}
        <button
          className={cn(
            'p-0.5 rounded hover:bg-muted transition-colors',
            !hasChildren && 'invisible'
          )}
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand(node.id)
          }}
        >
          <ChevronRight
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              isExpanded && 'rotate-90'
            )}
          />
        </button>

        {/* Group icon */}
        <div
          className="flex h-7 w-7 items-center justify-center rounded"
          style={{ backgroundColor: `${node.color || GROUP_COLORS[0]}20` }}
        >
          {renderGroupIcon()}
        </div>

        {/* Group name and info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{node.name}</span>
            <span className="text-xs text-muted-foreground">
              {node.projectIds.length} project{node.projectIds.length !== 1 ? 's' : ''}
              {hasChildren && ` (${totalProjectCount} total)`}
            </span>
          </div>
          {node.description && (
            <p className="text-xs text-muted-foreground truncate">{node.description}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onCreateChild && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                onCreateChild(node.id)
              }}
            >
              <FolderPlus className="h-3.5 w-3.5 mr-1" />
              Add Subgroup
            </Button>
          )}
          {onManageProjects && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                onManageProjects(node)
              }}
            >
              <Folder className="h-3.5 w-3.5 mr-1" />
              Manage
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(node)
              }}
            >
              <Edit2 className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(node)
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Projects in this group (shown when expanded) */}
      {node.projectIds.length > 0 && getProjectName && (
        <div
          className={cn(
            'grid transition-all duration-200 ease-out',
            isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          )}
        >
          <div className="overflow-hidden">
            <div
              className="ml-7 mt-1 space-y-0.5"
              style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
            >
              {node.projectIds.slice(0, 5).map((projectId) => {
                const project = getProject?.(projectId)
                return (
                  <div
                    key={projectId}
                    className="flex items-center gap-2 py-1 px-2 text-sm text-muted-foreground"
                  >
                    {renderProjectIcon(project)}
                    <span className="truncate">{getProjectName(projectId)}</span>
                  </div>
                )
              })}
              {node.projectIds.length > 5 && (
                <div className="py-1 px-2 text-xs text-muted-foreground">
                  +{node.projectIds.length - 5} more projects
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Children */}
      {node.children.length > 0 && (
        <div
          className={cn(
            'grid transition-all duration-200 ease-out',
            isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          )}
        >
          <div className="overflow-hidden">
            {node.children.map(child => (
              <GroupTreeNode
                key={child.id}
                node={child}
                expandedIds={expandedIds}
                onToggleExpand={onToggleExpand}
                onSelect={onSelect}
                onCreateChild={onCreateChild}
                onEdit={onEdit}
                onDelete={onDelete}
                onManageProjects={onManageProjects}
                selectedGroupId={selectedGroupId}
                getProjectName={getProjectName}
                getProject={getProject}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
