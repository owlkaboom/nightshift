/**
 * Project store for ~/.nightshift/sync/projects.json
 */

import type { Project, ProjectsRegistry } from '@shared/types'
import { createProject, generateProjectId } from '@shared/types'
import { getProjectsPath } from '@main/utils/paths'
import { readJsonWithDefault, writeJson } from './file-store'
import {
  setProjectPath,
  removeProjectPath,
  removeProjectEcosystemInfo
} from './local-state-store'

const DEFAULT_REGISTRY: ProjectsRegistry = { projects: [] }

/**
 * Load all projects
 */
export async function loadProjects(): Promise<Project[]> {
  const path = getProjectsPath()
  const registry = await readJsonWithDefault(path, DEFAULT_REGISTRY)
  return registry.projects
}

/**
 * Save all projects
 */
async function saveProjects(projects: Project[]): Promise<void> {
  const path = getProjectsPath()
  await writeJson(path, { projects })
}

/**
 * Get a project by ID
 */
export async function getProject(projectId: string): Promise<Project | null> {
  const projects = await loadProjects()
  return projects.find((p) => p.id === projectId) ?? null
}

/**
 * Get a project by git URL
 */
export async function getProjectByGitUrl(
  gitUrl: string
): Promise<Project | null> {
  const projects = await loadProjects()
  return projects.find((p) => p.gitUrl && p.gitUrl === gitUrl) ?? null
}

/**
 * Add a new project
 * @param path - The local filesystem path
 * @param gitUrl - Optional git URL (null for non-git directories)
 * @param defaultBranch - Optional default branch (null for non-git directories)
 */
export async function addProject(
  name: string,
  path: string,
  gitUrl: string | null = null,
  defaultBranch: string | null = null,
  options: Partial<Project> = {}
): Promise<Project> {
  const projects = await loadProjects()

  // Check for duplicate git URL (only if gitUrl is provided)
  if (gitUrl) {
    const existing = projects.find((p) => p.gitUrl && p.gitUrl === gitUrl)
    if (existing) {
      throw new Error(`Project with git URL "${gitUrl}" already exists`)
    }
  }

  // Create project
  const id = generateProjectId()
  const project = createProject(id, name, gitUrl, defaultBranch, { ...options, path })

  // Save project and local path
  projects.push(project)
  await saveProjects(projects)
  await setProjectPath(id, path)

  return project
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Omit<Project, 'id' | 'addedAt'>>
): Promise<Project | null> {
  const projects = await loadProjects()
  const index = projects.findIndex((p) => p.id === projectId)

  if (index === -1) {
    return null
  }

  const updated = { ...projects[index], ...updates }
  projects[index] = updated
  await saveProjects(projects)

  return updated
}

/**
 * Remove a project
 */
export async function removeProject(projectId: string): Promise<boolean> {
  const projects = await loadProjects()
  const index = projects.findIndex((p) => p.id === projectId)

  if (index === -1) {
    return false
  }

  // Remove from projects
  projects.splice(index, 1)
  await saveProjects(projects)

  // Clean up local state
  await removeProjectPath(projectId)
  await removeProjectEcosystemInfo(projectId)

  return true
}

/**
 * Check if a git URL is already registered
 * Returns false if gitUrl is null/empty
 */
export async function isGitUrlRegistered(gitUrl: string | null): Promise<boolean> {
  if (!gitUrl) return false
  const project = await getProjectByGitUrl(gitUrl)
  return project !== null
}

/**
 * Get all projects in a group
 */
export async function getProjectsByGroup(_groupId: string): Promise<Project[]> {
  const projects = await loadProjects()
  // Note: Group membership is stored in groups.json, not here
  // This would need to cross-reference with the group store
  // For now, return all projects - will be implemented when we have the full context
  return projects
}
