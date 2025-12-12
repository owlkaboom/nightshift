# Task Management

## Overview

Tasks are the core unit of work in Nightshift. Each task represents a coding job to be executed by an AI agent (Claude Code). Tasks flow through a defined lifecycle and support iterations for refinement.

## Task Lifecycle

```
           ┌──────────────────────────────────────────────┐
           │                                              │
           ▼                                              │
       ┌────────┐     ┌─────────┐     ┌─────────────┐    │
       │ queued │────▶│ running │────▶│ needs_review│────┤ (re-prompt)
       └────────┘     └─────────┘     └─────────────┘    │
           │               │                │            │
           │               │                ├───────────▶│
           │               │                │  (reject)  │
           │               ▼                ▼            │
           │          ┌────────┐      ┌──────────┐       │
           │          │ failed │      │ accepted │       │
           │          └────────┘      └──────────┘       │
           │               │
           └───────────────┘ (retry)
```

### Status Definitions

| Status | Description |
|--------|-------------|
| `queued` | Task is waiting to be executed |
| `running` | Agent is currently working on task |
| `needs_review` | Execution complete, awaiting human review |
| `failed` | Execution failed (error, rate limit, etc.) |
| `accepted` | Changes approved by user |
| `rejected` | Changes discarded by user |

## Task Data Model

```typescript
interface Task {
  id: string                    // Unique identifier
  projectId: string             // Parent project
  title: string                 // Human-readable title
  prompt: string                // Instructions for agent
  status: TaskStatus
  createdAt: string             // ISO timestamp
  updatedAt: string             // ISO timestamp

  // Execution state
  currentIteration: number      // Current iteration number
  iterations: Iteration[]       // Execution history

  // Configuration
  contextFiles?: string[]       // Files to include as context
  skills?: string[]             // Enabled skills for this task

  // Git state
  worktreePath?: string         // Path to git worktree
  branchName?: string           // Task branch name
}

interface Iteration {
  number: number
  prompt: string                // Prompt used for this iteration
  startedAt: string
  completedAt?: string
  status: 'running' | 'completed' | 'failed'
  logPath?: string              // Path to execution log
  error?: string                // Error message if failed
}
```

## File Structure

Tasks are stored in `~/.nightshift/tasks/{project-id}/{task-id}/`:

```
~/.nightshift/tasks/
└── {project-id}/
    └── {task-id}/
        ├── manifest.json       # Task metadata
        └── iterations/
            ├── 1.log           # First execution log
            ├── 2.log           # Re-prompt log
            └── ...
```

## Key Operations

### Creating a Task

```typescript
// Renderer store action
const createTask = async (projectId: string, data: CreateTaskInput) => {
  const task = await window.api.createTask(projectId, data)
  set(state => ({ tasks: [...state.tasks, task] }))
}
```

Location: `src/renderer/src/stores/task-store.ts`

### Running a Task

1. Create git worktree for isolation
2. Spawn Claude Code process
3. Stream output to log file
4. Update status on completion

Location: `src/main/ipc/agent-handlers.ts`

### Reviewing a Task

The review interface shows:
- Diff of changes made by agent
- Full execution log
- Actions: Accept, Reject, Re-prompt

Location: `src/renderer/src/components/review/`

### Re-prompting

When re-prompting:
1. Creates new iteration
2. Appends new instructions to context
3. Runs agent again in same worktree
4. Previous changes are preserved

## Task Queue

### Queue View

The main interface displays tasks in a Kanban board:

| Backlog | In Progress | Review | Done |
|---------|-------------|--------|------|
| queued tasks | running tasks | needs_review | accepted/rejected |

### Auto-Play

When enabled, the queue automatically starts the next queued task after current task completes.

### Ordering

Tasks can be reordered via drag-and-drop. Order is persisted and respected by auto-play.

## Context Files

Tasks can include additional files for context:

```typescript
interface Task {
  contextFiles?: string[]  // Relative paths within project
}
```

These files are passed to the agent as reference material beyond the prompt.

## Integration with CLAUDE.md

If the project has a `CLAUDE.md` file, it's automatically included as context for all tasks in that project.

## Relevant Files

| File | Purpose |
|------|---------|
| `src/shared/types/task.ts` | Task type definitions |
| `src/main/storage/task-store.ts` | Task persistence |
| `src/main/ipc/task-handlers.ts` | Task IPC handlers |
| `src/renderer/src/stores/task-store.ts` | Task UI state |
| `src/renderer/src/views/QueueView.tsx` | Queue board view |
| `src/renderer/src/components/tasks/` | Task components |
| `src/renderer/src/components/queue/` | Kanban components |
