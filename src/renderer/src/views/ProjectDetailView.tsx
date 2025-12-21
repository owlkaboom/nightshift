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
import { ScoreBreakdown } from '@/components/context'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Folder,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Edit2,
  ExternalLink,
  Sparkles
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import type { Project, ClaudeMdAnalysis, ClaudeMdSubFile } from '@shared/types'
import { PROJECT_ICONS } from '@shared/types'

type TabId = 'overview' | 'source-control' | 'context' | 'activity'

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

// Context Tab Component - Full CLAUDE.md management
function ContextTab({ projectId }: { projectId: string }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [analysis, setAnalysis] = useState<ClaudeMdAnalysis | null>(null)
  const [subFiles, setSubFiles] = useState<ClaudeMdSubFile[]>([])
  const [claudeMdContent, setClaudeMdContent] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingSubFile, setEditingSubFile] = useState<ClaudeMdSubFile | null>(null)
  const [subFileContent, setSubFileContent] = useState('')
  const [subFileDialogOpen, setSubFileDialogOpen] = useState(false)
  const [newSubFileName, setNewSubFileName] = useState('')
  const [newSubFileContent, setNewSubFileContent] = useState('')
  const [activeContextTab, setActiveContextTab] = useState<'overview' | 'edit' | 'subfiles'>('overview')

  // Load analysis when project changes
  useEffect(() => {
    const loadAnalysis = async () => {
      setLoading(true)
      try {
        const result = await window.api.analyzeClaudeMd(projectId)
        setAnalysis(result)
        setClaudeMdContent(result.content || '')
        setIsDirty(false)

        // Load sub-files
        const files = await window.api.getClaudeMdSubFiles(projectId)
        setSubFiles(files)
      } catch (error) {
        console.error('[ContextTab] Failed to load analysis:', error)
      } finally {
        setLoading(false)
      }
    }
    loadAnalysis()
  }, [projectId])

  // Handle CLAUDE.md content change
  const handleContentChange = useCallback((content: string) => {
    setClaudeMdContent(content)
    setIsDirty(true)
  }, [])

  // Handle save CLAUDE.md
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await window.api.updateClaudeMd(projectId, claudeMdContent)

      // Reload analysis
      const result = await window.api.analyzeClaudeMd(projectId)
      setAnalysis(result)
      setIsDirty(false)
    } catch (error) {
      console.error('[ContextTab] Failed to save CLAUDE.md:', error)
      alert('Failed to save CLAUDE.md')
    } finally {
      setSaving(false)
    }
  }, [projectId, claudeMdContent])

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setLoading(true)
    try {
      const [analysisResult, filesResult] = await Promise.all([
        window.api.analyzeClaudeMd(projectId),
        window.api.getClaudeMdSubFiles(projectId)
      ])
      setAnalysis(analysisResult)
      setSubFiles(filesResult)
      setClaudeMdContent(analysisResult.content || '')
      setIsDirty(false)
    } catch (error) {
      console.error('[ContextTab] Failed to refresh:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // Handle create sub-file
  const handleCreateSubFile = useCallback(async () => {
    if (!newSubFileName.trim()) return

    try {
      await window.api.createClaudeMdSubFile(
        projectId,
        newSubFileName,
        newSubFileContent
      )

      // Reload sub-files and analysis
      const [files, analysisResult] = await Promise.all([
        window.api.getClaudeMdSubFiles(projectId),
        window.api.analyzeClaudeMd(projectId)
      ])
      setSubFiles(files)
      setAnalysis(analysisResult)
      setSubFileDialogOpen(false)
      setNewSubFileName('')
      setNewSubFileContent('')
    } catch (error) {
      console.error('[ContextTab] Failed to create sub-file:', error)
      alert('Failed to create sub-file')
    }
  }, [projectId, newSubFileName, newSubFileContent])

  // Handle edit sub-file
  const handleEditSubFile = useCallback(async (file: ClaudeMdSubFile) => {
    try {
      const content = await window.api.readClaudeMdSubFile(projectId, file.name)
      setSubFileContent(content)
      setEditingSubFile(file)
    } catch (error) {
      console.error('[ContextTab] Failed to read sub-file:', error)
      alert('Failed to read sub-file')
    }
  }, [projectId])

  // Handle save sub-file
  const handleSaveSubFile = useCallback(async () => {
    if (!editingSubFile) return

    try {
      await window.api.updateClaudeMdSubFile(
        projectId,
        editingSubFile.name,
        subFileContent
      )

      // Reload sub-files
      const files = await window.api.getClaudeMdSubFiles(projectId)
      setSubFiles(files)
      setEditingSubFile(null)
      setSubFileContent('')
    } catch (error) {
      console.error('[ContextTab] Failed to save sub-file:', error)
      alert('Failed to save sub-file')
    }
  }, [projectId, editingSubFile, subFileContent])

  // Handle delete sub-file
  const handleDeleteSubFile = useCallback(async (file: ClaudeMdSubFile) => {
    if (!confirm(`Delete ${file.name}?`)) return

    try {
      await window.api.deleteClaudeMdSubFile(projectId, file.name)

      // Reload sub-files and analysis
      const [files, analysisResult] = await Promise.all([
        window.api.getClaudeMdSubFiles(projectId),
        window.api.analyzeClaudeMd(projectId)
      ])
      setSubFiles(files)
      setAnalysis(analysisResult)
    } catch (error) {
      console.error('[ContextTab] Failed to delete sub-file:', error)
      alert('Failed to delete sub-file')
    }
  }, [projectId])

  // Handle open file externally
  const handleOpenExternal = useCallback(async (filePath: string) => {
    try {
      await window.api.openExternal(filePath)
    } catch (error) {
      console.error('[ContextTab] Failed to open file:', error)
    }
  }, [])

  // Handle "Improve with AI" - navigate to Planning with claude-md session
  const handleImproveWithAI = useCallback((initialPrompt?: string) => {
    // Navigate to planning page with a query param to create a claude-md session
    const searchParams = new URLSearchParams()
    searchParams.set('projectId', projectId)
    searchParams.set('sessionType', 'claude-md')
    if (initialPrompt) {
      searchParams.set('initialPrompt', initialPrompt)
    }
    navigate({ to: '/planning', search: { projectId, sessionType: 'claude-md', initialPrompt } as any })
  }, [projectId, navigate])

  if (loading && !analysis) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading context...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">CLAUDE.md Context</h2>
          <p className="text-sm text-muted-foreground">Manage AI context and project guidelines</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Sub-tabs for Overview/Edit/Sub-files */}
      <Tabs value={activeContextTab} onValueChange={(v) => setActiveContextTab(v as typeof activeContextTab)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="subfiles">Sub-files</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {analysis && (
            <>
              {/* Setup Status Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Setup Status</CardTitle>
                      <CardDescription>
                        {analysis.exists ? 'CLAUDE.md is configured' : 'Get started with CLAUDE.md'}
                      </CardDescription>
                    </div>
                    {analysis.exists ? (
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    ) : (
                      <AlertCircle className="h-8 w-8 text-yellow-600" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analysis.exists ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="font-medium">CLAUDE.md exists</p>
                            <p className="text-xs text-muted-foreground">
                              {analysis.lineCount} lines, {analysis.sectionCount} sections
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveContextTab('edit')}
                        >
                          Edit
                        </Button>
                      </div>

                      {/* Score Breakdown */}
                      <div className="p-4 rounded-lg border bg-card">
                        <ScoreBreakdown analysis={analysis} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900">
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                        <div className="flex-1">
                          <p className="font-medium text-yellow-900 dark:text-yellow-100">
                            No CLAUDE.md file found
                          </p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-300">
                            Create one to provide AI context for your project
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setActiveContextTab('edit')}
                        >
                          Create
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* What's Missing Card */}
              {analysis.exists && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {analysis.qualityScore >= 80 ? 'Optional Enhancements' : "What's Missing"}
                    </CardTitle>
                    <CardDescription>
                      {analysis.qualityScore >= 80
                        ? 'Your setup is complete! Consider these advanced features.'
                        : 'Improve AI understanding by adding these sections'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {/* Essential Sections */}
                      {!analysis.hasQuickStart && (
                        <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
                          <AlertCircle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">Quick Start section</p>
                            <p className="text-sm text-muted-foreground">
                              Add setup commands and getting started instructions
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleImproveWithAI('I want to add a Quick Start section to my CLAUDE.md file. Please help me create setup commands and getting started instructions for developers who are new to this project.')}
                          >
                            <Sparkles className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      )}

                      {!analysis.hasArchitectureInfo && (
                        <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
                          <AlertCircle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">Architecture Overview</p>
                            <p className="text-sm text-muted-foreground">
                              Explain system design and component structure
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleImproveWithAI('I want to add an Architecture Overview section to my CLAUDE.md file. Please help me explain the system design and component structure of this project.')}
                          >
                            <Sparkles className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      )}

                      {!analysis.hasCodeConventions && (
                        <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
                          <AlertCircle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">Code Conventions</p>
                            <p className="text-sm text-muted-foreground">
                              Document coding standards and best practices
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleImproveWithAI('I want to add a Code Conventions section to my CLAUDE.md file. Please help me document the coding standards and best practices for this project.')}
                          >
                            <Sparkles className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      )}

                      {/* All good state */}
                      {analysis.hasQuickStart &&
                       analysis.hasArchitectureInfo &&
                       analysis.hasCodeConventions && (
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium text-green-900 dark:text-green-100">
                              All essential sections present
                            </p>
                            <p className="text-sm text-green-700 dark:text-green-300">
                              Your CLAUDE.md provides comprehensive project context
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quick Actions Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>
                    Manage your project documentation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-start gap-2"
                      onClick={() => setActiveContextTab('edit')}
                    >
                      <div className="flex items-center gap-2">
                        <Edit2 className="h-4 w-4" />
                        <span className="font-medium">Edit CLAUDE.md</span>
                      </div>
                      <p className="text-xs text-muted-foreground text-left">
                        Manually update project instructions
                      </p>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-start gap-2"
                      onClick={() => handleImproveWithAI()}
                      disabled={!analysis.exists}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        <span className="font-medium">Improve with AI</span>
                      </div>
                      <p className="text-xs text-muted-foreground text-left">
                        Get AI help improving your docs
                      </p>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-start gap-2"
                      onClick={() => setActiveContextTab('subfiles')}
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        <span className="font-medium">Manage Sub-files</span>
                      </div>
                      <p className="text-xs text-muted-foreground text-left">
                        Organize detailed guidelines ({analysis.subFiles.length} files)
                      </p>
                    </Button>

                    {analysis.path && (
                      <Button
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-start gap-2"
                        onClick={() => handleOpenExternal(analysis.path!)}
                      >
                        <div className="flex items-center gap-2">
                          <ExternalLink className="h-4 w-4" />
                          <span className="font-medium">Open Externally</span>
                        </div>
                        <p className="text-xs text-muted-foreground text-left">
                          Edit in your preferred editor
                        </p>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Edit Tab */}
        <TabsContent value="edit" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Edit CLAUDE.md</CardTitle>
                  <CardDescription>
                    {analysis?.path || 'Will be created on save'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {isDirty && (
                    <span className="text-sm text-yellow-600">Unsaved changes</span>
                  )}
                  <Button
                    onClick={handleSave}
                    disabled={!isDirty || saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={claudeMdContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="# Project Name&#10;&#10;## Quick Start&#10;&#10;## Architecture Overview&#10;&#10;## Code Conventions"
                className="font-mono text-sm min-h-[600px]"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sub-files Tab */}
        <TabsContent value="subfiles" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Detailed Guidelines</CardTitle>
                  <CardDescription>
                    Files in .claude/docs/ directory
                  </CardDescription>
                </div>
                <Button onClick={() => setSubFileDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Document
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {subFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No sub-files yet</p>
                  <p className="text-xs">Create detailed guidelines for specific topics</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {subFiles.map((file) => (
                    <div
                      key={file.path}
                      className="p-3 rounded-lg border bg-muted/50 flex items-start justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0" />
                          <h4 className="font-medium truncate">{file.name}</h4>
                        </div>
                        {file.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {file.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {file.lineCount} lines · {(file.sizeBytes / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenExternal(file.path)}
                          title="Open in external editor"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditSubFile(file)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSubFile(file)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Sub-file Dialog */}
      <Dialog open={subFileDialogOpen} onOpenChange={setSubFileDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Guideline Document</DialogTitle>
            <DialogDescription>
              Create a new document in .claude/docs/ for detailed guidelines
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="filename">File Name</Label>
              <Input
                id="filename"
                placeholder="testing.md"
                value={newSubFileName}
                onChange={(e) => setNewSubFileName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                placeholder="# Testing Guidelines&#10;&#10;## Unit Tests&#10;&#10;## Integration Tests"
                value={newSubFileContent}
                onChange={(e) => setNewSubFileContent(e.target.value)}
                className="font-mono text-sm min-h-[300px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubFileDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubFile} disabled={!newSubFileName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sub-file Dialog */}
      <Dialog open={!!editingSubFile} onOpenChange={(open) => !open && setEditingSubFile(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {editingSubFile?.name}</DialogTitle>
            <DialogDescription>
              {editingSubFile?.path}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={subFileContent}
              onChange={(e) => setSubFileContent(e.target.value)}
              className="font-mono text-sm min-h-[400px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSubFile(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSubFile}>
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          <SourceControlTab />
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

