import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useProjectStore } from '@/stores'
import { useTagStore } from '@/stores/tag-store'
import { ProjectCard, AddProjectDialog, EditProjectDialog, ScanProjectsDialog } from '@/components/projects'
import { ProjectAnalysisDialog } from '@/components/analysis'
import { Button } from '@/components/ui/button'
import { useKeyboardShortcuts, formatKbd, type KeyboardShortcut } from '@/hooks'
import type { Project } from '@shared/types'
import { Plus, FolderGit2, Loader2, Scan } from 'lucide-react'

export function ProjectsView() {
  const navigate = useNavigate()
  const { projects, loading, error, fetchProjects, addProject, updateProject, removeProject } = useProjectStore()
  const { loadTags, getTagsByIds } = useTagStore()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [scanDialogOpen, setScanDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [analyzingProject, setAnalyzingProject] = useState<Project | null>(null)
  const [projectPaths, setProjectPaths] = useState<Record<string, string>>({})
  const [projectBranches, setProjectBranches] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchProjects()
    loadTags()
  }, [fetchProjects, loadTags])

  // Fetch local paths and current branches for all projects
  useEffect(() => {
    async function fetchPathsAndBranches() {
      const paths: Record<string, string> = {}
      const branches: Record<string, string> = {}
      for (const project of projects) {
        const path = await window.api.getProjectPath(project.id)
        if (path) {
          paths[project.id] = path
        }
        const branch = await window.api.getCurrentBranch(project.id)
        if (branch) {
          branches[project.id] = branch
        }
      }
      setProjectPaths(paths)
      setProjectBranches(branches)
    }
    if (projects.length > 0) {
      fetchPathsAndBranches()
    }
  }, [projects])

  const handleAddProject = async (data: {
    name: string
    path: string
    gitUrl?: string | null
    defaultBranch?: string | null
  }) => {
    await addProject({
      name: data.name,
      path: data.path,
      gitUrl: data.gitUrl,
      defaultBranch: data.defaultBranch
    })
  }

  const handleRemoveProject = async (id: string) => {
    if (confirm('Are you sure you want to remove this project?')) {
      await removeProject(id)
    }
  }

  const handleEditProject = (project: Project) => {
    setEditingProject(project)
  }

  const handleAnalyzeProject = (project: Project) => {
    setAnalyzingProject(project)
  }

  const handleConvertToGit = async (project: Project) => {
    try {
      const updated = await window.api.convertToGit(project.id)
      if (updated) {
        // Refresh projects to show the updated data
        await fetchProjects()
      }
    } catch (error) {
      console.error('[ProjectsView] Failed to convert project to Git:', error)
      alert(`Failed to convert project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleSaveProject = async (id: string, updates: Partial<Project>) => {
    await updateProject(id, updates)
    setEditingProject(null)
  }

  const handleOpenFolder = async (path: string) => {
    await window.api.openPath(path)
  }

  const handleViewDetails = useCallback((project: Project) => {
    navigate({ to: '/projects/$projectId', params: { projectId: project.id } })
  }, [navigate])

  // Handle opening add dialog
  const handleOpenAddDialog = useCallback(() => {
    setAddDialogOpen(true)
  }, [])

  // Handle opening scan dialog
  const handleOpenScanDialog = useCallback(() => {
    setScanDialogOpen(true)
  }, [])

  // Handle projects added from scan
  const handleProjectsAdded = useCallback(() => {
    fetchProjects()
  }, [fetchProjects])

  // Keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = useMemo(
    () => [
      { key: 'n', meta: true, handler: handleOpenAddDialog, description: 'Add project' }
    ],
    [handleOpenAddDialog]
  )

  useKeyboardShortcuts(shortcuts)

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-full p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Projects</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your projects and directories for task orchestration
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={handleOpenScanDialog} variant="outline" className="flex-1 sm:flex-initial">
            <Scan className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Scan Directory</span>
            <span className="sm:hidden">Scan</span>
          </Button>
          <Button onClick={handleOpenAddDialog} title={`Add project (${formatKbd('⌘N')})`} className="flex-1 sm:flex-initial">
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Add Project</span>
            <span className="sm:hidden">Add</span>
            <kbd className="hidden lg:inline ml-2 text-xs opacity-60">{formatKbd('⌘N')}</kbd>
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-4">
          <div className="rounded-full bg-muted p-4 sm:p-6 mb-4">
            <FolderGit2 className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground" />
          </div>
          <h2 className="text-base sm:text-lg font-semibold mb-2">No projects yet</h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 max-w-sm">
            Add a project or directory to start creating and managing AI-assisted coding tasks.
          </p>
          <Button onClick={handleOpenAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              path={projectPaths[project.id]}
              currentBranch={projectBranches[project.id]}
              tags={getTagsByIds(project.tagIds)}
              onRemove={handleRemoveProject}
              onEdit={handleEditProject}
              onOpenFolder={handleOpenFolder}
              onViewDetails={handleViewDetails}
              onAnalyze={handleAnalyzeProject}
              onConvertToGit={handleConvertToGit}
            />
          ))}
        </div>
      )}

      <AddProjectDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddProject}
      />

      <ScanProjectsDialog
        open={scanDialogOpen}
        onOpenChange={setScanDialogOpen}
        onProjectsAdded={handleProjectsAdded}
      />

      <EditProjectDialog
        open={!!editingProject}
        onOpenChange={(open) => !open && setEditingProject(null)}
        project={editingProject}
        onSave={handleSaveProject}
      />

      {analyzingProject && projectPaths[analyzingProject.id] && (
        <ProjectAnalysisDialog
          project={analyzingProject}
          projectPath={projectPaths[analyzingProject.id]}
          open={!!analyzingProject}
          onOpenChange={(open) => !open && setAnalyzingProject(null)}
        />
      )}
    </div>
  )
}
