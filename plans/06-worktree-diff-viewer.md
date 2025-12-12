# Plan: Git Worktree-Based Task Isolation & Diff Viewer

## Overview

Implement proper git worktree isolation for task execution, enabling clean diffs, safe review, and controlled merging of AI-generated changes.

## Goals

1. **Isolation** - Each task runs in its own worktree, not touching the main working directory
2. **Clean diffs** - Always have a clear diff between task changes and the base branch
3. **Safe review** - User can test/inspect changes in the worktree before merging
4. **Controlled merge** - User decides when/how to merge changes into their codebase

## Task Lifecycle with Worktrees

```
Task Created (queued)
    │
    ▼
Task Started (awaiting_agent)
    │
    ├─► Check for uncommitted changes in main → Warn but proceed
    │
    ├─► Record base commit SHA
    │
    ├─► Create branch: nightshift/task-{id}
    │
    └─► Create worktree: ~/.nightshift/worktrees/{project-id}/{task-id}/
            │
            ▼
      Agent Runs (running)
        cwd = worktree path
            │
            ▼
      Task Completes (needs_review / failed)
        │
        ├─► Generate diff (base..HEAD in worktree)
        │
        └─► Store diff metadata on task
                │
                ▼
          Review Mode
            │
            ├─► View diff in UI
            ├─► Open worktree in editor
            ├─► Run tests in worktree terminal
            │
            ▼
      ┌─────┴─────┐
      │           │
   Accept      Reject
      │           │
      ▼           ▼
   Merge to    Delete
   target      worktree
   branch      + branch
      │
      ▼
   Cleanup
   worktree
```

## Data Model Changes

### Task Manifest Extensions

```typescript
// src/shared/types/task.ts - additions to TaskManifest

interface TaskManifest {
  // ... existing fields ...

  // Git worktree fields
  git?: {
    branchName: string           // e.g., "nightshift/task-abc123"
    worktreePath: string         // e.g., "~/.nightshift/worktrees/proj-1/abc123"
    baseBranch: string           // e.g., "main" - branch task was created from
    baseCommit: string           // SHA at time of worktree creation
    mergedAt?: string            // Timestamp when merged (on accept)
    mergeCommit?: string         // Resulting merge commit SHA
    mergeTarget?: string         // Branch merged into (usually same as baseBranch)
  }
}
```

### Diff Types

```typescript
// src/shared/types/diff.ts

export interface FileDiff {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  oldPath?: string              // For renames
  additions: number
  deletions: number
  hunks: DiffHunk[]
}

export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  content: string               // Raw unified diff content for this hunk
}

export interface TaskDiff {
  taskId: string
  baseBranch: string
  baseCommit: string
  headCommit: string
  files: FileDiff[]
  stats: {
    filesChanged: number
    additions: number
    deletions: number
  }
}
```

## Git Module Extensions

### New File: `src/main/git/worktree-manager.ts`

```typescript
import { getGit, getCurrentBranch, getDefaultBranch, isDirty } from './git-info'
import type { SimpleGit } from 'simple-git'

export interface WorktreeInfo {
  branchName: string
  worktreePath: string
  baseBranch: string
  baseCommit: string
}

export interface CreateWorktreeOptions {
  projectPath: string
  taskId: string
  baseBranch?: string           // Defaults to current or default branch
}

export interface WorktreeWarning {
  type: 'uncommitted_changes'
  message: string
}

/**
 * Create a worktree for a task
 * Returns worktree info and any warnings
 */
export async function createTaskWorktree(
  options: CreateWorktreeOptions
): Promise<{ info: WorktreeInfo; warnings: WorktreeWarning[] }>

/**
 * Delete a task's worktree and optionally its branch
 */
export async function deleteTaskWorktree(
  projectPath: string,
  worktreePath: string,
  branchName: string,
  deleteBranch: boolean
): Promise<void>

/**
 * Get the diff between base and current state of worktree
 */
export async function getWorktreeDiff(
  worktreePath: string,
  baseCommit: string
): Promise<TaskDiff>

/**
 * Merge task branch into target branch
 */
export async function mergeTaskBranch(
  projectPath: string,
  taskBranch: string,
  targetBranch: string,
  options?: { ffOnly?: boolean; noFf?: boolean }
): Promise<{ success: boolean; mergeCommit?: string; conflict?: boolean }>

/**
 * Check if worktree exists and is valid
 */
export async function isWorktreeValid(worktreePath: string): Promise<boolean>

/**
 * List all nightshift worktrees for a project
 */
export async function listTaskWorktrees(projectPath: string): Promise<string[]>

/**
 * Cleanup stale worktrees (orphaned, invalid)
 */
export async function pruneStaleWorktrees(projectPath: string): Promise<void>
```

