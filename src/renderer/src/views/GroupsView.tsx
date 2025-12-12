import { useEffect, useState, useMemo, useCallback } from 'react'
import { useGroupStore, useProjectStore } from '@/stores'
import { useKeyboardShortcuts, formatKbd, type KeyboardShortcut } from '@/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { IconPicker } from '@/components/ui/icon-picker'
import * as LucideIcons from 'lucide-react'
import {
  Plus,
  Folder,
  Loader2,
  Trash2,
  Edit2,
  FolderPlus,
  X,
  Layers,
  Grid3X3,
  List,
  Wand2,
  ChevronRight,
  ChevronDown,
  FolderGit2
} from 'lucide-react'
import type { Group, GroupTreeNode } from '@shared/types'
import { GROUP_COLORS, GROUP_ICONS, PROJECT_ICONS } from '@shared/types'
import { GroupTree, GroupParentSelector } from '@/components/groups'

export function GroupsView() {
  const {
    groups,
    groupTree,
    loading,
    error,
    fetchGroups,
    fetchGroupTree,
    createGroup,
    updateGroup,
    deleteGroup,
    addProjectToGroup,
    removeProjectFromGroup
  } = useGroupStore()
  const { projects, fetchProjects } = useProjectStore()

  const [viewMode, setViewMode] = useState<'tree' | 'grid'>('tree')
  const [gridExpandedIds, setGridExpandedIds] = useState<Set<string>>(new Set())
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [manageProjectsGroup, setManageProjectsGroup] = useState<Group | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [newGroupParentId, setNewGroupParentId] = useState<string | null>(null)
  const [newGroupColor, setNewGroupColor] = useState<string>(GROUP_COLORS[0])
  const [newGroupIcon, setNewGroupIcon] = useState<string | null>(null)
  const [iconType, setIconType] = useState<'lucide' | 'custom'>('lucide')
  const [customIconUrl, setCustomIconUrl] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)

  useEffect(() => {
    fetchGroups()
    fetchGroupTree()
    fetchProjects()
  }, [fetchGroups, fetchGroupTree, fetchProjects])

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return
    setIsSubmitting(true)
    try {
      const icon = iconType === 'lucide' ? newGroupIcon : customIconUrl || null
      await createGroup({
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined,
        parentId: newGroupParentId,
        color: newGroupColor,
        icon
      })
      setCreateDialogOpen(false)
      resetFormState()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateGroup = async () => {
    if (!editingGroup || !newGroupName.trim()) return
    setIsSubmitting(true)
    try {
      const icon = iconType === 'lucide' ? newGroupIcon : customIconUrl || null
      await updateGroup(editingGroup.id, {
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || null,
        parentId: newGroupParentId,
        color: newGroupColor,
        icon
      })
      setEditingGroup(null)
      resetFormState()
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetFormState = () => {
    setNewGroupName('')
    setNewGroupDescription('')
    setNewGroupParentId(null)
    setNewGroupColor(GROUP_COLORS[0])
    setNewGroupIcon(null)
    setIconType('lucide')
    setCustomIconUrl('')
  }

  const handleCreateChildGroup = (parentId: string) => {
    setNewGroupParentId(parentId)
    setCreateDialogOpen(true)
  }

  const handleGenerateDescription = async () => {
    if (!editingGroup) return
    setIsGeneratingDescription(true)
    try {
      const description = await window.api.generateGroupDescription(editingGroup.id)
      setNewGroupDescription(description)
    } catch (err) {
      console.error('Failed to generate description:', err)
    } finally {
      setIsGeneratingDescription(false)
    }
  }

  const handleDeleteGroup = async (id: string) => {
    if (confirm('Are you sure you want to delete this group?')) {
      await deleteGroup(id)
    }
  }

  const handleToggleProject = async (groupId: string, projectId: string, isInGroup: boolean) => {
    if (isInGroup) {
      await removeProjectFromGroup(groupId, projectId)
    } else {
      await addProjectToGroup(groupId, projectId)
    }
  }

  const openEditDialog = (group: Group | GroupTreeNode) => {
    setEditingGroup(group as Group)
    setNewGroupName(group.name)
    setNewGroupDescription(group.description || '')
    setNewGroupParentId(group.parentId)
    setNewGroupColor(group.color || GROUP_COLORS[0])
    if (group.icon) {
      if (GROUP_ICONS.includes(group.icon as (typeof GROUP_ICONS)[number])) {
        setIconType('lucide')
        setNewGroupIcon(group.icon)
        setCustomIconUrl('')
      } else {
        setIconType('custom')
        setNewGroupIcon(null)
        setCustomIconUrl(group.icon)
      }
    } else {
      setIconType('lucide')
      setNewGroupIcon(null)
      setCustomIconUrl('')
    }
  }

  const handleSelectImage = async () => {
    const path = await window.api.selectFile([
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'] }
    ])
    if (path) {
      setCustomIconUrl(`file://${path}`)
    }
  }

  const getIconComponent = (iconName: string) => {
    const Icon = LucideIcons[iconName as keyof typeof LucideIcons] as LucideIcons.LucideIcon
    return Icon || Layers
  }

  const renderGroupIcon = (group: Group) => {
    if (group.icon) {
      if (GROUP_ICONS.includes(group.icon as (typeof GROUP_ICONS)[number])) {
        const Icon = getIconComponent(group.icon)
        return <Icon className="h-5 w-5" style={{ color: group.color || GROUP_COLORS[0] }} />
      }
      return (
        <img
          src={group.icon}
          alt=""
          className="h-5 w-5 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )
    }
    return <Layers className="h-5 w-5" style={{ color: group.color || GROUP_COLORS[0] }} />
  }

  const getProjectName = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    return project?.name || 'Unknown Project'
  }

  const getProject = (projectId: string) => {
    return projects.find((p) => p.id === projectId)
  }

  const renderProjectIcon = (project: any) => {
    if (!project) return <Folder className="h-4 w-4 text-muted-foreground" />

    const isGitProject = !!project.gitUrl

    if (project.icon) {
      // Check if it's a Lucide icon name
      if (PROJECT_ICONS.includes(project.icon as (typeof PROJECT_ICONS)[number])) {
        const Icon = getIconComponent(project.icon)
        return <Icon className="h-4 w-4 text-muted-foreground" />
      }
      // It's a custom image URL/path
      return (
        <img
          src={project.icon}
          alt=""
          className="h-4 w-4 object-contain"
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
      <FolderGit2 className="h-4 w-4 text-muted-foreground" />
    ) : (
      <Folder className="h-4 w-4 text-muted-foreground" />
    )
  }

  const toggleGridExpand = (groupId: string) => {
    setGridExpandedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  // Handle opening create dialog
  const handleOpenCreateDialog = useCallback(() => {
    setCreateDialogOpen(true)
  }, [])

  // Keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = useMemo(
    () => [
      { key: 'n', meta: true, handler: handleOpenCreateDialog, description: 'Create group' }
    ],
    [handleOpenCreateDialog]
  )

  useKeyboardShortcuts(shortcuts)

  if (loading && groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-full p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Groups</h1>
          <p className="text-muted-foreground">
            Organize your projects into groups for easier management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode('tree')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleOpenCreateDialog} title={`Create group (${formatKbd('⌘N')})`}>
            <Plus className="mr-2 h-4 w-4" />
            Create Group
            <kbd className="ml-2 text-xs opacity-60">{formatKbd('⌘N')}</kbd>
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Layers className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">No groups yet</h2>
          <p className="text-muted-foreground mb-4 max-w-sm">
            Create groups to organize your projects and run tasks across multiple projects at once.
          </p>
          <Button onClick={handleOpenCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Create Your First Group
          </Button>
        </div>
      ) : viewMode === 'tree' ? (
        <div className="border rounded-lg p-4">
          <GroupTree
            tree={groupTree}
            onEdit={openEditDialog}
            onDelete={(group) => handleDeleteGroup(group.id)}
            onManageProjects={(group) => setManageProjectsGroup(group as Group)}
            onCreateChild={handleCreateChildGroup}
            getProjectName={getProjectName}
            getProject={getProject}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {groupTree.map((node) => (
            <GridGroupNode
              key={node.id}
              node={node}
              expandedIds={gridExpandedIds}
              onToggleExpand={toggleGridExpand}
              onEdit={openEditDialog}
              onDelete={handleDeleteGroup}
              onManageProjects={setManageProjectsGroup}
              getProjectName={getProjectName}
              renderGroupIcon={renderGroupIcon}
            />
          ))}
        </div>
      )}

      {/* Create Group Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open)
        if (!open) resetFormState()
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
            <DialogDescription>Create a new group to organize your projects.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="My Group"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="Brief description of this group's purpose..."
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Parent Group (optional)</Label>
              <GroupParentSelector
                value={newGroupParentId}
                onChange={setNewGroupParentId}
                groups={groups}
                groupTree={groupTree}
                placeholder="No parent (root level)"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {GROUP_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full transition-transform ${
                      newGroupColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewGroupColor(color)}
                  />
                ))}
              </div>
            </div>
            <IconPicker
              availableIcons={GROUP_ICONS}
              selectedIcon={newGroupIcon}
              customIconUrl={customIconUrl}
              iconType={iconType}
              defaultIcon={Layers}
              onSelectIcon={setNewGroupIcon}
              onCustomIconChange={setCustomIconUrl}
              onIconTypeChange={setIconType}
              onSelectImageFile={handleSelectImage}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={!newGroupName.trim() || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={!!editingGroup} onOpenChange={(open) => {
        if (!open) {
          setEditingGroup(null)
          resetFormState()
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription>Update group settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="My Group"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-description">Description (optional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateDescription}
                  disabled={isGeneratingDescription || editingGroup?.projectIds.length === 0}
                  title={editingGroup?.projectIds.length === 0 ? 'Add projects to generate description' : 'Generate description with AI'}
                >
                  {isGeneratingDescription ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-1" />
                  )}
                  Generate
                </Button>
              </div>
              <Textarea
                id="edit-description"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="Brief description of this group's purpose..."
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Parent Group</Label>
              <GroupParentSelector
                value={newGroupParentId}
                onChange={setNewGroupParentId}
                groups={groups}
                groupTree={groupTree}
                excludeGroupId={editingGroup?.id}
                placeholder="No parent (root level)"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {GROUP_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full transition-transform ${
                      newGroupColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewGroupColor(color)}
                  />
                ))}
              </div>
            </div>
            <IconPicker
              availableIcons={GROUP_ICONS}
              selectedIcon={newGroupIcon}
              customIconUrl={customIconUrl}
              iconType={iconType}
              defaultIcon={Layers}
              onSelectIcon={setNewGroupIcon}
              onCustomIconChange={setCustomIconUrl}
              onIconTypeChange={setIconType}
              onSelectImageFile={handleSelectImage}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGroup(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateGroup} disabled={!newGroupName.trim() || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Projects Dialog */}
      <Dialog
        open={!!manageProjectsGroup}
        onOpenChange={(open) => !open && setManageProjectsGroup(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Projects</DialogTitle>
            <DialogDescription>
              Add or remove projects from "{manageProjectsGroup?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[400px] overflow-y-auto">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No projects available. Add some projects first.
              </p>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => {
                  const isInGroup = manageProjectsGroup?.projectIds.includes(project.id) || false
                  return (
                    <div
                      key={project.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        isInGroup ? 'bg-primary/5 border-primary/20' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {renderProjectIcon(project)}
                        <span className="font-medium">{project.name}</span>
                      </div>
                      <Button
                        variant={isInGroup ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={() =>
                          manageProjectsGroup &&
                          handleToggleProject(manageProjectsGroup.id, project.id, isInGroup)
                        }
                      >
                        {isInGroup ? (
                          <>
                            <X className="h-3 w-3 mr-1" />
                            Remove
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </>
                        )}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageProjectsGroup(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface GridGroupNodeProps {
  node: GroupTreeNode
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
  onEdit: (group: Group | GroupTreeNode) => void
  onDelete: (id: string) => void
  onManageProjects: (group: Group) => void
  getProjectName: (id: string) => string
  renderGroupIcon: (group: Group) => React.ReactNode
  depth?: number
}

function GridGroupNode({
  node,
  expandedIds,
  onToggleExpand,
  onEdit,
  onDelete,
  onManageProjects,
  getProjectName,
  renderGroupIcon,
  depth = 0
}: GridGroupNodeProps) {
  const isExpanded = expandedIds.has(node.id)
  const hasChildren = node.children.length > 0

  return (
    <div style={{ marginLeft: depth > 0 ? `${depth * 24}px` : undefined }}>
      <Card className="group relative">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {/* Chevron toggle */}
              <button
                className={`p-1 rounded hover:bg-muted transition-colors flex-shrink-0 ${
                  !hasChildren ? 'invisible' : ''
                }`}
                onClick={() => onToggleExpand(node.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0"
                style={{ backgroundColor: `${node.color || GROUP_COLORS[0]}20` }}
              >
                {renderGroupIcon(node as Group)}
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">{node.name}</CardTitle>
                <div className="text-xs text-muted-foreground">
                  {node.projectIds.length} project{node.projectIds.length !== 1 ? 's' : ''}
                  {hasChildren && ` · ${node.children.length} subgroup${node.children.length !== 1 ? 's' : ''}`}
                </div>
                {node.description && (
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {node.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onManageProjects(node as Group)}
                title="Manage Projects"
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(node)}
                title="Edit Group"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDelete(node.id)}
                title="Delete Group"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {node.projectIds.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {node.projectIds.slice(0, 5).map((projectId) => (
                <Badge key={projectId} variant="secondary" className="text-xs">
                  <Folder className="h-3 w-3 mr-1" />
                  {getProjectName(projectId)}
                </Badge>
              ))}
              {node.projectIds.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{node.projectIds.length - 5} more
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No projects in this group</p>
          )}
        </CardContent>
      </Card>

      {/* Render children when expanded */}
      {isExpanded && hasChildren && (
        <div className="mt-2 space-y-2">
          {node.children.map((child) => (
            <GridGroupNode
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onDelete={onDelete}
              onManageProjects={onManageProjects}
              getProjectName={getProjectName}
              renderGroupIcon={renderGroupIcon}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
