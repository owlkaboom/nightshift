# Git Integration

## Overview

Nightshift uses Git worktrees to isolate each task in a separate branch. This allows multiple tasks to run concurrently without conflicts and gives developers full control over merging changes.

## Core Concept: Git Worktrees

A git worktree is a linked working directory attached to a repository. Each worktree has its own branch and working files while sharing the same `.git` history.

```
project-root/                     # Main working directory
├── .git/                         # Repository
└── src/                          # Main branch files

~/.nightshift/worktrees/
└── project-id/
    └── task-abc123/              # Worktree for task
        ├── .git -> ../../.git    # Linked to main repo
        └── src/                  # Task branch files
```

## Workflow

### 1. Task Created
When a task is created, no git operations occur yet.

### 2. Task Started
When execution begins:
1. Create new branch: `nightshift/task-{task-id}`
2. Create worktree at `~/.nightshift/worktrees/{project-id}/{task-id}/`
3. Agent runs in worktree directory

### 3. Task Completed
Agent makes changes in worktree. Changes are:
- Automatically committed by agent
- Visible via `git diff` in review
- Isolated from main branch

### 4. Review
Developer reviews changes in worktree:
- View diff against base branch
- Accept or reject changes

### 5. Accept
Developer manually merges:
```bash
# In main project directory
git merge nightshift/task-{task-id}
# or cherry-pick, rebase, etc.
```

### 6. Cleanup
After merge, worktree and branch can be cleaned up.

## Implementation

### Git Operations Module

```typescript
// src/main/git/index.ts
import simpleGit, { SimpleGit } from 'simple-git'

export class GitService {
  private git: SimpleGit

  constructor(repoPath: string) {
    this.git = simpleGit(repoPath)
  }

  async createWorktree(taskId: string, baseBranch?: string): Promise<string> {
    const branchName = `nightshift/task-${taskId}`
    const worktreePath = this.getWorktreePath(taskId)

    // Create worktree with new branch
    await this.git.raw([
      'worktree',
      'add',
      '-b', branchName,
      worktreePath,
      baseBranch || 'HEAD'
    ])

    return worktreePath
  }

  async removeWorktree(taskId: string): Promise<void> {
    const worktreePath = this.getWorktreePath(taskId)

    // Remove worktree
    await this.git.raw(['worktree', 'remove', worktreePath, '--force'])

    // Delete branch
    const branchName = `nightshift/task-${taskId}`
    await this.git.raw(['branch', '-D', branchName])
  }

  async getWorktreeDiff(taskId: string, baseBranch: string): Promise<string> {
    const branchName = `nightshift/task-${taskId}`
    return this.git.diff([`${baseBranch}...${branchName}`])
  }

  async listWorktrees(): Promise<string[]> {
    const result = await this.git.raw(['worktree', 'list', '--porcelain'])
    // Parse worktree list
    return result.split('\n')
      .filter(line => line.startsWith('worktree '))
      .map(line => line.replace('worktree ', ''))
  }

  private getWorktreePath(taskId: string): string {
    return path.join(
      app.getPath('home'),
      '.nightshift',
      'worktrees',
      this.projectId,
      taskId
    )
  }
}
```

### Git Info Module

```typescript
// src/main/git/git-info.ts
export async function getGitInfo(projectPath: string): Promise<GitInfo> {
  const git = simpleGit(projectPath)

  const [remote, branch, status] = await Promise.all([
    git.getRemotes(true),
    git.branch(),
    git.status()
  ])

  return {
    remoteUrl: remote[0]?.refs.fetch || '',
    currentBranch: branch.current,
    isDirty: status.modified.length > 0 || status.staged.length > 0,
    ahead: status.ahead,
    behind: status.behind
  }
}

export interface GitInfo {
  remoteUrl: string
  currentBranch: string
  isDirty: boolean
  ahead: number
  behind: number
}
```

## IPC Handlers

