/**
 * IPC handlers for git operations
 */

import { ipcMain } from 'electron'
import type { GitRepoInfo } from '@main/git'
import {
  getRepoInfo,
  extractRepoName,
  normalizeGitUrl,
  getCurrentBranch,
  // New git operations
  listBranches,
  createBranch,
  checkoutBranch,
  deleteBranch,
  getStatus,
  stageFiles,
  unstageFiles,
  stageAll,
  unstageAll,
  discardChanges,
  discardAllChanges,
  getDiff,
  getFileDiff,
  commit,
  getRecentCommits,
  getRemoteStatus,
  fetch,
  pull,
  push,
  stashList,
  stashSave,
  stashApply,
  stashPop,
  stashDrop,
  generateCommitMessage
} from '@main/git'
import { getProjectPath } from '@main/storage'
import type {
  BranchInfo,
  FileStatus,
  FileDiff,
  CommitInfo,
  CommitResult,
  RemoteStatus,
  FetchResult,
  PullResult,
  PushResult,
  PushOptions,
  StashEntry,
  StashSaveOptions,
  StashSaveResult
} from '@shared/types'

/**
 * Helper to get project path or throw
 */
async function requireProjectPath(projectId: string): Promise<string> {
  const projectPath = await getProjectPath(projectId)
  if (!projectPath) {
    throw new Error(`Project ${projectId} has no local path configured`)
  }
  return projectPath
}

