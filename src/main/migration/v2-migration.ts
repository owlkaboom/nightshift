/**
 * Migration script for v2 (removal of worktrees)
 *
 * This script handles the migration from the worktree-based task model
 * to the simplified direct-repo model.
 */

import { readdir, rm } from 'fs/promises'
import { join } from 'path'
import { getGit } from '@main/git/git-info'
import { loadProjects, getProjectPath, fileExists } from '@main/storage'
import { getAppDataDir } from '@main/utils/paths'

/**
 * Run the v2 migration
 * This should be called once on app startup if not already migrated
 */
export async function migrateFromWorktrees(): Promise<{
  success: boolean
  message: string
  details: string[]
}> {
  const details: string[] = []

  try {
    // 1. Find all existing worktree branches across projects
    const projects = await loadProjects()
    const branchesFound: string[] = []

    for (const project of projects) {
      const projectPath = await getProjectPath(project.id)
      if (!projectPath) continue

      try {
        const git = getGit(projectPath)
        const branches = await git.branch(['-l'])

        // Find nightshift/* branches
        const nightshiftBranches = branches.all.filter((b) => b.startsWith('nightshift/'))
        if (nightshiftBranches.length > 0) {
          branchesFound.push(
            ...nightshiftBranches.map((b) => `${project.name}: ${b}`)
          )
        }

        // Prune any stale worktrees
        try {
          await git.raw(['worktree', 'prune'])
          details.push(`Pruned stale worktrees for ${project.name}`)
        } catch {
          // Ignore prune errors
        }
      } catch (error) {
        details.push(`Could not check branches for ${project.name}: ${error}`)
      }
    }

    if (branchesFound.length > 0) {
      details.push('')
      details.push('Found nightshift branches (not auto-deleted, review manually):')
      branchesFound.forEach((b) => details.push(`  - ${b}`))
    }

    // 2. Check for ~/.nightshift/worktrees directory
    const worktreesDir = join(getAppDataDir(), 'worktrees')
    if (await fileExists(worktreesDir)) {
      // Try to remove it if empty, otherwise just note it
      try {
        const contents = await readdir(worktreesDir)
        if (contents.length === 0) {
          await rm(worktreesDir, { recursive: true })
          details.push('')
          details.push('Removed empty worktrees directory')
        } else {
          details.push('')
          details.push(`Worktrees directory exists with content: ${worktreesDir}`)
          details.push('You can safely delete this directory after reviewing any uncommitted work')
        }
      } catch {
        // Ignore errors
      }
    }

    return {
      success: true,
      message: 'Migration completed successfully',
      details
    }
  } catch (error) {
    return {
      success: false,
      message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details
    }
  }
}

/**
 * Check if migration is needed
 * Returns true if there are signs of the old worktree-based system
 */
export async function needsMigration(): Promise<boolean> {
  // Check for worktrees directory
  const worktreesDir = join(getAppDataDir(), 'worktrees')
  if (await fileExists(worktreesDir)) {
    return true
  }

  return false
}
