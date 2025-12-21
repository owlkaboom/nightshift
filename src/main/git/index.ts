/**
 * Git utilities exports
 */

export {
  getGit,
  isGitRepo,
  getRepoRoot,
  getCurrentBranch,
  getRemotes,
  getRemoteUrl,
  getDefaultBranch,
  isDirty,
  getRepoInfo,
  extractRepoName,
  normalizeGitUrl,
  type GitRepoInfo,
  type GitRemote
} from './git-info'

// Git operations for source control management
export {
  // Branch operations
  listBranches,
  createBranch,
  checkoutBranch,
  deleteBranch,
  // Status & staging
  getStatus,
  stageFiles,
  unstageFiles,
  stageAll,
  unstageAll,
  discardChanges,
  discardAllChanges,
  // Diff operations
  getDiff,
  getFileDiff,
  // Commit operations
  commit,
  getRecentCommits,
  // Remote operations
  getRemoteStatus,
  fetch,
  pull,
  push,
  // Stash operations
  stashList,
  stashSave,
  stashApply,
  stashPop,
  stashDrop,
  stashClear
} from './git-operations'

// Commit message generation
export { generateCommitMessage, generateCommitMessageWithContext } from './commit-message-generator'
