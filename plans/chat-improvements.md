# Chat Improvements Plan

## Summary

Three improvements to the planning/context chat interface:
1. **Input clearing** - Allow typing while agent is busy (currently blocked)
2. **Mid-stream interruption** - Send new messages that interrupt the current response
3. **Better streaming display** - Show agent activity more granularly

---

## Current State Analysis

### 1. Input Clearing Issue
**Problem**: Input is disabled entirely when `isBusy = isAwaitingResponse || isStreaming`

- `PlanningInput.tsx:50` - `isBusy` disables textarea
- `PlanningInput.tsx:104` - `canSend` checks `!isBusy`, preventing send
- `PlanningInput.tsx:179` - textarea `disabled={disabled || isBusy || isListening}`

**Root cause**: The input IS cleared after sending (line 109), but you can't TYPE a new message because the textarea is disabled while the agent is working.

### 2. Mid-stream Interruption
**Current behavior**:
- Each message spawns a new Claude Code CLI process
- stdin is closed immediately after sending the message
- No way to inject messages mid-stream
- `planning-manager.ts:76-78` throws error if session already active

**How interruption could work**:
1. Kill the current process
2. Save the partial response that was received
3. Start a new process with `--resume` and the user's new message
4. The conversation context is preserved server-side in Claude's session

### 3. Streaming Display
**Current state**:
- All streaming content is concatenated into one message
- Only `text` blocks are extracted from `assistant` events
- Tool use blocks (`tool_use`) are completely discarded in chat mode
- No distinction between different types of agent activity

**What Claude Code CLI emits** (from `AgentLogViewer` parsing):
- `type: 'assistant'` with `message.content` array containing:
  - `{ type: 'text', text: string }` - Regular text
  - `{ type: 'tool_use', name: string, input: {...} }` - Tool calls
- `type: 'result'` - Completion
- `type: 'error'` - Errors

---

## Implementation Plan

### Phase 1: Enable Input While Busy

**Files to modify:**
- `src/renderer/src/components/planning/PlanningInput.tsx`

**Changes:**
1. Remove `isBusy` from textarea disabled state - allow typing
2. Keep `isBusy` check only on the send button (can type but not send yet)
3. Add visual indicator showing a message is queued/pending
4. Store pending message in component state

### Phase 2: Mid-stream Interruption ("Send Anyway")

**Files to modify:**
- `src/renderer/src/components/planning/PlanningInput.tsx`
- `src/renderer/src/stores/planning-store.ts`
- `src/main/agents/planning-manager.ts`
- `src/main/ipc/planning-handlers.ts`
- `src/shared/ipc-types.ts`
- `src/preload/index.ts`

**Changes:**

1. **PlanningInput**: Add "Send Anyway" button when busy + message typed
   - Shows when `isBusy && message.trim().length > 0`
   - Calls new `interruptAndSend(message)` action

2. **planning-store.ts**: Add `interruptAndSend` action
   - Calls new IPC method `interruptPlanningMessage`
   - Handles state transitions properly

3. **planning-manager.ts**: Add `interruptAndSendMessage` method
   - Kill current process gracefully
   - Save partial response with "[Interrupted]" marker
   - Clear active session tracking
   - Call `sendMessage` with new message (will use `--resume`)

4. **IPC handlers**: Add `planning:interruptAndSend` handler

5. **preload/index.ts**: Expose new IPC method

### Phase 3: Better Streaming Display

**Files to modify:**
- `src/shared/types/planning.ts` - Add metadata to messages
- `src/main/agents/planning-manager.ts` - Extract more event types
- `src/renderer/src/stores/planning-store.ts` - Handle new event types
- `src/renderer/src/components/planning/PlanningChat.tsx` - Display activity indicator
- `src/preload/index.ts` & `src/shared/ipc-types.ts` - New IPC events

**Approach - Activity Indicators (Lightweight)**:
Rather than showing every tool call as a separate message (too chatty), show a subtle activity indicator below the streaming message:

1. **Extract tool use events** during streaming
2. **Show current activity** below streaming text:
   - "Reading `src/main/index.ts`..."
   - "Editing `src/components/Button.tsx`..."
   - "Running `npm test`..."
3. **Replace as activities change** - only show the most recent/current activity
4. **Fade out when complete** - hide when streaming finishes

**Data structure changes:**
```typescript
// New type for activity tracking
interface StreamingActivity {
  tool: string      // 'Read', 'Edit', 'Bash', 'Grep', etc.
  target: string    // file path, command, pattern, etc.
  timestamp: string
}

// Add to planning store state
interface PlanningState {
  // ... existing fields
  currentActivityBySession: Map<string, StreamingActivity | null>
}
```

**IPC event changes:**
```typescript
// New event for tool activity
interface PlanningActivityData {
  sessionId: string
  tool: string
  target: string
}
```

---

## Implementation Order

1. **Phase 1** (Quick win) - Enable typing while busy
2. **Phase 2** - Add interrupt capability
3. **Phase 3** - Enhanced streaming display

---

## Files Summary

| File | Phase | Changes |
|------|-------|---------|
| `src/renderer/src/components/planning/PlanningInput.tsx` | 1, 2 | Enable input, add interrupt button |
| `src/renderer/src/stores/planning-store.ts` | 2, 3 | Add interrupt action, handle activities |
| `src/main/agents/planning-manager.ts` | 2, 3 | Interrupt method, extract tool events |
| `src/main/ipc/planning-handlers.ts` | 2 | New IPC handler |
| `src/shared/ipc-types.ts` | 2, 3 | New types |
| `src/preload/index.ts` | 2, 3 | Expose new IPC methods |
| `src/shared/types/planning.ts` | 3 | Activity types |
| `src/renderer/src/components/planning/PlanningChat.tsx` | 3 | Display activity indicator |

---

## UI Mockup

### Phase 1 & 2: Input While Busy

```
┌─────────────────────────────────────────────────────────┐
│ [Streaming message from agent...]                       │
│                                                         │
│ ● Agent is typing...                                    │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Your follow-up message here...                      │ │ ← Enabled!
│ └─────────────────────────────────────────────────────┘ │
│                              [Cancel] [Send Anyway ⚡]  │
└─────────────────────────────────────────────────────────┘
```

### Phase 3: Activity Indicator

```
┌─────────────────────────────────────────────────────────┐
│ 🤖 Claude                                               │
│                                                         │
│ I'll help you implement that feature. Let me first     │
│ look at the existing code...                           │
│                                                         │
│ [streaming text continues here...]                      │
│                                                         │
│ ╭─────────────────────────────────────────────────────╮ │
│ │ 📄 Reading src/components/Button.tsx...             │ │ ← Activity
│ ╰─────────────────────────────────────────────────────╯ │
└─────────────────────────────────────────────────────────┘
```
