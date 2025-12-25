/**
 * Source View (formerly Integration View)
 *
 * A dedicated page for browsing and importing issues from a specific source
 * Allows users to filter, search, and import issues from GitHub or Jira sources
 *
 * Note: This component maintains the route name /integrations/$integrationId for backward
 * compatibility, but the integrationId parameter now refers to a source ID
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Search, Github, ExternalLink, CheckSquare, Square, ArrowLeft, Plug, ChevronLeft, ChevronRight } from 'lucide-react'
import { useIntegrationStore } from '@/stores/integration-store'
import { useTaskStore } from '@/stores/task-store'
import { useProjectStore } from '@/stores/project-store'
import type { ExternalIssue, FetchIssuesOptions } from '@shared/types'
import { cn } from '@/lib/utils'

interface IntegrationViewParams {
  integrationId: string // Actually a source ID in the new model
}

/**
 * View for browsing and importing issues from a source
 * @deprecated Component name - should be SourceView but kept as IntegrationView for route compatibility
 */
export function IntegrationView() {
  const params = useParams({ from: '/integrations/$integrationId' }) as IntegrationViewParams
  const navigate = useNavigate()
  const {
    sources,
    connections,
    fetchSources,
    fetchConnections,
    fetchingIssues,
    error: integrationError
  } = useIntegrationStore()
  const { fetchTasks } = useTaskStore()
  const { projects } = useProjectStore()

  const [issues, setIssues] = useState<ExternalIssue[]>([])
  const [filteredIssues, setFilteredIssues] = useState<ExternalIssue[]>([])
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterState, setFilterState] = useState<'open' | 'closed' | 'all'>('open')
  const [filterAssignedToMe, setFilterAssignedToMe] = useState(true)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalIssues, setTotalIssues] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const pageSize = 25

  // Get current source and connection
  // Handle both source IDs and legacy integration IDs
  const sourceId = params.integrationId
  let source = sources.find((s) => s.id === sourceId)

  // Fallback: Check if this is a legacy integration ID that was migrated
  // After migration, sources are created with ID: `${integrationId}_source`
  if (!source) {
    source = sources.find((s) => s.id === `${sourceId}_source`)
  }

  const connection = source ? connections.find((c) => c.id === source.connectionId) : undefined

  // Fetch sources and connections on mount
  useEffect(() => {
    fetchSources()
    fetchConnections()
  }, [fetchSources, fetchConnections])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filterState, filterAssignedToMe])

  // Fetch issues when source, filters, or page changes
  useEffect(() => {
    if (source) {
      loadIssues()
    }
  }, [source, filterState, filterAssignedToMe, currentPage])

  // Filter issues based on search query (assignee filter is now handled at API level)
  useEffect(() => {
    let filtered = issues

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (issue) =>
          issue.title.toLowerCase().includes(query) ||
          issue.description.toLowerCase().includes(query) ||
          issue.id.toLowerCase().includes(query)
      )
    }

    setFilteredIssues(filtered)
  }, [issues, searchQuery])

  const loadIssues = async () => {
    if (!source) return

    setError(null)
    try {
      const options: FetchIssuesOptions = {
        state: filterState,
        assignedToMe: filterAssignedToMe,
        limit: pageSize,
        startAt: (currentPage - 1) * pageSize
      }

      const result = await window.api.fetchSourceIssues(source.id, options)
      setIssues(result.issues || [])
      setTotalIssues(result.total || 0)
      setHasMore(result.hasMore || false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch issues')
    }
  }

  const handleToggleIssue = (issueId: string) => {
    const newSelected = new Set(selectedIssueIds)
    if (newSelected.has(issueId)) {
      newSelected.delete(issueId)
    } else {
      newSelected.add(issueId)
    }
    setSelectedIssueIds(newSelected)
  }

  const handleToggleAll = () => {
    if (selectedIssueIds.size === filteredIssues.length) {
      setSelectedIssueIds(new Set())
    } else {
      setSelectedIssueIds(new Set(filteredIssues.map((issue) => issue.id)))
    }
  }

  const handleImport = async () => {
    if (!source || selectedIssueIds.size === 0 || !selectedProjectId) return

    setImporting(true)
    setError(null)

    try {
      const importPromises = Array.from(selectedIssueIds).map((issueId) =>
        window.api.importSourceIssueAsTask(source.id, issueId, selectedProjectId)
      )

      await Promise.all(importPromises)

      // Refresh tasks
      await fetchTasks()

      // Clear selection
      setSelectedIssueIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import issues')
    } finally {
      setImporting(false)
    }
  }

  const handleBack = () => {
    navigate({ to: '/settings', search: { section: 'integrations' } })
  }

  if (!source || !connection) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Plug className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Source not found</p>
        <Button onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Settings
        </Button>
      </div>
    )
  }

  const isLoading = fetchingIssues === source.id
  const allSelected = filteredIssues.length > 0 && selectedIssueIds.size === filteredIssues.length
  const IntegrationIcon = connection.type === 'github' ? Github : Plug

  return (
    <div className="h-full flex flex-col p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <IntegrationIcon className="h-6 w-6 shrink-0" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{source.name}</h1>
          <p className="text-sm text-muted-foreground">
            {connection.name} ({connection.type})
          </p>
        </div>
        <Badge variant={source.enabled ? 'default' : 'secondary'}>
          {source.enabled ? 'Active' : 'Disabled'}
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1">
          <Label className="sr-only">Search issues</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search issues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <Select value={filterState} onValueChange={(v) => setFilterState(v as typeof filterState)}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 px-3 border rounded-md">
          <Checkbox
            id="assigned-to-me"
            checked={filterAssignedToMe}
            onCheckedChange={(checked) => setFilterAssignedToMe(checked === true)}
          />
          <Label htmlFor="assigned-to-me" className="text-sm cursor-pointer">
            Assigned to me
          </Label>
        </div>
      </div>

      {/* Error Display */}
      {(error || integrationError) && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm mb-4">
          {error || integrationError}
        </div>
      )}

      {/* Issue List */}
      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <p className="text-sm text-muted-foreground">
            {issues.length === 0
              ? 'No issues found for this integration'
              : 'No issues match your filters'}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Select All Header */}
          <div className="flex items-center gap-2 pb-2 border-b">
            <button
              onClick={handleToggleAll}
              className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
            >
              {allSelected ? (
                <CheckSquare className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              <span>
                {selectedIssueIds.size > 0
                  ? `${selectedIssueIds.size} selected`
                  : 'Select all'}
              </span>
            </button>
            <span className="text-sm text-muted-foreground">
              ({filteredIssues.length} {filteredIssues.length === 1 ? 'issue' : 'issues'})
            </span>
          </div>

          {/* Issues List */}
          <ScrollArea className="flex-1 pr-4 mt-2">
            <div className="space-y-2">
              {filteredIssues.map((issue) => {
                const isSelected = selectedIssueIds.has(issue.id)
                return (
                  <div
                    key={issue.id}
                    className={cn(
                      'flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                    onClick={() => handleToggleIssue(issue.id)}
                  >
                    <Checkbox checked={isSelected} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-medium text-sm leading-tight">
                          {issue.title}
                        </h4>
                        <a
                          href={issue.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
                        <span className="font-mono">{issue.id}</span>
                        {issue.assignee && (
                          <>
                            <span>•</span>
                            <span>{issue.assignee}</span>
                          </>
                        )}
                        <span>•</span>
                        <Badge variant="outline" className="capitalize">
                          {issue.status}
                        </Badge>
                      </div>
                      {issue.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {issue.labels.slice(0, 5).map((label) => (
                            <Badge key={label} variant="secondary" className="text-xs">
                              {label}
                            </Badge>
                          ))}
                          {issue.labels.length > 5 && (
                            <Badge variant="secondary" className="text-xs">
                              +{issue.labels.length - 5}
                            </Badge>
                          )}
                        </div>
                      )}
                      {issue.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {issue.description}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && totalIssues > 0 && (
        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {Math.min((currentPage - 1) * pageSize + 1, totalIssues)}-
            {Math.min(currentPage * pageSize, totalIssues)} of {totalIssues} issues
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="text-sm font-medium px-2">
              Page {currentPage} of {Math.ceil(totalIssues / pageSize)}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={!hasMore || isLoading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Import Controls */}
      {selectedIssueIds.size > 0 && (
        <div className="flex items-center gap-3 pt-4 border-t mt-4">
          <div className="flex-1">
            <Label htmlFor="project-select" className="text-sm mb-2 block">
              Import to Project
            </Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger id="project-select">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.length === 0 ? (
                  <div className="px-2 py-1 text-sm text-muted-foreground">
                    No projects available
                  </div>
                ) : (
                  projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleImport}
            disabled={!selectedProjectId || importing}
            className="mt-6"
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing {selectedIssueIds.size} {selectedIssueIds.size === 1 ? 'issue' : 'issues'}...
              </>
            ) : (
              <>
                Import {selectedIssueIds.size} {selectedIssueIds.size === 1 ? 'issue' : 'issues'}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
