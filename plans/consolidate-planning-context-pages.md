# Consolidate Planning and Context Pages

## Overview

This plan addresses the question of whether to consolidate the **Planning** and **Context** pages, which both offer AI chat experiences but serve different purposes. The recommendation is to **consolidate Context into Project Detail View** and **unify the AI chat experience under Planning**.

## Current State Analysis

### Planning Page (`/planning`)
- **Purpose**: AI-assisted feature planning with multi-turn conversations
- **Session Types**: `general` and `init` (filters out `claude-md`)
- **Output**: Plan files in `plans/` directory, converts to tasks
- **Key Features**:
  - Session list sidebar
  - Streaming chat with activity indicators
  - Plan extraction panel
  - Task creation from plans/sections
  - Plan file viewer

### Context Page (`/context`)
- **Purpose**: CLAUDE.md quality management with improvement suggestions
- **Session Type**: `claude-md` only
- **Output**: Updates to CLAUDE.md and `.claude/docs/` sub-files
- **Key Features**:
  - Quality score analysis with breakdown
  - "What's Missing" recommendations
  - Direct CLAUDE.md editor
  - Sub-file management
  - AI Assistant tab for improvements

### Project Detail View (`/projects/$projectId`)
- **Purpose**: Project administration dashboard
- **Tabs**: Overview, Source Control, Context (simplified), Activity
- **Context Tab**: Currently just shows quality score + link to full Context page

## Recommended Approach

### Remove the standalone Context page and:

1. **Embed full Context management in Project Detail View**
   - Move the Overview, Edit, and Sub-files tabs into Project Detail
   - Quality score, recommendations, and editing all live in Project Detail

2. **Use Planning for all AI conversations**
   - When user clicks "Improve with AI" or "Add [section]" from Project Detail:
     - Create a `claude-md` planning session with pre-baked context
     - Navigate to Planning page with that session selected
   - This consolidates all AI chat into one place

## Benefits

| Benefit | Description |
|---------|-------------|
| **Simpler navigation** | Users don't need to remember two places for AI conversations |
| **Context where it belongs** | CLAUDE.md management is per-project, so it fits in Project Detail |
| **Unified chat experience** | All AI interactions happen in Planning with different session types |
| **Reduced code duplication** | One chat component, one session management system |
| **Clear mental model** | "Project Detail = project config, Planning = AI conversations" |

## Implementation Plan

### Phase 1: Enhance Project Detail Context Tab

Expand the Context tab in `ProjectDetailView.tsx` to include full CLAUDE.md management:

- [ ] Move quality analysis UI (score breakdown, status) from `ProjectContextView`
- [ ] Add CLAUDE.md editor tab
- [ ] Add sub-files management tab
- [ ] Add "What's Missing" section with action buttons
- [ ] Keep the compact card-based layout but with expandable sections

### Phase 2: Create "Update Documentation" Flow

When user wants AI help with CLAUDE.md:

- [ ] Add "Improve with AI" button in Project Detail Context tab
- [ ] Create helper function to generate planning session with pre-baked prompt:
  ```typescript
  async function startDocumentationSession(projectId: string, initialPrompt?: string) {
    const session = await createSession({
      projectId,
      sessionType: 'claude-md',
      initialMessage: initialPrompt || 'Help me improve my CLAUDE.md documentation'
    })
    navigate({ to: '/planning', search: { sessionId: session.id } })
  }
  ```
- [ ] Add route parameter support in Planning to select specific session on load
- [ ] Connect "Add [section]" buttons to this flow with pre-populated prompts

### Phase 3: Update Planning Page

Modify Planning to handle `claude-md` sessions properly:

- [ ] Remove the filter that hides `claude-md` sessions (line 262-264 in PlanningView)
- [ ] Add visual distinction for `claude-md` sessions (different icon/badge)
- [ ] Support URL param for session selection (`/planning?sessionId=xxx`)
- [ ] When in `claude-md` session, show relevant actions:
  - "Apply to CLAUDE.md" button
  - Link back to Project Detail Context tab

### Phase 4: Remove Context Page

- [ ] Delete `ProjectContextView.tsx`
- [ ] Delete `src/renderer/src/routes/context.tsx`
- [ ] Remove Context from sidebar navigation
- [ ] Update any links/references to `/context` route

### Phase 5: Migrate Components

Move reusable components:

- [ ] Move `ClaudeMdChatPanel` logic into standard planning chat (or remove if redundant)
- [ ] Keep `ScoreBreakdown` component for use in Project Detail
- [ ] Update imports and paths

