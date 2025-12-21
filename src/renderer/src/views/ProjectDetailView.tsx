/**
 * ProjectDetailView - Main project detail page with tabs
 *
 * Provides tabbed interface for:
 * - Overview: Project info and quick stats
 * - Source Control: Git operations (VS Code-style)
 * - Context: CLAUDE.md management (migrated from ProjectContextView)
 * - Activity: Recent activity/commits (placeholder)
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useProjectStore, useSourceControlStore } from '@/stores'
import { SourceControlTab } from '@/components/projects/source-control'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  ArrowLeft,
  FolderOpen,
  GitBranch,
  FileText,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings,
  FolderGit2,
  Folder
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import type { Project } from '@shared/types'
import { PROJECT_ICONS } from '@shared/types'

type TabId = 'overview' | 'source-control' | 'context' | 'activity'

export function ProjectDetailView() {
  const { projectId } = useParams({ from: '/projects/$projectId' })
  const navigate = useNavigate()
  const { projects, fetchProjects } = useProjectStore()
  const { currentBranch, recentCommits, setProjectId: setSourceControlProjectId } = useSourceControlStore()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const saved = localStorage.getItem(`project-detail-tab-${projectId}`)
    return (saved as TabId) || 'overview'
  })

  // Persist active tab
  useEffect(() => {
    localStorage.setItem(`project-detail-tab-${projectId}`, activeTab)
  }, [activeTab, projectId])

  // Load project data
  useEffect(() => {
    const loadProject = async () => {
      setLoading(true)
      try {
        await fetchProjects()
      } finally {
        setLoading(false)
      }
    }
    loadProject()
  }, [fetchProjects])

  // Find project from store
  useEffect(() => {
    const found = projects.find(p => p.id === projectId)
    setProject(found || null)
  }, [projects, projectId])

  // Initialize source control store with project ID
  useEffect(() => {
    setSourceControlProjectId(projectId)
    return () => setSourceControlProjectId(null)
  }, [projectId, setSourceControlProjectId])


  // Handle open in Finder/Explorer
  const handleOpenInFinder = useCallback(async () => {
    if (project?.path) {
      try {
        await window.api.openExternal(project.path)
      } catch (error) {
        console.error('[ProjectDetailView] Failed to open in finder:', error)
      }
    }
  }, [project?.path])

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate({ to: '/projects' })
  }, [navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading project...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Project Not Found</h3>
            <p className="text-sm text-muted-foreground">
              The project you're looking for doesn't exist or has been deleted.
            </p>
          </div>
          <Button onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  // Helper to get icon component from name
  const getIconComponent = (iconName: string) => {
    const Icon = LucideIcons[iconName as keyof typeof LucideIcons] as LucideIcons.LucideIcon
    return Icon || (project.gitUrl ? FolderGit2 : Folder)
  }

  // Render the icon based on type
  const renderIcon = () => {
    if (project.icon) {
      // Check if it's a Lucide icon name
      if (PROJECT_ICONS.includes(project.icon as (typeof PROJECT_ICONS)[number])) {
        const Icon = getIconComponent(project.icon)
        return <Icon className="h-8 w-8 text-primary" />
      }
      // It's a custom image URL/path
      return (
        <img
          src={project.icon}
          alt=""
          className="h-8 w-8 object-contain"
          onError={(e) => {
            // Fallback to default icon on error
            e.currentTarget.style.display = 'none'
          }}
        />
      )
    }
    // Default icon based on project type
    return project.gitUrl ? (
      <FolderGit2 className="h-8 w-8 text-primary" />
    ) : (
      <Folder className="h-8 w-8 text-primary" />
    )
  }

  // Get icon display name
  const getIconName = () => {
    if (!project.icon) {
      return project.gitUrl ? 'FolderGit2' : 'Folder'
    }
    if (PROJECT_ICONS.includes(project.icon as (typeof PROJECT_ICONS)[number])) {
      return project.icon
    }
    return 'Custom Icon'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              {renderIcon()}
            </div>
            <div>
              <h1 className="text-lg font-semibold">{project.name}</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  {getIconName()}
                </p>
                {project.path && (
                  <>
                    <span className="text-xs text-muted-foreground">•</span>
                    <p className="text-xs text-muted-foreground font-mono truncate max-w-[400px]">
                      {project.path}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentBranch && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted text-sm">
              <GitBranch className="h-3.5 w-3.5" />
              <span className="font-mono">{currentBranch}</span>
            </div>
          )}
          {project.path && (
            <Button variant="outline" size="sm" onClick={handleOpenInFinder}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Open in Finder
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabId)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="border-b px-4">
          <TabsList className="h-10">
            <TabsTrigger value="overview" className="gap-2">
              <Settings className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="source-control" className="gap-2">
              <GitBranch className="h-4 w-4" />
              Source Control
            </TabsTrigger>
            <TabsTrigger value="context" className="gap-2">
              <FileText className="h-4 w-4" />
              Context
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="h-4 w-4" />
              Activity
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="flex-1 overflow-auto p-4 space-y-4">
          <OverviewTab project={project} />
        </TabsContent>

        {/* Source Control Tab */}
        <TabsContent value="source-control" className="flex-1 overflow-hidden">
          <SourceControlTab projectId={project.id} />
        </TabsContent>

        {/* Context Tab */}
        <TabsContent value="context" className="flex-1 overflow-auto p-4">
          <ContextTab projectId={project.id} />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="flex-1 overflow-auto p-4">
          <ActivityTab recentCommits={recentCommits} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Overview Tab Component
