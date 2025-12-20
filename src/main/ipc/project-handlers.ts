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
  removeProject,
  getProjectPath,
  setProjectPath
} from '@main/storage'
import { generateProjectDescription } from '@main/agents/description-generator'
import { scanForRepos } from '@main/git/repo-scanner'

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
        data.localPath,
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

  // Set local path for a project
  ipcMain.handle(
    'project:setPath',
    async (_, id: string, localPath: string): Promise<void> => {
      await setProjectPath(id, localPath)
    }
  )

  // Get local path for a project
  ipcMain.handle(
    'project:getPath',
    async (_, id: string): Promise<string | null> => {
      return getProjectPath(id)
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

      // Get local paths for existing projects
      const projectsWithPaths = await Promise.all(
        projects.map(async (project) => {
          const localPath = await getProjectPath(project.id)
          return {
            id: project.id,
            gitUrl: project.gitUrl,
            localPath: localPath || undefined
          }
        })
      )

      // Scan for repos
      const repos = await scanForRepos(rootPath, projectsWithPaths, {
        maxDepth: 3
      })

      return repos
    }
  )
}
