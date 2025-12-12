/**
 * Issue Import View
 *
 * UI for browsing and importing issues from GitHub/JIRA integrations
 */

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Loader2,
  Download,
  RefreshCw,
  Github,
  Settings,
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { useIntegrationStore } from '@/stores/integration-store'
import { useProjectStore } from '@/stores/project-store'
import type { ExternalIssue, Integration, FetchIssuesOptions } from '@shared/types'
import { cn } from '@/lib/utils'

interface IssueImportViewProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IssueImportView({ projectId, open, onOpenChange }: IssueImportViewProps) {
  const {
    integrations,
    fetchingIssues,
    fetchIntegrationsForProject,
    fetchIssues,
    getIssuesForIntegration
  } = useIntegrationStore()

  const [projectIntegrations, setProjectIntegrations] = useState<Integration[]>([])
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('')
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch options
  const [labelFilter, setLabelFilter] = useState('')
  const [stateFilter, setStateFilter] = useState<'open' | 'closed' | 'all'>('open')

  useEffect(() => {
    if (open) {
      loadProjectIntegrations()
    }
  }, [open, projectId])

  useEffect(() => {
    if (selectedIntegrationId) {
      loadIssues()
    }
  }, [selectedIntegrationId])

  const loadProjectIntegrations = async () => {
    const integrations = await fetchIntegrationsForProject(projectId)
    setProjectIntegrations(integrations.filter((i) => i.enabled))
    if (integrations.length > 0 && !selectedIntegrationId) {
      setSelectedIntegrationId(integrations[0].id)
    }
  }

  const loadIssues = async () => {
    if (!selectedIntegrationId) return

    const options: FetchIssuesOptions = {
      state: stateFilter,
      limit: 50
    }

    if (labelFilter.trim()) {
      options.labels = labelFilter.split(',').map((l) => l.trim())
    }

    try {
      await fetchIssues(selectedIntegrationId, options)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch issues')
    }
  }

  const handleRefresh = () => {
    loadIssues()
  }

  const toggleIssueSelection = (issueId: string) => {
    const newSelection = new Set(selectedIssues)
    if (newSelection.has(issueId)) {
      newSelection.delete(issueId)
    } else {
      newSelection.add(issueId)
    }
    setSelectedIssues(newSelection)
  }

  const handleSelectAll = () => {
    if (!selectedIntegrationId) return
    const issues = getIssuesForIntegration(selectedIntegrationId)
    setSelectedIssues(new Set(issues.map((i) => i.id)))
  }

  const handleDeselectAll = () => {
    setSelectedIssues(new Set())
  }

  const handleImport = async () => {
    if (!selectedIntegrationId || selectedIssues.size === 0) return

    setImporting(true)
    setError(null)

    try {
      const issues = Array.from(selectedIssues)
      for (const issueId of issues) {
        await window.api.importIssueAsTask(selectedIntegrationId, issueId, projectId)
      }

      setImportSuccess(true)
      setSelectedIssues(new Set())

      // Auto-close after success
      setTimeout(() => {
        setImportSuccess(false)
        onOpenChange(false)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import issues')
    } finally {
      setImporting(false)
    }
  }

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'github':
        return <Github className="h-4 w-4" />
      case 'jira':
        return <Settings className="h-4 w-4" />
      default:
        return <Settings className="h-4 w-4" />
    }
  }

  const selectedIntegration = projectIntegrations.find((i) => i.id === selectedIntegrationId)
  const issues = selectedIntegrationId ? getIssuesForIntegration(selectedIntegrationId) : []
  const isLoading = fetchingIssues === selectedIntegrationId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import Issues</DialogTitle>
          <DialogDescription>
            Browse and import issues from your connected integrations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Integration Selector */}
          {projectIntegrations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No integrations configured for this project. Add an integration in Settings first.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label>Integration</Label>
                  <Select value={selectedIntegrationId} onValueChange={setSelectedIntegrationId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {projectIntegrations.map((integration) => (
                        <SelectItem key={integration.id} value={integration.id}>
                          <div className="flex items-center gap-2">
                            {getIntegrationIcon(integration.type)}
                            <span>{integration.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <Label>State</Label>
                  <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-6">
                  <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  </Button>
                </div>
              </div>

              {selectedIntegration?.type === 'github' && (
                <div>
                  <Label>Labels (optional)</Label>
                  <Input
                    placeholder="bug, feature, enhancement"
                    value={labelFilter}
                    onChange={(e) => setLabelFilter(e.target.value)}
                    onBlur={handleRefresh}
                  />
                </div>
              )}

              {/* Issues List */}
              {error && (
                <Card className="border-destructive bg-destructive/10">
                  <CardContent className="flex items-center gap-2 py-3">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive">{error}</span>
                  </CardContent>
                </Card>
              )}

              {importSuccess && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="flex items-center gap-2 py-3">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-900">
                      Successfully imported {selectedIssues.size} issue(s)
                    </span>
                  </CardContent>
                </Card>
              )}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Issues ({issues.length})</Label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDeselectAll}>
                      Deselect All
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[400px] rounded-md border">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : issues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-sm text-muted-foreground">No issues found</p>
                    </div>
                  ) : (
                    <div className="space-y-2 p-3">
                      {issues.map((issue) => (
                        <Card
                          key={issue.id}
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-accent",
                            selectedIssues.has(issue.id) && "border-primary bg-accent"
                          )}
                          onClick={() => toggleIssueSelection(issue.id)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <CardTitle className="text-sm font-medium line-clamp-1">
                                  {issue.title}
                                </CardTitle>
                                <CardDescription className="text-xs line-clamp-2 mt-1">
                                  {issue.description || 'No description'}
                                </CardDescription>
                              </div>
                              <div className="flex items-center gap-2">
                                {selectedIssues.has(issue.id) && (
                                  <CheckCircle2 className="h-4 w-4 text-primary" />
                                )}
                                <a
                                  href={issue.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pb-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {issue.id}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {issue.status}
                              </Badge>
                              {issue.labels.map((label) => (
                                <Badge key={label} variant="outline" className="text-xs">
                                  {label}
                                </Badge>
                              ))}
                              {issue.assignee && (
                                <span className="text-xs text-muted-foreground">
                                  @{issue.assignee}
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedIssues.size === 0 || importing || projectIntegrations.length === 0}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Import {selectedIssues.size > 0 ? `(${selectedIssues.size})` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