## Technical Details

### Session Type Handling

Currently, session types are:
- `general` - Open-ended planning
- `init` - Project initialization
- `claude-md` - CLAUDE.md improvements

The `claude-md` type will continue to work, but sessions will be visible in Planning page.

### Navigation Flow

```
Project Detail View
    └── Context Tab
        ├── Quality Overview (inline)
        ├── Edit CLAUDE.md (inline)
        ├── Sub-files (inline)
        └── [Improve with AI] → Creates claude-md session → Navigates to /planning?sessionId=xxx
                                                                    ↓
                                                            Planning View
                                                            (claude-md session selected)
                                                                    ↓
                                                            [Apply Changes] → Updates CLAUDE.md
                                                                            → Navigates back to Project Detail
```

### URL Structure

Add query parameter support to Planning route:

```typescript
// routes/planning.tsx
export const Route = createFileRoute('/planning')({
  validateSearch: (search: Record<string, unknown>) => ({
    sessionId: search.sessionId as string | undefined
  }),
  component: PlanningView
})
```

### State Sync

When applying changes from a `claude-md` planning session:

1. User clicks "Apply to CLAUDE.md" in Planning
2. Extract the suggested content from the assistant's last message
3. Call `window.api.updateClaudeMd(projectId, newContent)`
4. Show success notification
5. Optionally navigate back to Project Detail

## Alternative Approaches Considered

### Keep Both Pages

- **Pro**: No migration work needed
- **Con**: Confusing UX, users don't know which to use
- **Con**: Duplicated AI chat implementations

### Merge Everything into Planning

- **Pro**: Single page for all AI interactions
- **Con**: CLAUDE.md management (editing, sub-files) doesn't fit chat paradigm
- **Con**: Loses the structured quality analysis view

### Create New Unified "AI" Page

- **Pro**: Fresh start, clean design
- **Con**: More work, introduces third page during transition
- **Con**: "AI" is vague - what does it do?

## Decision

**Recommended**: Consolidate Context into Project Detail + use Planning for AI chats

This approach:
- Respects the natural grouping (project config vs. AI conversations)
- Minimizes code changes (mostly moving existing components)
- Creates clear user mental model
- Reduces navigation complexity

## Design Decisions

1. **Session visibility**: All session types (`general`, `init`, `claude-md`) will be shown together in the Planning session list. A small badge will distinguish documentation sessions (e.g., "Docs" badge on `claude-md` sessions).

2. **Apply flow**: TBD - likely stay in Planning with success toast, since user may want to continue the conversation.

3. **Quality metrics in Planning**: TBD - consider showing a small CLAUDE.md quality indicator when in a `claude-md` session.

## Files to Modify

| File | Change |
|------|--------|
| `ProjectDetailView.tsx` | Expand Context tab with full management UI |
| `PlanningView.tsx` | Add URL param support, show `claude-md` sessions |
| `routes/planning.tsx` | Add search param validation |
| `ProjectContextView.tsx` | Delete after migration |
| `routes/context.tsx` | Delete after migration |
| `Sidebar.tsx` (or equivalent) | Remove Context nav item |
| `planning-store.ts` | Add helper for creating pre-filled sessions |

## Tasks Checklist

### Phase 1: Project Detail Enhancement
- [ ] Create expanded `ContextTab` component with full management
- [ ] Add tab navigation within Context (Overview/Edit/Sub-files)
- [ ] Move quality analysis components
- [ ] Add "Improve with AI" action button

### Phase 2: Planning Integration
- [ ] Add URL search param support to Planning route
- [ ] Load specific session from URL param on mount
- [ ] Remove `claude-md` filter from session list
- [ ] Add "Docs" badge for `claude-md` sessions in `PlanningSessionList`
- [ ] Consider different icon for docs sessions (e.g., `FileText` instead of `MessageSquare`)

### Phase 3: Navigation Flow
- [ ] Create `startDocumentationSession` helper
- [ ] Wire up "Improve with AI" button
- [ ] Wire up "Add [section]" buttons with pre-filled prompts
- [ ] Add "Apply Changes" action in Planning for `claude-md` sessions

### Phase 4: Cleanup
- [ ] Delete `ProjectContextView.tsx`
- [ ] Delete `routes/context.tsx`
- [ ] Update sidebar navigation
- [ ] Update any tests referencing Context page
- [ ] Run typecheck and lint to verify no broken imports
