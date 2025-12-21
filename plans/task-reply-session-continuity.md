# Plan: Task Reply with Session Continuity

## Overview

Add a "Reply" feature that continues a Claude Code conversation using `--resume`, allowing users to answer agent questions without re-including context. Keep existing "Re-prompt" for starting fresh.

## Key Design Decisions

1. **Reply vs Re-prompt**: Two distinct actions
   - **Reply**: Continues conversation (uses `--resume sessionId`)
   - **Re-prompt**: Starts fresh (clears sessionId)

2. **Agent Support**: Reply only available for Claude Code (Gemini/OpenRouter don't support session resume)

3. **UI**: Full rich text editor (same as Re-prompt dialog for consistency)

4. **Availability**: Reply available for both `needs_review` and `failed` tasks (if sessionId exists)

---

## Implementation Steps

### Phase 1: Data Model

**1.1 Add sessionId to TaskManifest** (`src/shared/types/task.ts`)
```typescript
// Add to TaskManifest interface:
sessionId?: string | null
```

**1.2 Add to TaskIteration** (`src/shared/types/task.ts`)
```typescript
// Add to TaskIteration interface:
sessionId?: string | null
isReply?: boolean
```

**1.3 Update createTaskManifest** (`src/shared/types/task.ts`)
- Add `sessionId: null` to defaults

**1.4 Database Migration** (`src/main/storage/migrations/schema.ts`)
```sql
ALTER TABLE tasks ADD COLUMN session_id TEXT DEFAULT NULL;
```

**1.5 Update row conversion** (`src/main/storage/sqlite/task-store.ts`)
- Add `session_id` to `rowToTask()` and `taskToParams()`

---

### Phase 2: Session ID Capture

**2.1 Add sessionId to AgentOutputEvent** (`src/shared/types/agent.ts`)
```typescript
export interface AgentOutputEvent {
  // ... existing fields
  sessionId?: string  // NEW
}
```

**2.2 Extract session_id in parseLine** (`src/main/agents/adapters/claude-code.ts`)
- Parse `session_id` from JSON output
- Include in returned AgentOutputEvent

**2.3 Capture in agent-handlers** (`src/main/ipc/agent-handlers.ts`)
- In `handleComplete`, extract sessionId from outputLog
- Pass to `completeIteration()`

**2.4 Store in completeIteration** (`src/main/storage/sqlite/task-store.ts`)
- Add sessionId parameter to `completeIteration()`
- Save to task manifest and iteration record

---

### Phase 3: Reply Execution

**3.1 Add --resume support to invoke()** (`src/main/agents/adapters/claude-code.ts`)
```typescript
// In invoke(), after other args:
const resumeSessionId = options.agentOptions?.resumeSessionId as string | undefined
if (resumeSessionId) {
  args.push('--resume', resumeSessionId)
}
```

**3.2 Create startReplyIteration** (`src/main/storage/sqlite/task-store.ts`)
```typescript
export async function startReplyIteration(
  projectId: string,
  taskId: string,
  replyMessage: string
): Promise<TaskManifest | null>
```
- Validates task has sessionId
- Sets status to 'queued', increments iteration
- Preserves sessionId (unlike startNewIteration which clears it)

**3.3 Add task:reply IPC handler** (`src/main/ipc/task-handlers.ts`)
```typescript
ipcMain.handle('task:reply', async (_, projectId, taskId, replyMessage) => {
  return startReplyIteration(projectId, taskId, replyMessage)
})
```

**3.4 Modify startNewIteration to clear sessionId** (`src/main/storage/sqlite/task-store.ts`)
- Add `sessionId: null` to updateTask call

**3.5 Update agent:startTask** (`src/main/ipc/agent-handlers.ts`)
- Detect if task has sessionId (is a reply)
- Pass `resumeSessionId` in agentOptions

---

### Phase 4: Frontend

**4.1 Update IPC types** (`src/shared/ipc-types.ts`, `src/preload/index.ts`)
- Add `task:reply` handler type
- Add `replyToTask` to preload API

**4.2 Add to task store** (`src/renderer/src/stores/task-store.ts`)
```typescript
replyToTask: async (projectId, taskId, replyMessage) => { ... }
```

**4.3 Create ReplyDialog** (`src/renderer/src/components/review/ReplyDialog.tsx`)
- Full rich text editor (same as RepromptDialog)
- Shows last agent message as context
- "Send Reply" button

**4.4 Update TaskDetailView** (`src/renderer/src/components/review/TaskDetailView.tsx`)
- Add Reply button for both `needs_review` and `failed` (only for Claude Code + has sessionId)
- Wire up ReplyDialog
- Keep existing Re-prompt button

---

## File Summary

| File | Changes |
|------|---------|
| `src/shared/types/task.ts` | Add sessionId to TaskManifest, TaskIteration |
| `src/shared/types/agent.ts` | Add sessionId to AgentOutputEvent |
| `src/main/storage/migrations/schema.ts` | Add session_id column migration |
| `src/main/storage/sqlite/task-store.ts` | Add startReplyIteration, update row conversion, update completeIteration |
| `src/main/agents/adapters/claude-code.ts` | Extract session_id in parseLine, add --resume to invoke |
| `src/main/ipc/agent-handlers.ts` | Capture sessionId, pass resumeSessionId |
| `src/main/ipc/task-handlers.ts` | Add task:reply handler |
| `src/shared/ipc-types.ts` | Add task:reply type |
| `src/preload/index.ts` | Add replyToTask |
| `src/renderer/src/stores/task-store.ts` | Add replyToTask action |
| `src/renderer/src/components/review/ReplyDialog.tsx` | NEW - Reply dialog component |
| `src/renderer/src/components/review/TaskDetailView.tsx` | Add Reply button |

---

## Edge Cases

1. **No sessionId**: Reply button hidden, only Re-prompt available
2. **Session expired**: If --resume fails, show error suggesting Re-prompt
3. **Non-Claude agents**: Reply button only shown for Claude Code
4. **Iteration history**: Track `isReply: true` to distinguish from fresh re-prompts