export function registerGitHandlers(): void {
  // ============ Existing Handlers ============

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

  // ============ Branch Operations ============

  // List all branches
  ipcMain.handle(
    'git:listBranches',
    async (_, projectId: string): Promise<BranchInfo[]> => {
      const projectPath = await requireProjectPath(projectId)
      return listBranches(projectPath)
    }
  )

  // Create a new branch
  ipcMain.handle(
    'git:createBranch',
    async (_, projectId: string, name: string, startPoint?: string): Promise<void> => {
      const projectPath = await requireProjectPath(projectId)
      await createBranch(projectPath, name, startPoint)
    }
  )

  // Checkout a branch
  ipcMain.handle(
    'git:checkoutBranch',
    async (_, projectId: string, name: string): Promise<void> => {
      const projectPath = await requireProjectPath(projectId)
      await checkoutBranch(projectPath, name)
    }
  )

  // Delete a branch
  ipcMain.handle(
    'git:deleteBranch',
    async (_, projectId: string, name: string, force?: boolean): Promise<void> => {
      const projectPath = await requireProjectPath(projectId)
      await deleteBranch(projectPath, name, force)
    }
  )

  // ============ Status & Staging ============

  // Get status of all files
  ipcMain.handle(
    'git:getStatus',
    async (_, projectId: string): Promise<FileStatus[]> => {
      const projectPath = await requireProjectPath(projectId)
      return getStatus(projectPath)
    }
  )

  // Stage specific files
  ipcMain.handle(
    'git:stageFiles',
    async (_, projectId: string, files: string[]): Promise<void> => {
      const projectPath = await requireProjectPath(projectId)
      await stageFiles(projectPath, files)
    }
  )

  // Unstage specific files
  ipcMain.handle(
    'git:unstageFiles',
    async (_, projectId: string, files: string[]): Promise<void> => {
      const projectPath = await requireProjectPath(projectId)
      await unstageFiles(projectPath, files)
    }
  )

  // Stage all changes
  ipcMain.handle(
    'git:stageAll',
    async (_, projectId: string): Promise<void> => {
      const projectPath = await requireProjectPath(projectId)
      await stageAll(projectPath)
    }
  )

  // Unstage all files
  ipcMain.handle(
    'git:unstageAll',
    async (_, projectId: string): Promise<void> => {
      const projectPath = await requireProjectPath(projectId)
      await unstageAll(projectPath)
    }
  )

  // Discard changes to a file
  ipcMain.handle(
    'git:discardChanges',
    async (_, projectId: string, file: string): Promise<void> => {
      const projectPath = await requireProjectPath(projectId)
      await discardChanges(projectPath, file)
    }
  )

  // Discard all changes
  ipcMain.handle(
    'git:discardAllChanges',
    async (_, projectId: string): Promise<void> => {
      const projectPath = await requireProjectPath(projectId)
      await discardAllChanges(projectPath)
    }
  )

  // ============ Diff Operations ============

  // Get raw diff
  ipcMain.handle(
    'git:getDiff',
    async (
      _,
      projectId: string,
      options?: { file?: string; staged?: boolean }
    ): Promise<string> => {
      const projectPath = await requireProjectPath(projectId)
      return getDiff(projectPath, options)
    }
  )

  // Get structured diff for a file
  ipcMain.handle(
    'git:getFileDiff',
    async (_, projectId: string, file: string, staged?: boolean): Promise<FileDiff> => {
      const projectPath = await requireProjectPath(projectId)
      return getFileDiff(projectPath, file, staged)
    }
  )

  // ============ Commit Operations ============

  // Create a commit
  ipcMain.handle(
    'git:commit',
    async (_, projectId: string, message: string): Promise<CommitResult> => {
      const projectPath = await requireProjectPath(projectId)
      return commit(projectPath, message)
    }
  )

  // Get recent commits
  ipcMain.handle(
    'git:getRecentCommits',
    async (_, projectId: string, count?: number): Promise<CommitInfo[]> => {
      const projectPath = await requireProjectPath(projectId)
      return getRecentCommits(projectPath, count)
    }
  )

  // Generate AI commit message
  ipcMain.handle(
    'git:generateCommitMessage',
    async (_, projectId: string): Promise<string> => {
      const projectPath = await requireProjectPath(projectId)
      return generateCommitMessage(projectPath)
    }
  )

  // ============ Remote Operations ============

  // Get remote status (ahead/behind)
  ipcMain.handle(
    'git:getRemoteStatus',
    async (_, projectId: string): Promise<RemoteStatus> => {
      const projectPath = await requireProjectPath(projectId)
      return getRemoteStatus(projectPath)
    }
  )

  // Fetch from remote
  ipcMain.handle(
    'git:fetch',
    async (_, projectId: string, remote?: string): Promise<FetchResult> => {
      const projectPath = await requireProjectPath(projectId)
      return fetch(projectPath, remote)
    }
  )

  // Pull from remote
  ipcMain.handle(
    'git:pull',
    async (_, projectId: string, remote?: string, branch?: string): Promise<PullResult> => {
      const projectPath = await requireProjectPath(projectId)
      return pull(projectPath, remote, branch)
    }
  )

  // Push to remote
  ipcMain.handle(
    'git:push',
    async (
      _,
      projectId: string,
      remote?: string,
      branch?: string,
      options?: PushOptions
    ): Promise<PushResult> => {
      const projectPath = await requireProjectPath(projectId)
      return push(projectPath, remote, branch, options)
    }
  )

  // ============ Stash Operations ============

  // List stashes
  ipcMain.handle(
    'git:stashList',
    async (_, projectId: string): Promise<StashEntry[]> => {
      const projectPath = await requireProjectPath(projectId)
      return stashList(projectPath)
    }
  )

  // Save to stash
  ipcMain.handle(
    'git:stashSave',
    async (_, projectId: string, options?: StashSaveOptions): Promise<StashSaveResult> => {
      const projectPath = await requireProjectPath(projectId)
      return stashSave(projectPath, options)
    }
  )

  // Apply stash
  ipcMain.handle(
    'git:stashApply',
    async (_, projectId: string, index?: number): Promise<void> => {
      const projectPath = await requireProjectPath(projectId)
      await stashApply(projectPath, index)
    }
  )

  // Pop stash
  ipcMain.handle(
    'git:stashPop',
    async (_, projectId: string, index?: number): Promise<void> => {
      const projectPath = await requireProjectPath(projectId)
      await stashPop(projectPath, index)
    }
  )

  // Drop stash
  ipcMain.handle(
    'git:stashDrop',
    async (_, projectId: string, index?: number): Promise<void> => {
      const projectPath = await requireProjectPath(projectId)
      await stashDrop(projectPath, index)
    }
  )
}
