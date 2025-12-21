/**
 * Git-related types for source control management
 * Used by the Project Detail View's Source Control tab
 */

/**
 * Information about a git branch
 */
export interface BranchInfo {
  /** Branch name (e.g., "main", "feature/auth") */
  name: string
  /** Whether this is the currently checked-out branch */
  current: boolean
  /** Remote name if this is a remote-tracking branch (e.g., "origin") */
  remote?: string
  /** Tracking branch name (e.g., "origin/main") */
  tracking?: string
  /** Number of commits ahead of tracking branch */
  ahead?: number
  /** Number of commits behind tracking branch */
  behind?: number
  /** Whether this is a local branch (vs remote) */
  isLocal: boolean
}

/**
 * File change status in the working tree
 */
export type FileStatusType = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' | 'conflicted'

/**
 * Status of a file in the git working tree
 */
export interface FileStatus {
  /** File path relative to repo root */
  path: string
  /** Type of change */
  status: FileStatusType
  /** Whether the file is staged for commit */
  staged: boolean
  /** Original path for renamed files */
  oldPath?: string
}

/**
 * A single line in a diff
 */
export interface DiffLine {
  /** Type of line: context (unchanged), add, or delete */
  type: 'context' | 'add' | 'delete'
  /** Line content (without leading +/-/space) */
  content: string
  /** Line number in original file (for context/delete) */
  oldLineNumber?: number
  /** Line number in new file (for context/add) */
  newLineNumber?: number
}

/**
 * A hunk (chunk) in a diff
 */
export interface DiffHunk {
  /** Starting line in original file */
  oldStart: number
  /** Number of lines in original file */
  oldLines: number
  /** Starting line in new file */
  newStart: number
  /** Number of lines in new file */
  newLines: number
  /** Lines in this hunk */
  lines: DiffLine[]
  /** Optional header text (e.g., function name) */
  header?: string
}

/**
 * Complete diff for a single file
 */
export interface FileDiff {
  /** File path */
  path: string
  /** Change status */
  status: FileStatusType
  /** Diff hunks */
  hunks: DiffHunk[]
  /** Total lines added */
  additions: number
  /** Total lines deleted */
  deletions: number
  /** Original file content (for deleted/modified files) */
  originalContent?: string
  /** New file content (for added/modified files) */
  modifiedContent?: string
  /** Whether this is a binary file */
  isBinary?: boolean
}

/**
 * Basic commit information
 */
export interface CommitInfo {
  /** Full commit hash */
  hash: string
  /** Short commit hash (7 chars) */
  shortHash: string
  /** Commit message */
  message: string
  /** Author name */
  author: string
  /** Author email */
  email: string
  /** Commit date (ISO string) */
  date: string
}

/**
 * Result of a commit operation
 */
export interface CommitResult {
  /** Commit hash */
  hash: string
  /** Branch the commit was made on */
  branch: string
  /** Commit message */
  message: string
}

/**
 * Remote tracking status
 */
export interface RemoteStatus {
  /** Remote name (e.g., "origin") */
  remote: string
  /** Current local branch */
  branch: string
  /** Commits ahead of remote */
  ahead: number
  /** Commits behind remote */
  behind: number
  /** Tracking branch (e.g., "origin/main") */
  tracking: string | null
  /** Whether we have a remote configured */
  hasRemote: boolean
}

/**
 * Result of a fetch operation
 */
export interface FetchResult {
  /** Remote that was fetched */
  remote: string
  /** Whether any updates were fetched */
  updated: boolean
  /** Summary of fetched refs */
  summary?: string
}

/**
 * Result of a pull operation
 */
export interface PullResult {
  /** Files that were updated */
  files: string[]
  /** Lines inserted */
  insertions: number
  /** Lines deleted */
  deletions: number
  /** Summary message */
  summary: string
  /** Whether the pull was fast-forward */
  fastForward?: boolean
  /** Whether there were merge conflicts */
  hasConflicts?: boolean
}

/**
 * Result of a push operation
 */
export interface PushResult {
  /** Remote that was pushed to */
  remote: string
  /** Branch that was pushed */
  branch: string
  /** Whether the push succeeded */
  success: boolean
  /** Error message if failed */
  error?: string
  /** Whether upstream was set */
  setUpstream?: boolean
}

/**
 * Options for push operation
 */
export interface PushOptions {
  /** Force push (use with caution) */
  force?: boolean
  /** Set upstream tracking */
  setUpstream?: boolean
}

/**
 * A stash entry
 */
export interface StashEntry {
  /** Stash index (0 is most recent) */
  index: number
  /** Stash message/description */
  message: string
  /** When the stash was created (ISO string) */
  date: string
  /** Branch the stash was created on */
  branch: string
  /** Full stash ref (e.g., "stash@{0}") */
  ref: string
}

/**
 * Options for stash save operation
 */
export interface StashSaveOptions {
  /** Optional message for the stash */
  message?: string
  /** Include untracked files */
  includeUntracked?: boolean
  /** Keep index (staged changes) */
  keepIndex?: boolean
}

/**
 * Result of stash save operation
 */
export interface StashSaveResult {
  /** Whether a stash was created */
  created: boolean
  /** Message if nothing to stash */
  message?: string
  /** Stash ref if created */
  ref?: string
}
