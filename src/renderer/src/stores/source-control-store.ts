/**
 * Source Control Store
 *
 * Manages state for Git source control operations including:
 * - Branch management
 * - File staging/unstaging
 * - Diff viewing
 * - Commits
 * - Remote operations
 * - Stash management
 */

import { create } from 'zustand'
import type {
  BranchInfo,
  FileStatus,
  FileDiff,
  CommitInfo,
  RemoteStatus,
  StashEntry,
  PushOptions
} from '@shared/types'

interface SourceControlState {
  // Current project context
  projectId: string | null

  // Branch state
  branches: BranchInfo[]
  currentBranch: string | null
  loadingBranches: boolean

  // Remote state
  remoteStatus: RemoteStatus | null
  isFetching: boolean
  isPulling: boolean
  isPushing: boolean

  // Stash state
  stashes: StashEntry[]
  isStashing: boolean
  loadingStashes: boolean

  // File status
  stagedFiles: FileStatus[]
  unstagedFiles: FileStatus[]
  loadingStatus: boolean

  // Diff viewing
  selectedFile: string | null
  selectedFileStaged: boolean
  currentDiff: FileDiff | null
  loadingDiff: boolean

  // Commit
  commitMessage: string
  isCommitting: boolean
  isGeneratingMessage: boolean

  // Recent commits for reference
  recentCommits: CommitInfo[]

  // Error state
  error: string | null

  // Actions - Initialization
  setProjectId: (projectId: string | null) => void
  loadAll: () => Promise<void>

  // Actions - Status & Files
  loadStatus: () => Promise<void>
  loadBranches: () => Promise<void>
  stageFile: (file: string) => Promise<void>
  unstageFile: (file: string) => Promise<void>
  stageAll: () => Promise<void>
  unstageAll: () => Promise<void>
  discardChanges: (file: string) => Promise<void>
  discardAllChanges: () => Promise<void>
  selectFile: (file: string, staged: boolean) => Promise<void>
  clearSelectedFile: () => void

  // Actions - Commit
  setCommitMessage: (message: string) => void
  generateCommitMessage: () => Promise<void>
  commit: () => Promise<void>

  // Actions - Branches
  createBranch: (name: string, startPoint?: string) => Promise<void>
  checkoutBranch: (name: string) => Promise<void>
  deleteBranch: (name: string, force?: boolean) => Promise<void>

  // Actions - Remote
  loadRemoteStatus: () => Promise<void>
  fetch: () => Promise<void>
  pull: () => Promise<void>
  push: (options?: PushOptions) => Promise<void>

  // Actions - Stash
  loadStashes: () => Promise<void>
  stashSave: (message?: string, includeUntracked?: boolean) => Promise<void>
  stashApply: (index: number) => Promise<void>
  stashPop: (index: number) => Promise<void>
  stashDrop: (index: number) => Promise<void>

  // Actions - Error
  clearError: () => void
}