function OverviewTab({ project }: { project: Project }) {
  const { remoteStatus, recentCommits, stashes } = useSourceControlStore()

  // Helper to get icon component from name
  const getIconComponent = (iconName: string) => {
    const Icon = LucideIcons[iconName as keyof typeof LucideIcons] as LucideIcons.LucideIcon
    return Icon || (project.gitUrl ? FolderGit2 : Folder)
  }

  // Render the icon based on type
  const renderIcon = () => {
    if (project.icon) {
      // Check if it's a Lucide icon name
      if (PROJECT_ICONS.includes(project.icon as (typeof PROJECT_ICONS)[number])) {
        const Icon = getIconComponent(project.icon)
        return <Icon className="h-5 w-5 text-primary" />
      }
      // It's a custom image URL/path
      return (
        <img
          src={project.icon}
          alt=""
          className="h-5 w-5 object-contain"
          onError={(e) => {
            // Fallback to default icon on error
            e.currentTarget.style.display = 'none'
          }}
        />
      )
    }
    // Default icon based on project type
    return project.gitUrl ? (
      <FolderGit2 className="h-5 w-5 text-primary" />
    ) : (
      <Folder className="h-5 w-5 text-primary" />
    )
  }

  // Get icon display name
  const getIconName = () => {
    if (!project.icon) {
      return project.gitUrl ? 'FolderGit2 (default)' : 'Folder (default)'
    }
    if (PROJECT_ICONS.includes(project.icon as (typeof PROJECT_ICONS)[number])) {
      return project.icon
    }
    return 'Custom Icon'
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Project Info Card */}
      <Card className="md:col-span-2 lg:col-span-1">
        <CardHeader>
          <CardTitle>Project Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Name</p>
            <p>{project.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Icon</p>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                {renderIcon()}
              </div>
              <p className="text-sm">{getIconName()}</p>
            </div>
          </div>
          {project.path && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Path</p>
              <p className="font-mono text-sm truncate">{project.path}</p>
            </div>
          )}
          {project.description && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="text-sm">{project.description}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-muted-foreground">Added</p>
            <p className="text-sm">
              {new Date(project.addedAt).toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Git Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Git Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {remoteStatus ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ahead</span>
                <span className={remoteStatus.ahead > 0 ? 'text-green-600 font-medium' : ''}>
                  {remoteStatus.ahead} commits
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Behind</span>
                <span className={remoteStatus.behind > 0 ? 'text-orange-600 font-medium' : ''}>
                  {remoteStatus.behind} commits
                </span>
              </div>
              {remoteStatus.tracking && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tracking</span>
                  <span className="font-mono text-sm">{remoteStatus.tracking}</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Not a git repository</p>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Quick Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Recent Commits</span>
            <span>{recentCommits.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Stashes</span>
            <span>{stashes.length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Recent Commits Card */}
      <Card className="md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Commits
          </CardTitle>
          <CardDescription>Latest commits in this repository</CardDescription>
        </CardHeader>
        <CardContent>
          {recentCommits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commits yet</p>
          ) : (
            <div className="space-y-2">
              {recentCommits.slice(0, 5).map((commit) => (
                <div
                  key={commit.hash}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50"
                >
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{commit.message}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{commit.hash.slice(0, 7)}</span>
                      <span>•</span>
                      <span>{commit.author}</span>
                      <span>•</span>
                      <span>{new Date(commit.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Context Tab Component (simplified - full functionality in ProjectContextView)
function ContextTab({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true)
  const [hasClaudeMd, setHasClaudeMd] = useState(false)
  const [qualityScore, setQualityScore] = useState(0)

  useEffect(() => {
    const loadAnalysis = async () => {
      setLoading(true)
      try {
        const analysis = await window.api.analyzeClaudeMd(projectId)
        setHasClaudeMd(analysis.exists)
        setQualityScore(analysis.qualityScore)
      } catch (error) {
        console.error('[ContextTab] Failed to load analysis:', error)
      } finally {
        setLoading(false)
      }
    }
    loadAnalysis()
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                CLAUDE.md Configuration
              </CardTitle>
              <CardDescription>
                AI context and project guidelines
              </CardDescription>
            </div>
            {hasClaudeMd ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">Configured</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="text-sm font-medium">Not configured</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {hasClaudeMd ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">Quality Score</p>
                  <p className="text-sm text-muted-foreground">
                    Based on section completeness
                  </p>
                </div>
                <div className="text-3xl font-bold">{qualityScore}%</div>
              </div>
              <p className="text-sm text-muted-foreground">
                For full CLAUDE.md management, visit the dedicated Context page from the sidebar.
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-600" />
              <h3 className="font-medium mb-2">No CLAUDE.md Found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a CLAUDE.md file to provide AI with project context and guidelines.
              </p>
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Create CLAUDE.md
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Activity Tab Component
function ActivityTab({ recentCommits }: { recentCommits: Array<{ hash: string; message: string; author: string; date: string }> }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Commit history and project activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentCommits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No activity yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCommits.map((commit) => (
                <div
                  key={commit.hash}
                  className="flex items-start gap-3 p-3 rounded-lg border"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{commit.message}</p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {commit.hash.slice(0, 7)}
                      </span>
                      <span>{commit.author}</span>
                      <span>•</span>
                      <span>{new Date(commit.date).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
