/**
 * Directory scanner for discovering git repositories
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { isGitRepo, getRepoInfo, normalizeGitUrl, extractRepoName } from './git-info'

export interface ScannedRepo {
  /** Local filesystem path */
  path: string

  /** Git remote URL (null if no remote) */
  gitUrl: string | null

  /** Repository name (from directory or remote) */
  name: string

  /** Default branch name */
  defaultBranch: string | null

  /** Current branch name */
  currentBranch: string | null

  /** Whether this repo is already added as a project */
  alreadyAdded: boolean

  /** Project ID if already added */
  existingProjectId: string | null

  /** Warning message (e.g., no remote configured) */
  warning: string | null
}

export interface ScanOptions {
  /** Maximum depth to scan (default: 3) */
  maxDepth?: number

  /** Directories to skip */
  skipDirs?: string[]

  /** Callback for progress updates */
  onProgress?: (current: number, total: number, currentPath: string) => void
}

const DEFAULT_SKIP_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'target',
  '.next',
  '.nuxt',
  '.vscode',
  '.idea',
  'vendor',
  '__pycache__',
  '.cache'
]

/**
 * Scan a directory for git repositories
 */
export async function scanForRepos(
  rootPath: string,
  existingProjects: Array<{ id: string; gitUrl: string | null; path?: string }>,
  options: ScanOptions = {}
): Promise<ScannedRepo[]> {
  const { maxDepth = 3, skipDirs = DEFAULT_SKIP_DIRS } = options

  const repos: ScannedRepo[] = []
  const foundPaths = new Set<string>()

  // Normalize existing project URLs for comparison
  const existingByUrl = new Map<string, string>()
  const existingByPath = new Map<string, string>()

  for (const project of existingProjects) {
    if (project.gitUrl) {
      const normalized = normalizeGitUrl(project.gitUrl)
      existingByUrl.set(normalized, project.id)
    }
    const projectPath = project.path
    if (projectPath) {
      existingByPath.set(path.resolve(projectPath), project.id)
    }
  }

  async function scanDirectory(dirPath: string, depth: number): Promise<void> {
    if (depth > maxDepth) {
      return
    }

    try {
      // Check if this directory is a git repo
      if (await isGitRepo(dirPath)) {
        const normalizedPath = path.resolve(dirPath)

        // Skip if we've already found this repo
        if (foundPaths.has(normalizedPath)) {
          return
        }

        foundPaths.add(normalizedPath)

        // Get repo info
        const repoInfo = await getRepoInfo(dirPath)

        // Check if already added
        let alreadyAdded = false
        let existingProjectId: string | null = null

        // Check by path first
        if (existingByPath.has(normalizedPath)) {
          alreadyAdded = true
          existingProjectId = existingByPath.get(normalizedPath) || null
        }

        // Check by git URL
        if (!alreadyAdded && repoInfo.remoteUrl) {
          const normalizedUrl = normalizeGitUrl(repoInfo.remoteUrl)
          if (existingByUrl.has(normalizedUrl)) {
            alreadyAdded = true
            existingProjectId = existingByUrl.get(normalizedUrl) || null
          }
        }

        // Determine name
        let name: string
        if (repoInfo.remoteUrl) {
          name = extractRepoName(repoInfo.remoteUrl)
        } else {
          name = path.basename(dirPath)
        }

        // Determine warning
        let warning: string | null = null
        if (!repoInfo.hasRemote) {
          warning = 'No remote configured'
        }

        repos.push({
          path: normalizedPath,
          gitUrl: repoInfo.remoteUrl,
          name,
          defaultBranch: repoInfo.defaultBranch,
          currentBranch: repoInfo.currentBranch,
          alreadyAdded,
          existingProjectId,
          warning
        })

        // Don't scan subdirectories of a git repo
        return
      }

      // Not a git repo, scan subdirectories
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue
        }

        // Skip common non-repo directories
        if (skipDirs.includes(entry.name)) {
          continue
        }

        // Skip hidden directories except .git (which we already handled above)
        if (entry.name.startsWith('.')) {
          continue
        }

        const subPath = path.join(dirPath, entry.name)

        // Report progress
        if (options.onProgress) {
          options.onProgress(repos.length, repos.length + 1, subPath)
        }

        await scanDirectory(subPath, depth + 1)
      }
    } catch {
      // Silently skip directories we can't access
      // Common causes: permission errors, symlink loops, etc.
    }
  }

  await scanDirectory(rootPath, 0)

  return repos
}

/**
 * Group scanned repos by git URL (for detecting duplicates)
 */
export function groupReposByUrl(repos: ScannedRepo[]): Map<string, ScannedRepo[]> {
  const grouped = new Map<string, ScannedRepo[]>()

  for (const repo of repos) {
    if (!repo.gitUrl) {
      // Repos without remotes get their own group
      grouped.set(`no-remote:${repo.path}`, [repo])
      continue
    }

    const normalized = normalizeGitUrl(repo.gitUrl)
    const existing = grouped.get(normalized) || []
    existing.push(repo)
    grouped.set(normalized, existing)
  }

  return grouped
}