export const useSourceControlStore = create<SourceControlState>((set, get) => ({
  // Initial state
  projectId: null,
  branches: [],
  currentBranch: null,
  loadingBranches: false,
  remoteStatus: null,
  isFetching: false,
  isPulling: false,
  isPushing: false,
  stashes: [],
  isStashing: false,
  loadingStashes: false,
  stagedFiles: [],
  unstagedFiles: [],
  loadingStatus: false,
  selectedFile: null,
  selectedFileStaged: false,
  currentDiff: null,
  loadingDiff: false,
  commitMessage: '',
  isCommitting: false,
  isGeneratingMessage: false,
  recentCommits: [],
  error: null,

  // Set current project
  setProjectId: (projectId: string | null) => {
    const currentProjectId = get().projectId

    // Skip if same project
    if (currentProjectId === projectId) {
      return
    }

    set({
      projectId,
      branches: [],
      currentBranch: null,
      remoteStatus: null,
      stashes: [],
      stagedFiles: [],
      unstagedFiles: [],
      selectedFile: null,
      currentDiff: null,
      commitMessage: '',
      recentCommits: [],
      error: null
    })
    if (projectId) {
      get().loadAll()
    }
  },

  // Load all data
  loadAll: async () => {
    const { projectId } = get()
    if (!projectId) return

    try {
      await Promise.all([
        get().loadStatus(),
        get().loadBranches(),
        get().loadRemoteStatus(),
        get().loadStashes()
      ])
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load source control data' })
    }
  },

  // Load file status
  loadStatus: async () => {
    const { projectId } = get()
    if (!projectId) return

    set({ loadingStatus: true, error: null })
    try {
      const files = await window.api.getGitStatus(projectId)
      const staged = files.filter((f) => f.staged)
      const unstaged = files.filter((f) => !f.staged)
      set({ stagedFiles: staged, unstagedFiles: unstaged })

      // Also load recent commits for reference
      try {
        const commits = await window.api.getRecentCommits(projectId, 10)
        set({ recentCommits: commits })
      } catch (commitError) {
        // Don't fail the entire status load if commits fail
        // Just set empty array and log the error
        console.warn('[SourceControlStore] Failed to load recent commits:', commitError)
        set({ recentCommits: [] })
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load status' })
    } finally {
      set({ loadingStatus: false })
    }
  },

  // Load branches
  loadBranches: async () => {
    const { projectId } = get()
    if (!projectId) return

    set({ loadingBranches: true })
    try {
      const branches = await window.api.listBranches(projectId)
      const current = branches.find((b) => b.current)
      set({
        branches,
        currentBranch: current?.name || null
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load branches' })
    } finally {
      set({ loadingBranches: false })
    }
  },

  // Stage a file
  stageFile: async (file: string) => {
    const { projectId } = get()
    if (!projectId) return

    try {
      await window.api.stageFiles(projectId, [file])
      await get().loadStatus()

      // If this file was selected, reload its diff as staged
      if (get().selectedFile === file) {
        await get().selectFile(file, true)
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to stage file' })
    }
  },

  // Unstage a file
  unstageFile: async (file: string) => {
    const { projectId } = get()
    if (!projectId) return

    try {
      await window.api.unstageFiles(projectId, [file])
      await get().loadStatus()

      // If this file was selected, reload its diff as unstaged
      if (get().selectedFile === file) {
        await get().selectFile(file, false)
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to unstage file' })
    }
  },

  // Stage all files
  stageAll: async () => {
    const { projectId } = get()
    if (!projectId) return

    try {
      await window.api.stageAll(projectId)
      await get().loadStatus()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to stage all files' })
    }
  },

  // Unstage all files
  unstageAll: async () => {
    const { projectId } = get()
    if (!projectId) return

    try {
      await window.api.unstageAll(projectId)
      await get().loadStatus()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to unstage all files' })
    }
  },

  // Discard changes to a file
  discardChanges: async (file: string) => {
    const { projectId } = get()
    if (!projectId) return

    try {
      await window.api.discardChanges(projectId, file)
      await get().loadStatus()

      // Clear selection if this file was selected
      if (get().selectedFile === file) {
        set({ selectedFile: null, currentDiff: null })
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to discard changes' })
    }
  },

  // Discard all changes
  discardAllChanges: async () => {
    const { projectId } = get()
    if (!projectId) return

    try {
      await window.api.discardAllChanges(projectId)
      await get().loadStatus()
      set({ selectedFile: null, currentDiff: null })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to discard all changes' })
    }
  },

  // Select a file to view its diff
  selectFile: async (file: string, staged: boolean) => {
    const { projectId } = get()
    if (!projectId) return

    set({ selectedFile: file, selectedFileStaged: staged, loadingDiff: true })
    try {
      const diff = await window.api.getFileDiff(projectId, file, staged)
      set({ currentDiff: diff })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load diff' })
    } finally {
      set({ loadingDiff: false })
    }
  },

  // Clear selected file
  clearSelectedFile: () => {
    set({ selectedFile: null, currentDiff: null, selectedFileStaged: false })
  },

  // Set commit message
  setCommitMessage: (message: string) => {
    set({ commitMessage: message })
  },

  // Generate commit message with AI
  generateCommitMessage: async () => {
    const { projectId, stagedFiles } = get()
    if (!projectId) return
    if (stagedFiles.length === 0) {
      set({ error: 'Stage some changes first to generate a commit message' })
      return
    }

    set({ isGeneratingMessage: true, error: null })
    try {
      const message = await window.api.generateCommitMessage(projectId)
      set({ commitMessage: message })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to generate commit message' })
    } finally {
      set({ isGeneratingMessage: false })
    }
  },

  // Create a commit
  commit: async () => {
    const { projectId, commitMessage, stagedFiles } = get()
    if (!projectId) return
    if (stagedFiles.length === 0) {
      set({ error: 'No staged changes to commit' })
      return
    }
    if (!commitMessage.trim()) {
      set({ error: 'Please enter a commit message' })
      return
    }

    set({ isCommitting: true, error: null })
    try {
      await window.api.gitCommit(projectId, commitMessage)
      set({ commitMessage: '' })
      await get().loadStatus()
      await get().loadRemoteStatus()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create commit' })
    } finally {
      set({ isCommitting: false })
    }
  },

  // Create a branch
  createBranch: async (name: string, startPoint?: string) => {
    const { projectId } = get()
    if (!projectId) return

    try {
      await window.api.createBranch(projectId, name, startPoint)
      await get().loadBranches()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create branch' })
    }
  },

  // Checkout a branch
  checkoutBranch: async (name: string) => {
    const { projectId } = get()
    if (!projectId) return

    try {
      await window.api.checkoutBranch(projectId, name)
      await Promise.all([
        get().loadBranches(),
        get().loadStatus(),
        get().loadRemoteStatus()
      ])
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to checkout branch' })
    }
  },

  // Delete a branch
  deleteBranch: async (name: string, force?: boolean) => {
    const { projectId } = get()
    if (!projectId) return

    try {
      await window.api.deleteBranch(projectId, name, force)
      await get().loadBranches()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete branch' })
    }
  },

  // Load remote status
  loadRemoteStatus: async () => {
    const { projectId } = get()
    if (!projectId) return

    try {
      const status = await window.api.getRemoteStatus(projectId)
      set({ remoteStatus: status })
    } catch {
      // Don't set error for remote status failures (might not have a remote)
      set({ remoteStatus: null })
    }
  },

  // Fetch from remote
  fetch: async () => {
    const { projectId } = get()
    if (!projectId) return

    set({ isFetching: true, error: null })
    try {
      await window.api.gitFetch(projectId)
      await get().loadRemoteStatus()
      await get().loadBranches()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch' })
    } finally {
      set({ isFetching: false })
    }
  },

  // Pull from remote
  pull: async () => {
    const { projectId } = get()
    if (!projectId) return

    set({ isPulling: true, error: null })
    try {
      const result = await window.api.gitPull(projectId)
      if (result.hasConflicts) {
        set({ error: 'Pull completed with conflicts. Please resolve them in your editor.' })
      }
      await Promise.all([
        get().loadRemoteStatus(),
        get().loadStatus()
      ])
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to pull' })
    } finally {
      set({ isPulling: false })
    }
  },

  // Push to remote
  push: async (options?: PushOptions) => {
    const { projectId } = get()
    if (!projectId) return

    set({ isPushing: true, error: null })
    try {
      const result = await window.api.gitPush(projectId, undefined, undefined, options)
      if (!result.success) {
        set({ error: result.error || 'Push failed' })
      }
      await get().loadRemoteStatus()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to push' })
    } finally {
      set({ isPushing: false })
    }
  },

  // Load stashes
  loadStashes: async () => {
    const { projectId } = get()
    if (!projectId) return

    set({ loadingStashes: true })
    try {
      const stashes = await window.api.stashList(projectId)
      set({ stashes })
    } catch {
      // Don't set error for stash failures
      set({ stashes: [] })
    } finally {
      set({ loadingStashes: false })
    }
  },

  // Save to stash
  stashSave: async (message?: string, includeUntracked?: boolean) => {
    const { projectId } = get()
    if (!projectId) return

    set({ isStashing: true, error: null })
    try {
      const result = await window.api.stashSave(projectId, { message, includeUntracked })
      if (!result.created) {
        set({ error: result.message || 'Nothing to stash' })
      }
      await Promise.all([
        get().loadStashes(),
        get().loadStatus()
      ])
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to stash changes' })
    } finally {
      set({ isStashing: false })
    }
  },

  // Apply stash
  stashApply: async (index: number) => {
    const { projectId } = get()
    if (!projectId) return

    try {
      await window.api.stashApply(projectId, index)
      await get().loadStatus()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to apply stash' })
    }
  },

  // Pop stash
  stashPop: async (index: number) => {
    const { projectId } = get()
    if (!projectId) return

    try {
      await window.api.stashPop(projectId, index)
      await Promise.all([
        get().loadStashes(),
        get().loadStatus()
      ])
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to pop stash' })
    }
  },

  // Drop stash
  stashDrop: async (index: number) => {
    const { projectId } = get()
    if (!projectId) return

    try {
      await window.api.stashDrop(projectId, index)
      await get().loadStashes()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to drop stash' })
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null })
  }
}))
