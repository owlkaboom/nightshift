/**
 * Path resolution utilities for Nightshift
 * Handles all paths related to ~/.nightshift/ directory
 */

import { join } from 'path'
import { homedir } from 'os'
import { APP_DIR_NAME, FILES, DIRS } from '@shared/constants'

/**
 * Get the app data directory (~/.nightshift/)
 * Uses app.getPath in production, homedir fallback in development
 */
export function getAppDataDir(): string {
  // In development, app might not be ready
  try {
    // Prefer user's home directory for consistency
    return join(homedir(), APP_DIR_NAME)
  } catch {
    return join(homedir(), APP_DIR_NAME)
  }
}

/**
 * Get the config file path (~/.nightshift/config.json)
 */
export function getConfigPath(): string {
  return join(getAppDataDir(), FILES.CONFIG)
}

/**
 * Get the local state file path (~/.nightshift/local-state.json)
 */
export function getLocalStatePath(): string {
  return join(getAppDataDir(), FILES.LOCAL_STATE)
}

/**
 * Get the sync directory path (~/.nightshift/sync/)
 */
export function getSyncDir(): string {
  return join(getAppDataDir(), DIRS.SYNC)
}

/**
 * Get the projects registry path (~/.nightshift/sync/projects.json)
 */
export function getProjectsPath(): string {
  return join(getAppDataDir(), FILES.PROJECTS)
}

/**
 * Get the groups registry path (~/.nightshift/sync/groups.json)
 */
export function getGroupsPath(): string {
  return join(getAppDataDir(), FILES.GROUPS)
}

/**
 * Get the templates registry path (~/.nightshift/sync/templates.json)
 */
export function getTemplatesPath(): string {
  return join(getAppDataDir(), FILES.TEMPLATES)
}

/**
 * Get the skills registry path (~/.nightshift/sync/skills.json)
 */
export function getSkillsPath(): string {
  return join(getAppDataDir(), FILES.SKILLS)
}

/**
 * Get the tasks directory (~/.nightshift/tasks/)
 */
export function getTasksDir(): string {
  return join(getAppDataDir(), DIRS.TASKS)
}

/**
 * Get a project's tasks directory (~/.nightshift/tasks/<project-id>/)
 */
export function getProjectTasksDir(projectId: string): string {
  return join(getTasksDir(), projectId)
}

/**
 * Get a task's directory (~/.nightshift/tasks/<project-id>/<task-id>/)
 */
export function getTaskDir(projectId: string, taskId: string): string {
  return join(getProjectTasksDir(projectId), taskId)
}

/**
 * Get a task's manifest path
 */
export function getTaskManifestPath(projectId: string, taskId: string): string {
  return join(getTaskDir(projectId, taskId), 'manifest.json')
}

/**
 * Get a task's execution log path (legacy, used for backward compat with iteration 1)
 */
export function getTaskLogPath(projectId: string, taskId: string): string {
  return join(getTaskDir(projectId, taskId), 'execution.log')
}

/**
 * Get a task's runs directory for iteration logs
 */
export function getTaskRunsDir(projectId: string, taskId: string): string {
  return join(getTaskDir(projectId, taskId), 'runs')
}

/**
 * Get the log path for a specific iteration
 */
export function getIterationLogPath(
  projectId: string,
  taskId: string,
  iteration: number
): string {
  return join(getTaskRunsDir(projectId, taskId), `run-${iteration}.log`)
}

/**
 * Get the sessions directory (~/.nightshift/sessions/)
 */
export function getSessionsDir(): string {
  return join(getAppDataDir(), DIRS.SESSIONS)
}

/**
 * Get a session file path (~/.nightshift/sessions/<session-id>.json)
 */
export function getSessionPath(sessionId: string): string {
  return join(getSessionsDir(), `${sessionId}.json`)
}

/**
 * Get the memory directory (~/.nightshift/memory/)
 */
export function getMemoryDir(): string {
  return join(getAppDataDir(), DIRS.MEMORY)
}

/**
 * Get a project's memory directory (~/.nightshift/memory/<project-id>/)
 */
export function getProjectMemoryDir(projectId: string): string {
  return join(getMemoryDir(), projectId)
}

/**
 * Get a project's memory file path (~/.nightshift/memory/<project-id>/memory.json)
 */
export function getProjectMemoryPath(projectId: string): string {
  return join(getProjectMemoryDir(projectId), 'memory.json')
}

/**
 * Get the planning sessions directory (~/.nightshift/planning/)
 */
export function getPlanningDir(): string {
  return join(getAppDataDir(), DIRS.PLANNING)
}

/**
 * Get a planning session's directory (~/.nightshift/planning/<session-id>/)
 */
export function getPlanningSessionDir(sessionId: string): string {
  return join(getPlanningDir(), sessionId)
}

/**
 * Get a planning session's file path (~/.nightshift/planning/<session-id>/session.json)
 */
export function getPlanningSessionPath(sessionId: string): string {
  return join(getPlanningSessionDir(sessionId), 'session.json')
}

/**
 * Get the documentation sessions directory (~/.nightshift/docs/)
 */
export function getDocsDir(): string {
  return join(getAppDataDir(), DIRS.DOCS)
}

/**
 * Get the logs directory (~/.nightshift/logs/)
 */
export function getLogsDir(): string {
  return join(getAppDataDir(), DIRS.LOGS)
}

/**
 * Get the sounds directory (~/.nightshift/sounds/)
 */
export function getSoundsDir(): string {
  return join(getAppDataDir(), DIRS.SOUNDS)
}

/**
 * Get a documentation session's directory (~/.nightshift/docs/<session-id>/)
 */
export function getDocSessionDir(sessionId: string): string {
  return join(getDocsDir(), sessionId)
}

/**
 * Get a documentation session's file path (~/.nightshift/docs/<session-id>/session.json)
 */
export function getDocSessionPath(sessionId: string): string {
  return join(getDocSessionDir(sessionId), 'session.json')
}

/**
 * Get all directories that need to be created on first run
 */
export function getRequiredDirs(): string[] {
  return [
    getAppDataDir(),
    getSyncDir(),
    getTasksDir(),
    getSessionsDir(),
    getMemoryDir(),
    getPlanningDir(),
    getDocsDir(),
    getLogsDir(),
    getSoundsDir()
  ]
}

/**
 * Expand ~ in paths to the user's home directory
 */
export function expandPath(path: string): string {
  if (path.startsWith('~')) {
    return join(homedir(), path.slice(1))
  }
  return path
}

/**
 * Quote an executable path for safe shell execution
 * Wraps paths containing spaces in double quotes and escapes internal quotes
 * This is necessary when using spawn() with shell: true
 *
 * @param execPath - The path to the executable
 * @returns Quoted path if it contains spaces, otherwise the original path
 */
export function quoteExecutablePath(execPath: string): string {
  // If path contains spaces, wrap in double quotes
  // Also escape any internal double quotes to prevent shell injection
  if (execPath.includes(' ')) {
    const escapedPath = execPath.replace(/"/g, '\\"')
    return `"${escapedPath}"`
  }
  return execPath
}
