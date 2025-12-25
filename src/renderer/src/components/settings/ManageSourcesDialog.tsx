/**
 * Manage Sources Dialog
 *
 * Allows users to discover and add sources (boards, sprints, filters, projects)
 * to their JIRA connection
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Loader2,
  Plus,
  Search,
  CheckCircle2,
  Filter,
  Layout,
  Folder,
  Code
} from 'lucide-react'
import { useIntegrationStore } from '@/stores/integration-store'
import type {
  IntegrationConnection,
  JiraBoard,
  JiraFilter,
  JiraProject,
  CreateSourceData,
  JiraSourceConfig
} from '@shared/types'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ManageSourcesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection: IntegrationConnection | null
}

type SourceType = 'board' | 'filter' | 'project' | 'jql'

/**
 * Dialog component that allows users to discover and add sources to their JIRA connection
 */
export function ManageSourcesDialog({ open, onOpenChange, connection }: ManageSourcesDialogProps) {
  const {
    createSource,
    discoverBoards,
    discoverFilters,
    discoverProjects,
    getCachedBoards,
    getCachedFilters,
    getCachedProjects,
    discoveringBoards,
    discoveringFilters,
    error,
    clearError
  } = useIntegrationStore()

  const [sourceType, setSourceType] = useState<SourceType>('board')
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Discovery data
  const [boards, setBoards] = useState<JiraBoard[]>([])
  const [filters, setFilters] = useState<JiraFilter[]>([])
  const [projects, setProjects] = useState<JiraProject[]>([])

  // Selection state
  const [selectedBoards, setSelectedBoards] = useState<Set<number>>(new Set())
  const [selectedFilters, setSelectedFilters] = useState<Set<number>>(new Set())
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())

  // JQL custom query
  const [customJql, setCustomJql] = useState('')
  const [jqlName, setJqlName] = useState('')

  /**
   * Load discovery data when dialog opens or connection changes
   */
  useEffect(() => {
    if (!open || !connection) return

    // Try to load from cache first
    const cachedBoards = getCachedBoards(connection.id)
    const cachedFilters = getCachedFilters(connection.id)
    const cachedProjects = getCachedProjects(connection.id)

    if (cachedBoards) {
      setBoards(cachedBoards)
    } else if (connection.type === 'jira') {
      discoverBoards(connection.id).then(setBoards).catch(() => {})
    }

    if (cachedFilters) {
      setFilters(cachedFilters)
    } else if (connection.type === 'jira') {
      discoverFilters(connection.id).then(setFilters).catch(() => {})
    }

    if (cachedProjects) {
      setProjects(cachedProjects)
    } else if (connection.type === 'jira') {
      discoverProjects(connection.id).then(setProjects).catch(() => {})
    }
  }, [open, connection, getCachedBoards, getCachedFilters, getCachedProjects, discoverBoards, discoverFilters, discoverProjects])

  /**
   * Reset form state when dialog closes
   */
  const resetForm = () => {
    setSelectedBoards(new Set())
    setSelectedFilters(new Set())
    setSelectedProjects(new Set())
    setCustomJql('')
    setJqlName('')
    setSearchQuery('')
    clearError()
  }

  /**
   * Handle dialog close
   */
  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  /**
   * Toggle board selection
   */
  const toggleBoard = (boardId: number) => {
    const newSelection = new Set(selectedBoards)
    if (newSelection.has(boardId)) {
      newSelection.delete(boardId)
    } else {
      newSelection.add(boardId)
    }
    setSelectedBoards(newSelection)
  }

  /**
   * Toggle filter selection
   */
  const toggleFilter = (filterId: number) => {
    const newSelection = new Set(selectedFilters)
    if (newSelection.has(filterId)) {
      newSelection.delete(filterId)
    } else {
      newSelection.add(filterId)
    }
    setSelectedFilters(newSelection)
  }

  /**
   * Toggle project selection
   */
  const toggleProject = (projectKey: string) => {
    const newSelection = new Set(selectedProjects)
    if (newSelection.has(projectKey)) {
      newSelection.delete(projectKey)
    } else {
      newSelection.add(projectKey)
    }
    setSelectedProjects(newSelection)
  }

  /**
   * Filter items by search query
   */
  const filterBySearch = <T extends { name: string }>(items: T[]): T[] => {
    if (!searchQuery.trim()) return items
    const query = searchQuery.toLowerCase()
    return items.filter((item) => item.name.toLowerCase().includes(query))
  }

  /**
   * Create sources for all selected items
   */
  const handleAddSources = async () => {
    if (!connection) return

    setSaving(true)
    try {
      const sourcesToCreate: CreateSourceData[] = []

      if (sourceType === 'board') {
        selectedBoards.forEach((boardId) => {
          const board = boards.find((b) => b.id === boardId)
          if (board) {
            const config: JiraSourceConfig = {
              type: 'jira',
              sourceType: 'board',
              boardId: board.id,
              boardName: board.name
            }
            sourcesToCreate.push({
              connectionId: connection.id,
              name: board.name,
              enabled: true,
              config
            })
          }
        })
      } else if (sourceType === 'filter') {
        selectedFilters.forEach((filterId) => {
          const filter = filters.find((f) => f.id === filterId)
          if (filter) {
            const config: JiraSourceConfig = {
              type: 'jira',
              sourceType: 'filter',
              filterId: filter.id,
              filterName: filter.name
            }
            sourcesToCreate.push({
              connectionId: connection.id,
              name: filter.name,
              enabled: true,
              config
            })
          }
        })
      } else if (sourceType === 'project') {
        selectedProjects.forEach((projectKey) => {
          const project = projects.find((p) => p.key === projectKey)
          if (project) {
            const config: JiraSourceConfig = {
              type: 'jira',
              sourceType: 'project',
              projectKey: project.key
            }
            sourcesToCreate.push({
              connectionId: connection.id,
              name: project.name,
              enabled: true,
              config
            })
          }
        })
      } else if (sourceType === 'jql') {
        if (customJql.trim() && jqlName.trim()) {
          const config: JiraSourceConfig = {
            type: 'jira',
            sourceType: 'jql',
            jql: customJql.trim()
          }
          sourcesToCreate.push({
            connectionId: connection.id,
            name: jqlName.trim(),
            enabled: true,
            config
          })
        }
      }

      // Create all sources
      await Promise.all(sourcesToCreate.map((data) => createSource(data)))

      handleClose()
    } catch {
      // Error is handled by store
    } finally {
      setSaving(false)
    }
  }

  /**
   * Check if form is valid for submission
   */
  const isValid = () => {
    if (sourceType === 'board') return selectedBoards.size > 0
    if (sourceType === 'filter') return selectedFilters.size > 0
    if (sourceType === 'project') return selectedProjects.size > 0
    if (sourceType === 'jql') return customJql.trim() !== '' && jqlName.trim() !== ''
    return false
  }

  if (!connection) return null

  // Only show for JIRA connections
  if (connection.type !== 'jira') {
    return null
  }

  const filteredBoards = filterBySearch(boards)
  const filteredFilters = filterBySearch(filters)
  const filteredProjects = filterBySearch(projects)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add Sources to {connection.name}</DialogTitle>
          <DialogDescription>
            Select boards, filters, projects, or create custom JQL queries to import issues from
          </DialogDescription>
        </DialogHeader>

        <Tabs value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="board">
              <Layout className="mr-2 h-4 w-4" />
              Boards
            </TabsTrigger>
            <TabsTrigger value="filter">
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </TabsTrigger>
            <TabsTrigger value="project">
              <Folder className="mr-2 h-4 w-4" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="jql">
              <Code className="mr-2 h-4 w-4" />
              Custom JQL
            </TabsTrigger>
          </TabsList>

          {/* Boards Tab */}
          <TabsContent value="board" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search boards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {discoveringBoards ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {filteredBoards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Layout className="mb-4 h-12 w-12 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        {searchQuery ? 'No boards found matching your search' : 'No boards found'}
                      </p>
                    </div>
                  ) : (
                    filteredBoards.map((board) => (
                      <Card
                        key={board.id}
                        className={cn(
                          'cursor-pointer transition-colors hover:bg-accent',
                          selectedBoards.has(board.id) && 'border-primary bg-accent'
                        )}
                        onClick={() => toggleBoard(board.id)}
                      >
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <Layout className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{board.name}</div>
                              <div className="text-xs text-muted-foreground">
                                Board ID: {board.id}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {board.type}
                            </Badge>
                            {selectedBoards.has(board.id) && (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}

            {selectedBoards.size > 0 && (
              <div className="text-sm text-muted-foreground">
                {selectedBoards.size} board{selectedBoards.size > 1 ? 's' : ''} selected
              </div>
            )}
          </TabsContent>

          {/* Filters Tab */}
          <TabsContent value="filter" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search filters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {discoveringFilters ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {filteredFilters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Filter className="mb-4 h-12 w-12 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        {searchQuery ? 'No filters found matching your search' : 'No filters found'}
                      </p>
                    </div>
                  ) : (
                    filteredFilters.map((filter) => (
                      <Card
                        key={filter.id}
                        className={cn(
                          'cursor-pointer transition-colors hover:bg-accent',
                          selectedFilters.has(filter.id) && 'border-primary bg-accent'
                        )}
                        onClick={() => toggleFilter(filter.id)}
                      >
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <Filter className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{filter.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {filter.jql}
                              </div>
                            </div>
                          </div>
                          {selectedFilters.has(filter.id) && (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}

            {selectedFilters.size > 0 && (
              <div className="text-sm text-muted-foreground">
                {selectedFilters.size} filter{selectedFilters.size > 1 ? 's' : ''} selected
              </div>
            )}
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="project" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {filteredProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Folder className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? 'No projects found matching your search' : 'No projects found'}
                    </p>
                  </div>
                ) : (
                  filteredProjects.map((project) => (
                    <Card
                      key={project.key}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-accent',
                        selectedProjects.has(project.key) && 'border-primary bg-accent'
                      )}
                      onClick={() => toggleProject(project.key)}
                    >
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <Folder className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{project.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Key: {project.key}
                            </div>
                          </div>
                        </div>
                        {selectedProjects.has(project.key) && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>

            {selectedProjects.size > 0 && (
              <div className="text-sm text-muted-foreground">
                {selectedProjects.size} project{selectedProjects.size > 1 ? 's' : ''} selected
              </div>
            )}
          </TabsContent>

          {/* Custom JQL Tab */}
          <TabsContent value="jql" className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="jql-name">Source Name</Label>
                <Input
                  id="jql-name"
                  placeholder="My Custom Query"
                  value={jqlName}
                  onChange={(e) => setJqlName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  A friendly name for this JQL query
                </p>
              </div>

              <div>
                <Label htmlFor="custom-jql">JQL Query</Label>
                <textarea
                  id="custom-jql"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                  placeholder="project = PROJ AND status = 'In Progress'"
                  value={customJql}
                  onChange={(e) => setCustomJql(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter a custom JQL query to filter issues
                </p>
              </div>

              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  JQL (JIRA Query Language) allows you to create custom filters. Examples:
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground font-mono">
                  <li>• project = MYPROJ AND assignee = currentUser()</li>
                  <li>• status = "In Progress" AND priority = High</li>
                  <li>• created &gt;= -7d AND type = Bug</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleAddSources} disabled={!isValid() || saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding Sources...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add {sourceType === 'board' && selectedBoards.size > 0 && `${selectedBoards.size} `}
                {sourceType === 'filter' && selectedFilters.size > 0 && `${selectedFilters.size} `}
                {sourceType === 'project' && selectedProjects.size > 0 && `${selectedProjects.size} `}
                Source{(sourceType === 'board' ? selectedBoards.size : sourceType === 'filter' ? selectedFilters.size : sourceType === 'project' ? selectedProjects.size : 1) > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
