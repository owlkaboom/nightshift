/**
 * Git operations for source control management
 * Provides branch, staging, diff, commit, remote, and stash operations
 */

import { simpleGit, SimpleGit, StatusResult } from 'simple-git'
import type {
  BranchInfo,
  FileStatus,
  FileStatusType,
  FileDiff,
  DiffHunk,
  DiffLine,
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
 * Get a simple-git instance for a directory
 */
function getGit(path: string): SimpleGit {
  return simpleGit(path)
}

// ============ Branch Operations ============

/**
 * List all branches (local and remote)
 */
export async function listBranches(repoPath: string): Promise<BranchInfo[]> {
  const git = getGit(repoPath)
  const branches = await git.branch(['-a', '-vv'])
  const result: BranchInfo[] = []

  for (const name of branches.all) {
    const isRemote = name.startsWith('remotes/')
    const cleanName = isRemote ? name.replace(/^remotes\//, '') : name
    const branchData = branches.branches[name]

    // Parse tracking info if available
    let tracking: string | undefined
    let ahead: number | undefined
    let behind: number | undefined

    if (branchData?.label) {
      // Format: "abcdef1 [origin/main: ahead 2, behind 1] commit message"
      // or "abcdef1 [origin/main] commit message"
      const trackingMatch = branchData.label.match(/\[([^\]]+)\]/)
      if (trackingMatch) {
        const trackingInfo = trackingMatch[1]
        const parts = trackingInfo.split(':')
        tracking = parts[0].trim()

        if (parts[1]) {
          const aheadMatch = parts[1].match(/ahead (\d+)/)
          const behindMatch = parts[1].match(/behind (\d+)/)
          ahead = aheadMatch ? parseInt(aheadMatch[1], 10) : 0
          behind = behindMatch ? parseInt(behindMatch[1], 10) : 0
        }
      }
    }

    result.push({
      name: cleanName,
      current: branchData?.current || false,
      remote: isRemote ? cleanName.split('/')[0] : undefined,
      tracking,
      ahead,
      behind,
      isLocal: !isRemote
    })
  }

  return result
}

/**
 * Create a new branch
 */
export async function createBranch(
  repoPath: string,
  name: string,
  startPoint?: string
): Promise<void> {
  const git = getGit(repoPath)
  const args = [name]
  if (startPoint) {
    args.push(startPoint)
  }
  await git.branch(args)
}

/**
 * Checkout a branch
 */
export async function checkoutBranch(repoPath: string, name: string): Promise<void> {
  const git = getGit(repoPath)
  await git.checkout(name)
}

/**
 * Delete a branch
 */
export async function deleteBranch(
  repoPath: string,
  name: string,
  force?: boolean
): Promise<void> {
  const git = getGit(repoPath)
  await git.branch([force ? '-D' : '-d', name])
}

// ============ Status & Staging Operations ============

/**
 * Convert simple-git status to FileStatus array
 */
function parseStatus(status: StatusResult): FileStatus[] {
  const files: FileStatus[] = []

  // Staged files
  for (const file of status.staged) {
    let fileStatus: FileStatusType = 'modified'
    if (status.created.includes(file)) {
      fileStatus = 'added'
    } else if (status.deleted.includes(file)) {
      fileStatus = 'deleted'
    } else if (status.renamed.some((r) => r.to === file)) {
      fileStatus = 'renamed'
    }

    const renameInfo = status.renamed.find((r) => r.to === file)

    files.push({
      path: file,
      status: fileStatus,
      staged: true,
      oldPath: renameInfo?.from
    })
  }

  // Unstaged modified files (not in staged)
  for (const file of status.modified) {
    if (!status.staged.includes(file)) {
      files.push({
        path: file,
        status: 'modified',
        staged: false
      })
    }
  }

  // Unstaged deleted files (not in staged)
  for (const file of status.deleted) {
    if (!status.staged.includes(file)) {
      files.push({
        path: file,
        status: 'deleted',
        staged: false
      })
    }
  }

  // Untracked files
  for (const file of status.not_added) {
    files.push({
      path: file,
      status: 'untracked',
      staged: false
    })
  }

  // Conflicted files
  for (const file of status.conflicted) {
    files.push({
      path: file,
      status: 'conflicted',
      staged: false
    })
  }

  return files
}

/**
 * Get status of all files in the working tree
 */
export async function getStatus(repoPath: string): Promise<FileStatus[]> {
  const git = getGit(repoPath)
  const status = await git.status()
  return parseStatus(status)
}

/**
 * Stage specific files
 */
export async function stageFiles(repoPath: string, files: string[]): Promise<void> {
  if (files.length === 0) return
  const git = getGit(repoPath)
  await git.add(files)
}

/**
 * Unstage specific files
 */
export async function unstageFiles(repoPath: string, files: string[]): Promise<void> {
  if (files.length === 0) return
  const git = getGit(repoPath)
  await git.reset(['HEAD', '--', ...files])
}

/**
 * Stage all changes
 */
export async function stageAll(repoPath: string): Promise<void> {
  const git = getGit(repoPath)
  await git.add('-A')
}

/**
 * Unstage all files
 */
export async function unstageAll(repoPath: string): Promise<void> {
  const git = getGit(repoPath)
  await git.reset(['HEAD'])
}

/**
 * Discard changes to a file (restore to HEAD)
 */
export async function discardChanges(repoPath: string, file: string): Promise<void> {
  const git = getGit(repoPath)
  await git.checkout(['--', file])
}

/**
 * Discard all changes (restore to HEAD)
 */
export async function discardAllChanges(repoPath: string): Promise<void> {
  const git = getGit(repoPath)
  await git.checkout(['--', '.'])
}

// ============ Diff Operations ============

/**
 * Parse a unified diff string into structured format
 */
function parseDiff(diffOutput: string, filePath: string, status: FileStatusType): FileDiff {
  const hunks: DiffHunk[] = []
  let additions = 0
  let deletions = 0
  let originalContent = ''
  let modifiedContent = ''

  const lines = diffOutput.split('\n')
  let currentHunk: DiffHunk | null = null
  let oldLineNum = 0
  let newLineNum = 0

  for (const line of lines) {
    // Hunk header: @@ -1,10 +1,12 @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/)
    if (hunkMatch) {
      if (currentHunk) {
        hunks.push(currentHunk)
      }
      oldLineNum = parseInt(hunkMatch[1], 10)
      newLineNum = parseInt(hunkMatch[3], 10)
      currentHunk = {
        oldStart: oldLineNum,
        oldLines: parseInt(hunkMatch[2] || '1', 10),
        newStart: newLineNum,
        newLines: parseInt(hunkMatch[4] || '1', 10),
        lines: [],
        header: hunkMatch[5]?.trim()
      }
      continue
    }

    if (!currentHunk) continue

    // Skip binary file markers
    if (line.startsWith('Binary files')) {
      continue
    }

    // Context line (unchanged)
    if (line.startsWith(' ')) {
      const diffLine: DiffLine = {
        type: 'context',
        content: line.substring(1),
        oldLineNumber: oldLineNum,
        newLineNumber: newLineNum
      }
      currentHunk.lines.push(diffLine)
      originalContent += line.substring(1) + '\n'
      modifiedContent += line.substring(1) + '\n'
      oldLineNum++
      newLineNum++
    }
    // Added line
    else if (line.startsWith('+') && !line.startsWith('+++')) {
      const diffLine: DiffLine = {
        type: 'add',
        content: line.substring(1),
        newLineNumber: newLineNum
      }
      currentHunk.lines.push(diffLine)
      modifiedContent += line.substring(1) + '\n'
      additions++
      newLineNum++
    }
    // Deleted line
    else if (line.startsWith('-') && !line.startsWith('---')) {
      const diffLine: DiffLine = {
        type: 'delete',
        content: line.substring(1),
        oldLineNumber: oldLineNum
      }
      currentHunk.lines.push(diffLine)
      originalContent += line.substring(1) + '\n'
      deletions++
      oldLineNum++
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk)
  }

  return {
    path: filePath,
    status,
    hunks,
    additions,
    deletions,
    originalContent: originalContent || undefined,
    modifiedContent: modifiedContent || undefined
  }
}

/**
 * Get raw diff output
 */
export async function getDiff(
  repoPath: string,
  options?: { file?: string; staged?: boolean }
): Promise<string> {
  const git = getGit(repoPath)
  const args: string[] = []

  if (options?.staged) {
    args.push('--cached')
  }

  if (options?.file) {
    args.push('--', options.file)
  }

  return await git.diff(args)
}

/**
 * Get structured diff for a specific file
 */
export async function getFileDiff(
  repoPath: string,
  file: string,
  staged?: boolean
): Promise<FileDiff> {
  const git = getGit(repoPath)

  // Get file status
  const status = await git.status()
  let fileStatus: FileStatusType = 'modified'

  if (status.created.includes(file)) {
    fileStatus = 'added'
  } else if (status.deleted.includes(file)) {
    fileStatus = 'deleted'
  } else if (status.not_added.includes(file)) {
    fileStatus = 'untracked'
  } else if (status.renamed.some((r) => r.to === file)) {
    fileStatus = 'renamed'
  }

  // Get diff
  const args: string[] = []
  if (staged) {
    args.push('--cached')
  }
  args.push('--', file)

  const diffOutput = await git.diff(args)

  // For untracked files, we need to get the content differently
  if (fileStatus === 'untracked') {
    // Read file content for untracked files
    const fs = await import('fs/promises')
    const path = await import('path')
    try {
      const content = await fs.readFile(path.join(repoPath, file), 'utf-8')
      const lines = content.split('\n')
      return {
        path: file,
        status: 'untracked',
        hunks: [
          {
            oldStart: 0,
            oldLines: 0,
            newStart: 1,
            newLines: lines.length,
            lines: lines.map((line, index) => ({
              type: 'add' as const,
              content: line,
              newLineNumber: index + 1
            }))
          }
        ],
        additions: lines.length,
        deletions: 0,
        modifiedContent: content
      }
    } catch {
      // File might not exist or be unreadable
      return {
        path: file,
        status: 'untracked',
        hunks: [],
        additions: 0,
        deletions: 0
      }
    }
  }

  return parseDiff(diffOutput, file, fileStatus)
}

// ============ Commit Operations ============

/**
 * Create a commit
 */
export async function commit(repoPath: string, message: string): Promise<CommitResult> {
  const git = getGit(repoPath)
  const result = await git.commit(message)

  // Get current branch
  const branchResult = await git.revparse(['--abbrev-ref', 'HEAD'])

  return {
    hash: result.commit,
    branch: branchResult.trim(),
    message
  }
}

/**
 * Get recent commits
 */
export async function getRecentCommits(
  repoPath: string,
  count: number = 10
): Promise<CommitInfo[]> {
  const git = getGit(repoPath)
  const log = await git.log({ maxCount: count })

  return log.all.map((entry) => ({
    hash: entry.hash,
    shortHash: entry.hash.substring(0, 7),
    message: entry.message,
    author: entry.author_name,
    email: entry.author_email,
    date: entry.date
  }))
}

// ============ Remote Operations ============

/**
 * Get remote tracking status (ahead/behind counts)
 */
export async function getRemoteStatus(repoPath: string): Promise<RemoteStatus> {
  const git = getGit(repoPath)

  // Get current branch
  const branchResult = await git.revparse(['--abbrev-ref', 'HEAD'])
  const branch = branchResult.trim()

  // Check if we have a remote
  const remotes = await git.getRemotes()
  if (remotes.length === 0) {
    return {
      remote: '',
      branch,
      ahead: 0,
      behind: 0,
      tracking: null,
      hasRemote: false
    }
  }

  // Get tracking branch
  let tracking: string | null = null
  try {
    const trackingResult = await git.raw([
      'rev-parse',
      '--abbrev-ref',
      `${branch}@{upstream}`
    ])
    tracking = trackingResult.trim()
  } catch {
    // No upstream configured
  }

  let ahead = 0
  let behind = 0

  if (tracking) {
    try {
      // Get ahead/behind counts
      const revList = await git.raw([
        'rev-list',
        '--left-right',
        '--count',
        `${tracking}...HEAD`
      ])
      const [behindStr, aheadStr] = revList.trim().split(/\s+/)
      behind = parseInt(behindStr, 10) || 0
      ahead = parseInt(aheadStr, 10) || 0
    } catch {
      // Couldn't get counts
    }
  }

  return {
    remote: remotes[0].name,
    branch,
    ahead,
    behind,
    tracking,
    hasRemote: true
  }
}

/**
 * Fetch from remote
 */
export async function fetch(repoPath: string, remote?: string): Promise<FetchResult> {
  const git = getGit(repoPath)

  const remoteToFetch = remote || 'origin'
  const beforeRefs = await git.raw(['show-ref']).catch(() => '')

  // Use raw command for more control over options
  await git.raw(['fetch', remoteToFetch, '--prune'])

  const afterRefs = await git.raw(['show-ref']).catch(() => '')
  const updated = beforeRefs !== afterRefs

  return {
    remote: remoteToFetch,
    updated,
    summary: updated ? 'Fetched updates from remote' : 'Already up to date'
  }
}

/**
 * Pull from remote
 */
export async function pull(
  repoPath: string,
  remote?: string,
  branch?: string
): Promise<PullResult> {
  const git = getGit(repoPath)

  const result = await git.pull(remote, branch)

  // Extract numeric values from PullDetailFileChanges
  const insertions = typeof result.insertions === 'number'
    ? result.insertions
    : (result.insertions as { count: number })?.count || 0
  const deletions = typeof result.deletions === 'number'
    ? result.deletions
    : (result.deletions as { count: number })?.count || 0

  return {
    files: result.files,
    insertions,
    deletions,
    summary: result.summary.changes
      ? `Updated ${result.files.length} files (+${insertions} -${deletions})`
      : 'Already up to date',
    hasConflicts: result.files.some((f) => f.includes('CONFLICT'))
  }
}

/**
 * Push to remote
 */
export async function push(
  repoPath: string,
  remote?: string,
  branch?: string,
  options?: PushOptions
): Promise<PushResult> {
  const git = getGit(repoPath)

  const remoteToUse = remote || 'origin'
  const args: string[] = []

  if (options?.setUpstream) {
    args.push('-u')
  }

  if (options?.force) {
    args.push('--force')
  }

  try {
    await git.push(remoteToUse, branch, args)

    // Get current branch if not specified
    const currentBranch = branch || (await git.revparse(['--abbrev-ref', 'HEAD'])).trim()

    return {
      remote: remoteToUse,
      branch: currentBranch,
      success: true,
      setUpstream: options?.setUpstream
    }
  } catch (error) {
    return {
      remote: remoteToUse,
      branch: branch || '',
      success: false,
      error: error instanceof Error ? error.message : 'Push failed'
    }
  }
}

// ============ Stash Operations ============

/**
 * List all stashes
 */
export async function stashList(repoPath: string): Promise<StashEntry[]> {
  const git = getGit(repoPath)

  try {
    // Use raw command to get stash list with formatting
    const result = await git.raw([
      'stash',
      'list',
      '--format=%gd|||%gs|||%ai|||%s'
    ])

    if (!result.trim()) {
      return []
    }

    return result
      .trim()
      .split('\n')
      .map((line, index) => {
        const [ref, description, date] = line.split('|||')
        // Parse the description to get branch info
        // Format: "WIP on main: abc1234 commit message" or custom message
        const branchMatch = description?.match(/^(?:WIP on|On) ([^:]+):/) || []

        return {
          index,
          message: description || `stash@{${index}}`,
          date: date || new Date().toISOString(),
          branch: branchMatch[1] || 'unknown',
          ref: ref || `stash@{${index}}`
        }
      })
  } catch {
    return []
  }
}

/**
 * Save changes to stash
 */
export async function stashSave(
  repoPath: string,
  options?: StashSaveOptions
): Promise<StashSaveResult> {
  const git = getGit(repoPath)

  // Check if there are changes to stash
  const status = await git.status()
  if (status.isClean()) {
    return {
      created: false,
      message: 'No local changes to save'
    }
  }

  const args: string[] = ['push']

  if (options?.message) {
    args.push('-m', options.message)
  }

  if (options?.includeUntracked) {
    args.push('--include-untracked')
  }

  if (options?.keepIndex) {
    args.push('--keep-index')
  }

  await git.stash(args)

  return {
    created: true,
    ref: 'stash@{0}'
  }
}

/**
 * Apply a stash (keep it in stash list)
 */
export async function stashApply(repoPath: string, index: number = 0): Promise<void> {
  const git = getGit(repoPath)
  await git.stash(['apply', `stash@{${index}}`])
}

/**
 * Pop a stash (apply and remove from stash list)
 */
export async function stashPop(repoPath: string, index: number = 0): Promise<void> {
  const git = getGit(repoPath)
  await git.stash(['pop', `stash@{${index}}`])
}

/**
 * Drop a stash (remove without applying)
 */
export async function stashDrop(repoPath: string, index: number = 0): Promise<void> {
  const git = getGit(repoPath)
  await git.stash(['drop', `stash@{${index}}`])
}

/**
 * Clear all stashes
 */
export async function stashClear(repoPath: string): Promise<void> {
  const git = getGit(repoPath)
  await git.stash(['clear'])
}
