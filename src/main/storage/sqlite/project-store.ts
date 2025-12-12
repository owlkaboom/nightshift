/**
 * SQLite Project Store
 *
 * High-performance project storage using SQLite.
 * Maintains same API as the file-based project store for compatibility.
 */

import type { Project } from '@shared/types'
import { createProject, generateProjectId } from '@shared/types'
import { getDatabase } from '../database'
import {
  setProjectPath,
  removeProjectPath,
  removeProjectEcosystemInfo
} from './local-state-store'

// ============ Type Conversions ============

interface ProjectRow {
  id: string
  name: string
  description: string | null
  git_url: string | null
  default_branch: string | null
  default_skills: string
  include_claude_md: number
  tag_ids: string
  integration_ids: string
  added_at: string
  icon: string | null
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    gitUrl: row.git_url,
    defaultBranch: row.default_branch,
    defaultSkills: JSON.parse(row.default_skills),
    includeClaudeMd: row.include_claude_md === 1,
    tagIds: JSON.parse(row.tag_ids),
    integrationIds: JSON.parse(row.integration_ids),
    addedAt: row.added_at,
    icon: row.icon
  }
}

function projectToParams(project: Project): Record<string, unknown> {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    git_url: project.gitUrl,
    default_branch: project.defaultBranch,
    default_skills: JSON.stringify(project.defaultSkills),
    include_claude_md: project.includeClaudeMd ? 1 : 0,
    tag_ids: JSON.stringify(project.tagIds),
    integration_ids: JSON.stringify(project.integrationIds),
    added_at: project.addedAt,
    icon: project.icon
  }
}

// ============ Core CRUD Operations ============

/**
 * Load all projects
 */
export async function loadProjects(): Promise<Project[]> {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM projects').all() as ProjectRow[]
  return rows.map(rowToProject)
}

/**
 * Get a project by ID
 */
export async function getProject(projectId: string): Promise<Project | null> {
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM projects WHERE id = ?')
    .get(projectId) as ProjectRow | undefined

  return row ? rowToProject(row) : null
}

/**
 * Get a project by git URL
 */
export async function getProjectByGitUrl(
  gitUrl: string
): Promise<Project | null> {
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM projects WHERE git_url = ?')
    .get(gitUrl) as ProjectRow | undefined

  return row ? rowToProject(row) : null
}

/**
 * Add a new project
 */
export async function addProject(
  name: string,
  localPath: string,
  gitUrl: string | null = null,
  defaultBranch: string | null = null,
  options: Partial<Project> = {}
): Promise<Project> {
  const db = getDatabase()

  // Check for duplicate git URL
  if (gitUrl) {
    const existing = await getProjectByGitUrl(gitUrl)
    if (existing) {
      throw new Error(`Project with git URL "${gitUrl}" already exists`)
    }
  }

  const id = generateProjectId()
  const project = createProject(id, name, gitUrl, defaultBranch, options)
  const params = projectToParams(project)

  db.prepare(`
    INSERT INTO projects (
      id, name, description, git_url, default_branch, default_skills,
      include_claude_md, tag_ids, integration_ids, added_at, icon
    ) VALUES (
      @id, @name, @description, @git_url, @default_branch, @default_skills,
      @include_claude_md, @tag_ids, @integration_ids, @added_at, @icon
    )
  `).run(params)

  // Store local path in local state
  await setProjectPath(id, localPath)

  return project
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Omit<Project, 'id' | 'addedAt'>>
): Promise<Project | null> {
  const db = getDatabase()

  const existing = await getProject(projectId)
  if (!existing) {
    return null
  }

  const updated = { ...existing, ...updates }
  const params = projectToParams(updated)

  db.prepare(`
    UPDATE projects SET
      name = @name,
      description = @description,
      git_url = @git_url,
      default_branch = @default_branch,
      default_skills = @default_skills,
      include_claude_md = @include_claude_md,
      tag_ids = @tag_ids,
      integration_ids = @integration_ids,
      icon = @icon
    WHERE id = @id
  `).run(params)

  return updated
}

/**
 * Remove a project
 */
export async function removeProject(projectId: string): Promise<boolean> {
  const db = getDatabase()

  const result = db
    .prepare('DELETE FROM projects WHERE id = ?')
    .run(projectId)

  if (result.changes > 0) {
    // Clean up local state
    await removeProjectPath(projectId)
    await removeProjectEcosystemInfo(projectId)
    return true
  }

  return false
}

/**
 * Check if a git URL is already registered
 */
export async function isGitUrlRegistered(
  gitUrl: string | null
): Promise<boolean> {
  if (!gitUrl) return false
  const project = await getProjectByGitUrl(gitUrl)
  return project !== null
}

/**
 * Get all projects in a group
 */
export async function getProjectsByGroup(groupId: string): Promise<Project[]> {
  const db = getDatabase()
  const rows = db
    .prepare(`
      SELECT p.* FROM projects p
      JOIN group_projects gp ON p.id = gp.project_id
      WHERE gp.group_id = ?
    `)
    .all(groupId) as ProjectRow[]

  return rows.map(rowToProject)
}
