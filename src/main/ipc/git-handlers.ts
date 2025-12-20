/**
 * IPC handlers for git operations
 */

import { ipcMain } from 'electron'
import type { GitRepoInfo } from '@main/git'
import { getRepoInfo, extractRepoName, normalizeGitUrl, getCurrentBranch } from '@main/git'
import { getProjectPath } from '@main/storage'

export function registerGitHandlers(): void {
  // Get repository info for a path
  ipcMain.handle('git:getRepoInfo', async (_, path: string): Promise<GitRepoInfo> => {
    return getRepoInfo(path)
  })

  // Extract repo name from git URL
  ipcMain.handle('git:extractRepoName', async (_, gitUrl: string): Promise<string> => {
    return extractRepoName(gitUrl)
  })

  // Normalize git URL
  ipcMain.handle('git:normalizeUrl', async (_, gitUrl: string): Promise<string> => {
    return normalizeGitUrl(gitUrl)
  })

  // Get current branch for a project
  ipcMain.handle('git:getCurrentBranch', async (_, projectId: string): Promise<string | null> => {
    const projectPath = await getProjectPath(projectId)
    if (!projectPath) return null
    return getCurrentBranch(projectPath)
  })
}