## IPC Channels

```typescript
// src/shared/ipc-types.ts additions

interface IpcChannels {
  // Worktree operations
  'task:getWorktreeInfo': (projectId: string, taskId: string) => Promise<WorktreeInfo | null>
  'task:getDiff': (projectId: string, taskId: string) => Promise<TaskDiff | null>
  'task:openWorktreeInEditor': (projectId: string, taskId: string) => Promise<void>
  'task:openWorktreeTerminal': (projectId: string, taskId: string) => Promise<void>

  // Enhanced accept/reject with git operations
  'task:acceptWithMerge': (
    projectId: string,
    taskId: string,
    options?: { targetBranch?: string; deleteWorktree?: boolean }
  ) => Promise<{ success: boolean; mergeCommit?: string; error?: string }>

  'task:rejectWithCleanup': (
    projectId: string,
    taskId: string
  ) => Promise<{ success: boolean; error?: string }>

  // Git status for review UI
  'git:getWorktreeStatus': (worktreePath: string) => Promise<{
    branch: string
    ahead: number
    behind: number
    isDirty: boolean
  }>
}
```

## Agent Handler Changes

### `src/main/ipc/agent-handlers.ts`

Modify the `startTask` flow:

```typescript
// Before spawning agent:

// 1. Check for uncommitted changes (warn but proceed)
const mainDirty = await isDirty(projectPath)
if (mainDirty) {
  // Emit warning event to renderer
  broadcast('task:warning', {
    taskId,
    type: 'uncommitted_changes',
    message: 'Your working directory has uncommitted changes. Task will run in isolated worktree.'
  })
}

// 2. Create worktree
const { info, warnings } = await createTaskWorktree({
  projectPath,
  taskId,
  baseBranch: project.defaultBranch // or current branch
})

// 3. Update task manifest with git info
await updateTask(projectId, taskId, {
  git: {
    branchName: info.branchName,
    worktreePath: info.worktreePath,
    baseBranch: info.baseBranch,
    baseCommit: info.baseCommit
  }
})

// 4. Spawn agent with worktree as cwd
const workingDirectory = info.worktreePath  // Changed from projectPath
```

## UI Components

### Diff Viewer Component

`src/renderer/src/components/review/DiffViewer.tsx`

```typescript
interface DiffViewerProps {
  diff: TaskDiff
  onFileSelect?: (file: FileDiff) => void
}

// Features:
// - File list sidebar with change indicators (+/-/~)
// - Unified or split diff view toggle
// - Syntax highlighting per file type
// - Expand/collapse hunks
// - Stats summary (files changed, +/- lines)
```

Consider using an existing library:
- `react-diff-viewer-continued` - Popular, maintained fork
- `diff2html` - Renders git diff output to HTML
- Custom with `prismjs` for syntax highlighting

### Enhanced Task Detail View

`src/renderer/src/components/review/TaskDetailView.tsx` additions:

```tsx
// When task.status === 'needs_review' and task.git exists:

<ReviewPanel>
  {/* Git info bar */}
  <GitInfoBar>
    <BranchBadge branch={task.git.branchName} />
    <span>based on {task.git.baseBranch} @ {task.git.baseCommit.slice(0, 7)}</span>
  </GitInfoBar>

  {/* Diff summary */}
  <DiffSummary stats={diff.stats} />

  {/* Action buttons */}
  <ButtonGroup>
    <Button onClick={openInEditor}>Open in Editor</Button>
    <Button onClick={openTerminal}>Open Terminal</Button>
  </ButtonGroup>

  {/* Diff viewer */}
  <DiffViewer diff={diff} />

  {/* Accept/Reject with merge options */}
  <ReviewActions>
    <AcceptButton onClick={acceptWithMerge}>
      Accept & Merge to {task.git.baseBranch}
    </AcceptButton>
    <RejectButton onClick={rejectWithCleanup}>
      Reject & Discard
    </RejectButton>
  </ReviewActions>
</ReviewPanel>
```

### Worktree Status Indicator

Show in sidebar or task card when a task has an active worktree:

```tsx
<WorktreeIndicator>
  <GitBranchIcon />
  <span>{task.git.branchName}</span>
  {worktreeValid ? <CheckIcon /> : <WarningIcon />}
</WorktreeIndicator>
```

## Implementation Phases

### Phase 1: Git Worktree Module

1. Create `src/main/git/worktree-manager.ts`
2. Implement `createTaskWorktree()`
   - Create branch from base
   - Create worktree in `~/.nightshift/worktrees/{projectId}/{taskId}/`
   - Return info and warnings
