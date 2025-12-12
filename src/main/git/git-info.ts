/**
 * Git repository information utilities
 * Uses simple-git for git operations
 */

import { simpleGit, SimpleGit } from 'simple-git'

export interface GitRepoInfo {
  isRepo: boolean
  rootPath: string | null
  remoteUrl: string | null
  currentBranch: string | null
  defaultBranch: string | null
  isDirty: boolean
  hasRemote: boolean
}

export interface GitRemote {
  name: string
  url: string
}

/**
 * Get a simple-git instance for a directory
 */
export function getGit(path: string): SimpleGit {
  return simpleGit(path)
}

/**
 * Check if a directory is a git repository
 */
export async function isGitRepo(path: string): Promise<boolean> {
  try {
    const git = getGit(path)
    return await git.checkIsRepo()
  } catch {
    return false
  }
}

/**
 * Get the root path of a git repository
 */
export async function getRepoRoot(path: string): Promise<string | null> {
  try {
    const git = getGit(path)
    const root = await git.revparse(['--show-toplevel'])
    return root.trim()
  } catch {
    return null
  }
}

/**
 * Get the current branch name
 */
export async function getCurrentBranch(path: string): Promise<string | null> {
  try {
    const git = getGit(path)
    const branch = await git.revparse(['--abbrev-ref', 'HEAD'])
    return branch.trim()
  } catch {
    return null
  }
}

/**
 * Get all remotes for a repository
 */
export async function getRemotes(path: string): Promise<GitRemote[]> {
  try {
    const git = getGit(path)
    const remotes = await git.getRemotes(true)
    return remotes.map((r) => ({
      name: r.name,
      url: r.refs.fetch || r.refs.push || ''
    }))
  } catch {
    return []
  }
}

/**
 * Get the primary remote URL (origin preferred)
 */
export async function getRemoteUrl(path: string): Promise<string | null> {
  const remotes = await getRemotes(path)

  if (remotes.length === 0) {
    return null
  }

  // Prefer 'origin' remote
  const origin = remotes.find((r) => r.name === 'origin')
  if (origin) {
    return origin.url
  }

  // Fall back to first remote
  return remotes[0].url
}

/**
 * Get the default branch (main/master) from remote or local branches
 */
export async function getDefaultBranch(path: string): Promise<string | null> {
  try {
    const git = getGit(path)

    // Try to get default branch from remote HEAD
    try {
      const remoteInfo = await git.remote(['show', 'origin'])
      if (remoteInfo) {
        const match = remoteInfo.match(/HEAD branch: (.+)/)
        if (match) {
          return match[1].trim()
        }
      }
    } catch {
      // No remote or origin doesn't exist, continue
    }

    // Get all branches (local and remote)
    const branches = await git.branch(['-a'])
    const allBranches = branches.all

    // Check remote branches first
    if (allBranches.includes('remotes/origin/main') || allBranches.includes('origin/main')) {
      return 'main'
    }
    if (allBranches.includes('remotes/origin/master') || allBranches.includes('origin/master')) {
      return 'master'
    }

    // Fall back to local branches
    if (allBranches.includes('main')) {
      return 'main'
    }
    if (allBranches.includes('master')) {
      return 'master'
    }

    // If no main/master, use current branch
    const currentBranch = await getCurrentBranch(path)
    if (currentBranch && currentBranch !== 'HEAD') {
      return currentBranch
    }

    // Last resort: use the first local branch
    const localBranches = allBranches.filter((b) => !b.startsWith('remotes/'))
    if (localBranches.length > 0) {
      return localBranches[0]
    }

    return null
  } catch {
    return null
  }
}

/**
 * Check if the working directory has uncommitted changes
 */
export async function isDirty(path: string): Promise<boolean> {
  try {
    const git = getGit(path)
    const status = await git.status()
    return !status.isClean()
  } catch {
    return false
  }
}

/**
 * Get comprehensive repository information
 */
export async function getRepoInfo(path: string): Promise<GitRepoInfo> {
  const isRepo = await isGitRepo(path)

  if (!isRepo) {
    return {
      isRepo: false,
      rootPath: null,
      remoteUrl: null,
      currentBranch: null,
      defaultBranch: null,
      isDirty: false,
      hasRemote: false
    }
  }

  const [rootPath, remoteUrl, currentBranch, defaultBranch, dirty] = await Promise.all([
    getRepoRoot(path),
    getRemoteUrl(path),
    getCurrentBranch(path),
    getDefaultBranch(path),
    isDirty(path)
  ])

  return {
    isRepo: true,
    rootPath,
    remoteUrl,
    currentBranch,
    defaultBranch,
    isDirty: dirty,
    hasRemote: remoteUrl !== null
  }
}

/**
 * Extract repository name from git URL
 */
export function extractRepoName(gitUrl: string): string {
  // Handle SSH URLs: git@github.com:user/repo.git
  // Handle HTTPS URLs: https://github.com/user/repo.git

  let name = gitUrl

  // Remove protocol
  name = name.replace(/^(https?:\/\/|git@)/, '')

  // Remove host
  name = name.replace(/^[^/:]+[/:]/, '')

  // Remove .git suffix
  name = name.replace(/\.git$/, '')

  // Get just the repo name (last part)
  const parts = name.split('/')
  return parts[parts.length - 1] || name
}

/**
 * Normalize a git URL to a canonical form
 * Converts SSH to HTTPS format for consistent comparison
 */
export function normalizeGitUrl(gitUrl: string): string {
  // Already HTTPS
  if (gitUrl.startsWith('https://')) {
    return gitUrl.replace(/\.git$/, '')
  }

  // SSH format: git@github.com:user/repo.git
  const sshMatch = gitUrl.match(/^git@([^:]+):(.+?)(?:\.git)?$/)
  if (sshMatch) {
    return `https://${sshMatch[1]}/${sshMatch[2]}`
  }

  // Already normalized or unknown format
  return gitUrl.replace(/\.git$/, '')
}
