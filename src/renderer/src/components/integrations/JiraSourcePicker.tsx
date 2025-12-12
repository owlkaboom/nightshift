/**
 * JiraSourcePicker component - UI for selecting and configuring a Jira source
 */

import { useEffect, useState } from 'react'
import type { JiraBoard, JiraFilter, JiraProject, JiraSourceConfig } from '@shared/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { useIntegrationStore } from '@/stores/integration-store'

interface JiraSourcePickerProps {
  connectionId: string
  value: JiraSourceConfig | null
  onChange: (config: JiraSourceConfig) => void
}

type SourceType = 'board' | 'sprint' | 'backlog' | 'filter' | 'jql' | 'project'

/**
 * Component for picking and configuring a Jira source type
 * Handles discovery of boards, filters, and projects
 */
export function JiraSourcePicker({ connectionId, value, onChange }: JiraSourcePickerProps) {
  const {
    getCachedBoards,
    getCachedFilters,
    getCachedProjects,
    discoverBoards,
    discoverFilters,
    discoverProjects,
    discoveringBoards,
    discoveringFilters
  } = useIntegrationStore()

  const [sourceType, setSourceType] = useState<SourceType>(
    value?.sourceType || 'board'
  )
  const [boards, setBoards] = useState<JiraBoard[]>([])
  const [filters, setFilters] = useState<JiraFilter[]>([])
  const [projects, setProjects] = useState<JiraProject[]>([])

  // Form fields
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(
    value?.sourceType === 'board' || value?.sourceType === 'sprint' || value?.sourceType === 'backlog'
      ? value.boardId
      : null
  )
  const [selectedFilterId, setSelectedFilterId] = useState<number | null>(
    value?.sourceType === 'filter' ? value.filterId : null
  )
  const [selectedProjectKey, setSelectedProjectKey] = useState<string>(
    value?.sourceType === 'project' ? value.projectKey : ''
  )
  const [jqlQuery, setJqlQuery] = useState<string>(
    value?.sourceType === 'jql' ? value.jql : ''
  )
  const [sprintState, setSprintState] = useState<'active' | 'future' | 'closed'>(
    value?.sourceType === 'sprint' ? value.sprintState : 'active'
  )

  // Load cached data or discover on mount
  useEffect(() => {
    const loadData = async () => {
      // Load boards
      const cachedBoards = getCachedBoards(connectionId)
      if (cachedBoards) {
        setBoards(cachedBoards)
      } else {
        try {
          const discovered = await discoverBoards(connectionId)
          setBoards(discovered)
        } catch (error) {
          console.error('Failed to discover boards:', error)
        }
      }

      // Load filters
      const cachedFilters = getCachedFilters(connectionId)
      if (cachedFilters) {
        setFilters(cachedFilters)
      } else {
        try {
          const discovered = await discoverFilters(connectionId)
          setFilters(discovered)
        } catch (error) {
          console.error('Failed to discover filters:', error)
        }
      }

      // Load projects
      const cachedProjects = getCachedProjects(connectionId)
      if (cachedProjects) {
        setProjects(cachedProjects)
      } else {
        try {
          const discovered = await discoverProjects(connectionId)
          setProjects(discovered)
        } catch (error) {
          console.error('Failed to discover projects:', error)
        }
      }
    }

    loadData()
  }, [connectionId])

  // Update parent when configuration changes
  useEffect(() => {
    let config: JiraSourceConfig | null = null

    switch (sourceType) {
      case 'board':
        if (selectedBoardId !== null) {
          const board = boards.find((b) => b.id === selectedBoardId)
          config = {
            type: 'jira',
            sourceType: 'board',
            boardId: selectedBoardId,
            boardName: board?.name
          }
        }
        break

      case 'sprint':
        if (selectedBoardId !== null) {
          config = {
            type: 'jira',
            sourceType: 'sprint',
            boardId: selectedBoardId,
            sprintState
          }
        }
        break

      case 'backlog':
        if (selectedBoardId !== null) {
          config = {
            type: 'jira',
            sourceType: 'backlog',
            boardId: selectedBoardId
          }
        }
        break

      case 'filter':
        if (selectedFilterId !== null) {
          const filter = filters.find((f) => f.id === selectedFilterId)
          config = {
            type: 'jira',
            sourceType: 'filter',
            filterId: selectedFilterId,
            filterName: filter?.name
          }
        }
        break

      case 'jql':
        if (jqlQuery.trim()) {
          config = {
            type: 'jira',
            sourceType: 'jql',
            jql: jqlQuery.trim()
          }
        }
        break

      case 'project':
        if (selectedProjectKey.trim()) {
          config = {
            type: 'jira',
            sourceType: 'project',
            projectKey: selectedProjectKey.trim()
          }
        }
        break
    }

    if (config) {
      onChange(config)
    }
  }, [sourceType, selectedBoardId, selectedFilterId, selectedProjectKey, jqlQuery, sprintState, boards, filters])

  const isLoadingBoards = discoveringBoards === connectionId
  const isLoadingFilters = discoveringFilters === connectionId

  return (
    <div className="space-y-4">
      {/* Source type selector */}
      <div className="space-y-2">
        <Label>Source Type</Label>
        <Select value={sourceType} onValueChange={(value) => setSourceType(value as SourceType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="board">Board</SelectItem>
            <SelectItem value="sprint">Sprint</SelectItem>
            <SelectItem value="backlog">Backlog</SelectItem>
            <SelectItem value="filter">Saved Filter</SelectItem>
            <SelectItem value="jql">Custom JQL</SelectItem>
            <SelectItem value="project">Project</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Board selector (for board, sprint, backlog) */}
      {(sourceType === 'board' || sourceType === 'sprint' || sourceType === 'backlog') && (
        <div className="space-y-2">
          <Label>Board</Label>
          {isLoadingBoards ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading boards...
            </div>
          ) : boards.length === 0 ? (
            <div className="text-sm text-muted-foreground">No boards found</div>
          ) : (
            <Select
              value={selectedBoardId?.toString() || ''}
              onValueChange={(value) => setSelectedBoardId(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a board" />
              </SelectTrigger>
              <SelectContent>
                {boards.map((board) => (
                  <SelectItem key={board.id} value={board.id.toString()}>
                    {board.name} ({board.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Sprint state selector (for sprint) */}
      {sourceType === 'sprint' && (
        <div className="space-y-2">
          <Label>Sprint State</Label>
          <Select value={sprintState} onValueChange={(value) => setSprintState(value as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="future">Future</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Filter selector */}
      {sourceType === 'filter' && (
        <div className="space-y-2">
          <Label>Saved Filter</Label>
          {isLoadingFilters ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading filters...
            </div>
          ) : filters.length === 0 ? (
            <div className="text-sm text-muted-foreground">No filters found</div>
          ) : (
            <Select
              value={selectedFilterId?.toString() || ''}
              onValueChange={(value) => setSelectedFilterId(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a filter" />
              </SelectTrigger>
              <SelectContent>
                {filters.map((filter) => (
                  <SelectItem key={filter.id} value={filter.id.toString()}>
                    {filter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* JQL input */}
      {sourceType === 'jql' && (
        <div className="space-y-2">
          <Label>JQL Query</Label>
          <Textarea
            placeholder="project = PROJ AND status = 'In Progress'"
            value={jqlQuery}
            onChange={(e) => setJqlQuery(e.target.value)}
            rows={3}
          />
        </div>
      )}

      {/* Project key input */}
      {sourceType === 'project' && (
        <div className="space-y-2">
          <Label>Project Key</Label>
          {projects.length > 0 ? (
            <Select
              value={selectedProjectKey}
              onValueChange={setSelectedProjectKey}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.key} value={project.key}>
                    {project.name} ({project.key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              placeholder="PROJ"
              value={selectedProjectKey}
              onChange={(e) => setSelectedProjectKey(e.target.value.toUpperCase())}
            />
          )}
        </div>
      )}
    </div>
  )
}
