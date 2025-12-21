/**
 * ProjectContextView - CLAUDE.md and project context management
 *
 * Provides interface for:
 * - Viewing/editing CLAUDE.md content
 * - Managing .claude/docs/ sub-files
 * - Quality metrics and recommendations
 * - Project selector for multi-project environments
 */

import { useEffect, useState, useCallback } from 'react'
import { useProjectStore } from '@/stores'
import { ClaudeMdChatPanel, ScoreBreakdown } from '@/components/context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  FileText,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ExternalLink
} from 'lucide-react'
import type { ClaudeMdAnalysis, ClaudeMdSubFile } from '@shared/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ProjectContextView() {
  const { projects, fetchProjects, selectedProjectId, selectProject } = useProjectStore()
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
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'subfiles' | 'ai-assistant'>(() => {
    // Load sticky tab from localStorage
    const saved = localStorage.getItem('context-view-active-tab')
    return (saved as 'overview' | 'edit' | 'subfiles' | 'ai-assistant') || 'overview'
  })
  const [pathError, setPathError] = useState<string | null>(null)
  const [showPathDialog, setShowPathDialog] = useState(false)
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>(undefined)

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('context-view-active-tab', activeTab)
  }, [activeTab])

  // Initial data fetch
  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Load analysis when project changes
  useEffect(() => {
    const loadAnalysis = async () => {
      if (!selectedProjectId) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const result = await window.api.analyzeClaudeMd(selectedProjectId)
        setAnalysis(result)
        setClaudeMdContent(result.content || '')
        setIsDirty(false)

        // Load sub-files
        const files = await window.api.getClaudeMdSubFiles(selectedProjectId)
        setSubFiles(files)
      } catch (error) {
        console.error('[ProjectContextView] Failed to load analysis:', error)

        // Show error to user with actionable message
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // Check if it's a missing path error
        if (errorMessage.includes('path is not configured')) {
          setPathError(errorMessage)
          setShowPathDialog(true)
        } else {
          alert(`Failed to load project context: ${errorMessage}`)
        }
      } finally {
        setLoading(false)
      }
    }

    loadAnalysis()
  }, [selectedProjectId])

  // Handle project selection
  const handleProjectSelect = useCallback((projectId: string) => {
    selectProject(projectId)
  }, [selectProject])

  // Handle CLAUDE.md content change
  const handleContentChange = useCallback((content: string) => {
    setClaudeMdContent(content)
    setIsDirty(true)
  }, [])

  // Handle save CLAUDE.md
  const handleSave = useCallback(async () => {
    if (!selectedProjectId) return

    setSaving(true)
    try {
      await window.api.updateClaudeMd(selectedProjectId, claudeMdContent)

      // Reload analysis
      const result = await window.api.analyzeClaudeMd(selectedProjectId)
      setAnalysis(result)
      setIsDirty(false)
    } catch (error) {
      console.error('[ProjectContextView] Failed to save CLAUDE.md:', error)
      alert('Failed to save CLAUDE.md')
    } finally {
      setSaving(false)
    }
  }, [selectedProjectId, claudeMdContent])

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (!selectedProjectId) return

    setLoading(true)
    try {
      const [analysisResult, filesResult] = await Promise.all([
        window.api.analyzeClaudeMd(selectedProjectId),
        window.api.getClaudeMdSubFiles(selectedProjectId)
      ])
      setAnalysis(analysisResult)
      setSubFiles(filesResult)
      setClaudeMdContent(analysisResult.content || '')
      setIsDirty(false)
    } catch (error) {
      console.error('[ProjectContextView] Failed to refresh:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedProjectId])

  // Handle create sub-file
  const handleCreateSubFile = useCallback(async () => {
    if (!selectedProjectId || !newSubFileName.trim()) return

    try {
      await window.api.createClaudeMdSubFile(
        selectedProjectId,
        newSubFileName,
        newSubFileContent
      )

      // Reload sub-files and analysis
      const [files, analysisResult] = await Promise.all([
        window.api.getClaudeMdSubFiles(selectedProjectId),
        window.api.analyzeClaudeMd(selectedProjectId)
      ])
      setSubFiles(files)
      setAnalysis(analysisResult)
      setSubFileDialogOpen(false)
      setNewSubFileName('')
      setNewSubFileContent('')
    } catch (error) {
      console.error('[ProjectContextView] Failed to create sub-file:', error)
      alert('Failed to create sub-file')
    }
  }, [selectedProjectId, newSubFileName, newSubFileContent])

  // Handle edit sub-file
  const handleEditSubFile = useCallback(async (file: ClaudeMdSubFile) => {
    if (!selectedProjectId) return

    try {
      const content = await window.api.readClaudeMdSubFile(selectedProjectId, file.name)
      setSubFileContent(content)
      setEditingSubFile(file)
    } catch (error) {
      console.error('[ProjectContextView] Failed to read sub-file:', error)
      alert('Failed to read sub-file')
    }
  }, [selectedProjectId])

  // Handle save sub-file
  const handleSaveSubFile = useCallback(async () => {
    if (!selectedProjectId || !editingSubFile) return

    try {
      await window.api.updateClaudeMdSubFile(
        selectedProjectId,
        editingSubFile.name,
        subFileContent
      )

      // Reload sub-files
      const files = await window.api.getClaudeMdSubFiles(selectedProjectId)
      setSubFiles(files)
      setEditingSubFile(null)
      setSubFileContent('')
    } catch (error) {
      console.error('[ProjectContextView] Failed to save sub-file:', error)
      alert('Failed to save sub-file')
    }
  }, [selectedProjectId, editingSubFile, subFileContent])

  // Handle delete sub-file
  const handleDeleteSubFile = useCallback(async (file: ClaudeMdSubFile) => {
    if (!selectedProjectId) return
    if (!confirm(`Delete ${file.name}?`)) return

    try {
      await window.api.deleteClaudeMdSubFile(selectedProjectId, file.name)

      // Reload sub-files and analysis
      const [files, analysisResult] = await Promise.all([
        window.api.getClaudeMdSubFiles(selectedProjectId),
        window.api.analyzeClaudeMd(selectedProjectId)
      ])
      setSubFiles(files)
      setAnalysis(analysisResult)
    } catch (error) {
      console.error('[ProjectContextView] Failed to delete sub-file:', error)
      alert('Failed to delete sub-file')
    }
  }, [selectedProjectId])

  // Handle open file externally
  const handleOpenExternal = useCallback(async (filePath: string) => {
    try {
      await window.api.openExternal(filePath)
    } catch (error) {
      console.error('[ProjectContextView] Failed to open file:', error)
    }
  }, [])

  // Handle starting AI assistant with specific request
  const handleStartAIAssistant = useCallback((sectionName: string, description: string) => {
    setInitialPrompt(`I want to add a ${sectionName} section to my CLAUDE.md file. ${description}`)
    setActiveTab('ai-assistant')
  }, [])

  // Handle setting project path
  const handleSetPath = useCallback(async () => {
    if (!selectedProjectId) return

    try {
      const path = await window.api.selectDirectory()
      if (path) {
        await window.api.setProjectPath(selectedProjectId, path)
        setShowPathDialog(false)
        setPathError(null)

        // Retry loading analysis
        const result = await window.api.analyzeClaudeMd(selectedProjectId)
        setAnalysis(result)
        setClaudeMdContent(result.content || '')
        setIsDirty(false)

        const files = await window.api.getClaudeMdSubFiles(selectedProjectId)
        setSubFiles(files)
      }
    } catch (error) {
      console.error('[ProjectContextView] Failed to set path:', error)
      alert('Failed to set project path')
    }
  }, [selectedProjectId])

  if (loading && !analysis) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading project context...</p>
        </div>
      </div>
    )
  }

  if (!selectedProjectId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">No Project Selected</h3>
            <p className="text-sm text-muted-foreground">
              Select a project to view and manage its CLAUDE.md configuration.
            </p>
          </div>
          {projects.length > 0 && (
            <Select onValueChange={handleProjectSelect}>
              <SelectTrigger className="max-w-xs mx-auto">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Project Context</h1>
            <p className="text-sm text-muted-foreground">
              Manage CLAUDE.md and AI guidelines
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedProjectId} onValueChange={handleProjectSelect}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4 flex flex-col">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl shrink-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="edit">Edit CLAUDE.md</TabsTrigger>
            <TabsTrigger value="subfiles">Sub-files</TabsTrigger>
            <TabsTrigger value="ai-assistant">AI Assistant</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4 overflow-y-auto flex-1">
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
                    {/* Status Grid */}
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
                            onClick={() => setActiveTab('edit')}
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
                            onClick={() => setActiveTab('edit')}
                          >
                            Create
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* What's Missing / Next Steps Card */}
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
                              onClick={() => handleStartAIAssistant('Quick Start', 'Please help me create a Quick Start section with setup commands and getting started instructions for developers who are new to this project.')}
                            >
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
                              onClick={() => handleStartAIAssistant('Architecture Overview', 'Please help me create an Architecture Overview section that explains the system design and component structure of this project.')}
                            >
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
                              onClick={() => handleStartAIAssistant('Code Conventions', 'Please help me create a Code Conventions section that documents the coding standards and best practices for this project.')}
                            >
                              Add
                            </Button>
                          </div>
                        )}

                        {/* Nice-to-have Sections */}
                        {!analysis.hasTechStack && analysis.qualityScore >= 60 && (
                          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
                            <CheckCircle2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-muted-foreground">Tech Stack (optional)</p>
                              <p className="text-sm text-muted-foreground">
                                List technologies and key dependencies
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStartAIAssistant('Tech Stack', 'Please help me create a Tech Stack section that lists the key technologies and dependencies used in this project.')}
                            >
                              Add
                            </Button>
                          </div>
                        )}

                        {!analysis.hasTestingGuidelines && analysis.qualityScore >= 60 && (
                          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
                            <CheckCircle2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-muted-foreground">Testing Guidelines (optional)</p>
                              <p className="text-sm text-muted-foreground">
                                Add testing best practices and requirements
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStartAIAssistant('Testing Guidelines', 'Please help me create a Testing Guidelines section that documents the testing best practices and requirements for this project.')}
                            >
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
                        onClick={() => setActiveTab('edit')}
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
                        onClick={() => setActiveTab('ai-assistant')}
                        disabled={!analysis.exists}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="font-medium">AI Assistant</span>
                        </div>
                        <p className="text-xs text-muted-foreground text-left">
                          Get AI help improving your docs
                        </p>
                      </Button>

                      <Button
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-start gap-2"
                        onClick={() => setActiveTab('subfiles')}
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
          <TabsContent value="edit" className="space-y-4 mt-4 overflow-y-auto flex-1">
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
          <TabsContent value="subfiles" className="space-y-4 mt-4 overflow-y-auto flex-1">
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

          {/* AI Assistant Tab */}
          <TabsContent value="ai-assistant" className="flex-1 mt-4 overflow-hidden flex flex-col">
            {analysis?.path && selectedProjectId ? (
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardContent className="flex-1 p-0 overflow-hidden">
                  <ClaudeMdChatPanel
                    projectId={selectedProjectId}
                    claudeMdPath={analysis.path}
                    claudeMdContent={claudeMdContent}
                    initialPrompt={initialPrompt}
                    onApplySuggestion={(content) => {
                      setClaudeMdContent(content)
                      setIsDirty(true)
                      setActiveTab('edit')
                    }}
                    onPromptUsed={() => setInitialPrompt(undefined)}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>CLAUDE.md file not found. Create one in the Edit tab first.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

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

      {/* Set Path Dialog */}
      <Dialog open={showPathDialog} onOpenChange={setShowPathDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project Path Not Configured</DialogTitle>
            <DialogDescription>
              {pathError}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The local filesystem path for this project is not set. Please select the directory where this project is located on your machine.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPathDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetPath}>
              Select Directory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
