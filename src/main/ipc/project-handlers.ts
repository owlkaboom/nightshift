/**
 * IPC handlers for project operations
 */

import { ipcMain } from 'electron'
import type { AddProjectData, ScannedRepo } from '@shared/ipc-types'
import type { Project } from '@shared/types'
import {
  loadProjects,
  getProject,
  addProject,
  updateProject,
  removeProject
} from '@main/storage'
import { generateProjectDescription } from '@main/agents/description-generator'
import { scanForRepos } from '@main/git/repo-scanner'
import { getRepoInfo } from '@main/git'

export function registerProjectHandlers(): void {
  // List all projects
  ipcMain.handle('project:list', async (): Promise<Project[]> => {
    return loadProjects()
  })

  // Get a single project
  ipcMain.handle('project:get', async (_, id: string): Promise<Project | null> => {
    return getProject(id)
  })

  // Add a new project
  ipcMain.handle(
    'project:add',
    async (_, data: AddProjectData): Promise<Project> => {
      const project = await addProject(
        data.name,
        data.path,
        data.gitUrl || null,
        data.defaultBranch || null,
        {
          includeClaudeMd: data.includeClaudeMd
        }
      )

      return project
    }
  )

  // Update a project
  ipcMain.handle(
    'project:update',
    async (_, id: string, updates: Partial<Project>): Promise<Project | null> => {
      return updateProject(id, updates)
    }
  )

  // Remove a project
  ipcMain.handle('project:remove', async (_, id: string): Promise<boolean> => {
    return removeProject(id)
  })

  // Set path for a project
  ipcMain.handle(
    'project:setPath',
    async (_, id: string, path: string): Promise<void> => {
      await updateProject(id, { path })
    }
  )

  // Get path for a project
  ipcMain.handle(
    'project:getPath',
    async (_, id: string): Promise<string | null> => {
      const project = await getProject(id)
      return project?.path ?? null
    }
  )

  // Generate description for a project using AI
  ipcMain.handle(
    'project:generateDescription',
    async (_, id: string): Promise<string> => {
      const project = await getProject(id)
      if (!project) {
        throw new Error(`Project not found: ${id}`)
      }

      return generateProjectDescription(project)
    }
  )

  // Scan directory for git repositories
  ipcMain.handle(
    'project:scanDirectory',
    async (_, rootPath: string): Promise<ScannedRepo[]> => {
      // Load existing projects to check for duplicates
      const projects = await loadProjects()

      // Get paths for existing projects
      const projectsWithPaths = projects.map((project) => ({
        id: project.id,
        gitUrl: project.gitUrl,
        path: project.path || undefined
      }))

      // Scan for repos
      const repos = await scanForRepos(rootPath, projectsWithPaths, {
        maxDepth: 3
      })

      return repos
    }
  )

  // Check if a project can be converted to a Git project
  ipcMain.handle(
    'project:checkGitConversion',
    async (_, id: string): Promise<{ canConvert: boolean; gitUrl: string | null; defaultBranch: string | null; error?: string }> => {
      try {
        const project = await getProject(id)
        if (!project) {
          return { canConvert: false, gitUrl: null, defaultBranch: null, error: 'Project not found' }
        }

        // Already a git project
        if (project.gitUrl) {
          return { canConvert: false, gitUrl: null, defaultBranch: null, error: 'Project is already a Git project' }
        }

        if (!project.path) {
          return { canConvert: false, gitUrl: null, defaultBranch: null, error: 'Project has no path' }
        }

        const projectPath = project.path

        // Check if the directory is a git repo with a remote
        const repoInfo = await getRepoInfo(projectPath)

        if (!repoInfo.isRepo) {
          return { canConvert: false, gitUrl: null, defaultBranch: null, error: 'Directory is not a Git repository' }
        }

        if (!repoInfo.hasRemote) {
          return { canConvert: false, gitUrl: null, defaultBranch: null, error: 'Git repository has no remote configured' }
        }

        return {
          canConvert: true,
          gitUrl: repoInfo.remoteUrl,
          defaultBranch: repoInfo.defaultBranch
        }
      } catch (error) {
        return {
          canConvert: false,
          gitUrl: null,
          defaultBranch: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  )

  // Convert a local path project to a Git project
  ipcMain.handle(
    'project:convertToGit',
    async (_, id: string): Promise<Project | null> => {
      const project = await getProject(id)
      if (!project) {
        throw new Error('Project not found')
      }

      if (project.gitUrl) {
        throw new Error('Project is already a Git project')
      }

      if (!project.path) {
        throw new Error('Project has no path')
      }

      const projectPath = project.path

      // Get git info
      const repoInfo = await getRepoInfo(projectPath)

      if (!repoInfo.isRepo || !repoInfo.hasRemote) {
        throw new Error('Directory is not a Git repository with a remote')
      }

      // Update the project with git information
      const updated = await updateProject(id, {
        gitUrl: repoInfo.remoteUrl,
        defaultBranch: repoInfo.defaultBranch
      })

      return updated
    }
  )
}
