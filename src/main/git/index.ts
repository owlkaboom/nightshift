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