3. Implement `deleteTaskWorktree()`
4. Implement `isWorktreeValid()`
5. Add unit tests for worktree operations

### Phase 2: Task Manifest & Storage

1. Add `git` field to TaskManifest interface
2. Update task-store to persist git info
3. Add migration for existing tasks (they won't have git info, which is fine)

### Phase 3: Agent Integration

1. Modify `agent-handlers.ts` to create worktree before agent spawn
2. Set agent working directory to worktree path
3. Handle warnings (uncommitted changes)
4. Update task manifest after worktree creation
5. Test with Claude Code / Gemini adapters

### Phase 4: Diff Generation

1. Implement `getWorktreeDiff()` in worktree-manager
2. Parse git diff output into structured `TaskDiff`
3. Add `task:getDiff` IPC handler
4. Cache diff on task completion (optional optimization)

### Phase 5: Accept/Reject with Git Operations

1. Implement `mergeTaskBranch()`
2. Create `task:acceptWithMerge` handler
   - Merge branch to target
   - Record merge commit
   - Cleanup worktree
   - Update task status
3. Create `task:rejectWithCleanup` handler
   - Delete worktree
   - Delete branch
   - Update task status
4. Handle merge conflicts (block merge, show error)

### Phase 6: Diff Viewer UI

1. Choose/implement diff viewer component
2. Create `DiffViewer.tsx`
3. Add file tree sidebar
4. Add syntax highlighting
5. Integrate into TaskDetailView

### Phase 7: Review Mode UX

1. Add "Open in Editor" action (uses system default or configured editor)
2. Add "Open Terminal" action (spawns terminal at worktree path)
3. Add worktree status indicator to task cards
4. Show branch info in review panel
5. Add merge target selector (default to base branch)

### Phase 8: Cleanup & Edge Cases

1. Implement `pruneStaleWorktrees()`
2. Add cleanup on app quit
3. Add cleanup on task deletion
4. Handle case where worktree was manually deleted
5. Handle case where branch was manually deleted
6. Recovery UI for orphaned worktrees

## File Structure

```
src/
├── main/
│   ├── git/
│   │   ├── git-info.ts          # Existing
│   │   ├── worktree-manager.ts  # NEW
│   │   └── index.ts             # Update exports
│   └── ipc/
│       ├── agent-handlers.ts    # Modify
│       └── task-handlers.ts     # Add diff/merge handlers
├── renderer/src/
│   └── components/
│       └── review/
│           ├── TaskDetailView.tsx  # Modify
│           ├── DiffViewer.tsx      # NEW
│           ├── DiffSummary.tsx     # NEW
│           ├── FileDiffView.tsx    # NEW
│           └── GitInfoBar.tsx      # NEW
└── shared/
    └── types/
        ├── task.ts              # Add git field
        └── diff.ts              # NEW
```

## Dependencies

```json
{
  "diff2html": "^3.x",           // Optional: render diffs to HTML
  "react-diff-viewer-continued": "^4.x"  // Optional: React diff component
}
```

Or build custom with existing `prismjs` (already may be in project for code highlighting).

## Configuration Options

Add to app config:

```typescript
interface AppConfig {
  // ... existing ...

  worktrees: {
    autoCleanupOnReject: boolean    // Default: true
    autoCleanupOnAccept: boolean    // Default: true
    warnOnUncommittedChanges: boolean  // Default: true
    defaultMergeStrategy: 'ff-only' | 'no-ff' | 'squash'  // Default: 'no-ff'
  }
}
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Uncommitted changes in main | Warn, proceed with worktree creation |
| Worktree creation fails | Fail task start, show error |
| Worktree manually deleted | Detect on review, offer to recreate or reject |
| Branch manually deleted | Detect on review, show error, allow reject only |
| Merge conflict | Block merge, show conflict info, user must resolve manually |
| Disk space low | Warn before worktree creation |

## Migration from Current State

Since v2 removed worktrees, existing tasks won't have `git` info. This is fine:
- Old tasks continue to work (direct execution mode)
- New tasks get worktree isolation
- No data migration needed
- Optional: Add setting to enable/disable worktree mode per project

## Future Enhancements

1. **Squash merge option** - Combine all task commits into one
2. **Cherry-pick mode** - Select specific commits to merge
3. **Conflict resolution UI** - In-app merge conflict editor
4. **Branch naming customization** - User-defined branch name pattern
5. **Multiple worktrees per task** - For tasks that touch multiple repos
6. **Worktree browser** - View all active worktrees across projects