```typescript
// src/main/ipc/git-handlers.ts
import { ipcMain } from 'electron'
import { IpcChannels } from '../../shared/ipc-types'
import { GitService, getGitInfo } from '../git'

export function registerGitHandlers(): void {
  ipcMain.handle(IpcChannels.GIT_GET_INFO, async (_event, projectPath) => {
    return getGitInfo(projectPath)
  })

  ipcMain.handle(IpcChannels.GIT_CREATE_WORKTREE, async (_event, projectPath, taskId) => {
    const git = new GitService(projectPath)
    const worktreePath = await git.createWorktree(taskId)
    return { worktreePath }
  })

  ipcMain.handle(IpcChannels.GIT_REMOVE_WORKTREE, async (_event, projectPath, taskId) => {
    const git = new GitService(projectPath)
    await git.removeWorktree(taskId)
    return { success: true }
  })

  ipcMain.handle(IpcChannels.GIT_GET_DIFF, async (_event, projectPath, taskId, baseBranch) => {
    const git = new GitService(projectPath)
    const diff = await git.getWorktreeDiff(taskId, baseBranch)
    return { diff }
  })
}
```

## Branch Naming

Tasks use a consistent branch naming pattern:
```
nightshift/task-{task-id}
```

Examples:
- `nightshift/task-a1b2c3d4`
- `nightshift/task-e5f6g7h8`

This allows easy identification and cleanup of Nightshift branches.

## Worktree Cleanup

### Migration: Orphan Worktree Cleanup

```typescript
// src/main/migration/worktree-cleanup.ts
export async function cleanupOrphanWorktrees(): Promise<void> {
  const worktreesDir = path.join(
    app.getPath('home'),
    '.nightshift',
    'worktrees'
  )

  // Get all registered tasks
  const taskStore = TaskStore.getInstance()
  const allTasks = await taskStore.getAllTasks()
  const activeTaskIds = new Set(allTasks.map(t => t.id))

  // Scan worktree directories
  const projectDirs = await fs.readdir(worktreesDir)

  for (const projectDir of projectDirs) {
    const taskDirs = await fs.readdir(path.join(worktreesDir, projectDir))

    for (const taskDir of taskDirs) {
      if (!activeTaskIds.has(taskDir)) {
        // Orphan worktree - clean up
        await removeWorktree(projectDir, taskDir)
      }
    }
  }
}
```

## Error Handling

```typescript
async function createWorktree(taskId: string): Promise<string> {
  try {
    return await this.git.createWorktree(taskId)
  } catch (error) {
    // Handle common errors
    if (error.message.includes('already exists')) {
      // Worktree already exists - return existing path
      return this.getWorktreePath(taskId)
    }

    if (error.message.includes('not a git repository')) {
      throw new Error('Project is not a git repository')
    }

    throw error
  }
}
```

## Integration with Task Lifecycle

```typescript
// In agent-handlers.ts
async function runTask(taskId: string): Promise<void> {
  const task = await taskStore.getTask(taskId)
  const project = await projectStore.getProject(task.projectId)

  // 1. Create worktree
  const gitService = new GitService(project.localPath)
  const worktreePath = await gitService.createWorktree(taskId)

  // 2. Update task with worktree path
  await taskStore.updateTask(taskId, {
    worktreePath,
    branchName: `nightshift/task-${taskId}`
  })

  // 3. Run agent in worktree
  const adapter = AgentRegistry.getAdapter(task.agentId)
  adapter.invoke({
    projectPath: project.localPath,
    worktreePath,
    prompt: task.prompt,
    // ...
  })
}
```

## Developer Merge Workflow

After accepting a task, developers merge manually:

```bash
# Option 1: Merge
cd /path/to/project
git merge nightshift/task-abc123

# Option 2: Cherry-pick specific commits
git cherry-pick <commit-hash>

# Option 3: Rebase for cleaner history
git rebase nightshift/task-abc123

# Option 4: Squash merge
git merge --squash nightshift/task-abc123
git commit -m "feat: implement feature from task"
```

This gives full control over how changes are integrated.

## Relevant Files

| File | Purpose |
|------|---------|
| `src/main/git/index.ts` | Git service exports |
| `src/main/git/git-info.ts` | Repository information |
| `src/main/ipc/git-handlers.ts` | Git IPC handlers |
| `src/main/migration/worktree-cleanup.ts` | Orphan cleanup |
| `src/shared/types/project.ts` | Project with git info |
