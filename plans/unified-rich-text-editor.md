# Unified RichTextEditor Component Plan

## Overview

Consolidate `NoteEditor` and `TaskPromptEditor` into a single, configurable `RichTextEditor` component to reduce code duplication and ensure consistent behavior across the app.

## Current State

| Component | Lines | Used In |
|-----------|-------|---------|
| `NoteEditor` | 358 | NoteDialog (1 location) |
| `TaskPromptEditor` | 251 | VoiceTaskDialog, AddTaskDialog, EditTaskDialog, ConvertToTaskDialog, CreateTaskFromPlanningDialog (5 locations) |
| `MarkdownRenderer` | 168 | TaskCard, TaskDetailView (read-only display) |

**Problems:**
- ~150 lines of duplicated code (ToolbarButton, Toolbar, paste handling, content sync effects)
- Duplicate `isMarkdown()` functions in `markdown-to-html.ts` and `markdown-renderer.tsx`
- Inconsistent onChange signatures between editors

## Proposed Solution

### New Component: `RichTextEditor`

**Location:** `src/renderer/src/components/ui/rich-text-editor/index.tsx`

```typescript
interface RichTextEditorProps {
  // Content
  content?: string
  placeholder?: string
  onChange?: (html: string, plainText: string) => void
  onBlur?: () => void

  // Variant presets
  variant?: 'full' | 'compact' | 'minimal'

  // Feature toggles (override variant defaults)
  features?: {
    headings?: boolean      // H1, H2, H3 buttons
    mentions?: boolean      // @ and # mentions
    taskLists?: boolean     // Checkbox lists
    highlight?: boolean     // Text highlight
    strikethrough?: boolean // Strikethrough text
    blockquotes?: boolean   // Quote blocks
  }

  // Toolbar control
  showToolbar?: boolean

  // Sizing
  minHeight?: string
  maxHeight?: string

  // State
  editable?: boolean
  autoFocus?: boolean
  className?: string

  // Mentions (when features.mentions = true)
  getProjects?: () => Promise<Array<{ id: string; name: string }>>
  getTags?: () => Promise<Array<{ id: string; name: string; color?: string }>>
}
```

### Variant Presets

| Variant | Features | Use Case |
|---------|----------|----------|
| `full` | All features including headings, mentions, task lists, highlight, strikethrough, blockquotes | Notes |
| `compact` | Bold, italic, code, links, lists, undo/redo | Task prompts |
| `minimal` | Bold, italic, code only | Comments, quick inputs |

### Migration Mapping

| Current | New |
|---------|-----|
| `NoteEditor` | `<RichTextEditor variant="full" ... />` |
| `TaskPromptEditor` | `<RichTextEditor variant="compact" ... />` |

---

## Implementation Steps

### Step 1: Create shared toolbar infrastructure
**File:** `src/renderer/src/components/ui/rich-text-editor/toolbar.tsx`

- Extract `ToolbarButton` component (shared between variants)
- Create `ToolbarGroup` for button groupings with dividers
- Create toolbar button configs (icon, action, isActive check, title)
- Support different icon sizes for full vs compact variants

### Step 2: Create the unified RichTextEditor
**File:** `src/renderer/src/components/ui/rich-text-editor/index.tsx`

- Combine logic from both editors
- Implement variant system with feature flags
- Consolidate the three useEffect hooks:
  - Paste handling (Shift+Paste for markdown conversion)
  - Content sync when props change
  - Editable state updates
- Normalize onChange signature to `(html, plainText)`
- Support variant-specific styling (full has larger padding, first-line title styling)

### Step 3: Consolidate isMarkdown utility
**File:** `src/renderer/src/lib/markdown-to-html.ts`

- Keep single `isMarkdown()` function here (already exported)
- Update `MarkdownRenderer` to import from this location instead of defining its own

### Step 4: Update NoteDialog
**File:** `src/renderer/src/components/notes/NoteDialog.tsx`

Replace:
```tsx
<NoteEditor
  content={content}
  onChange={handleContentChange}
  getProjects={getProjects}
  getTags={getTags}
  ...
/>
```

With:
```tsx
<RichTextEditor
  variant="full"
  content={content}
  onChange={handleContentChange}
  getProjects={getProjects}
  getTags={getTags}
  ...
/>
```

### Step 5: Update task dialogs (5 files)

Files to update:
- `src/renderer/src/components/tasks/AddTaskDialog.tsx`
- `src/renderer/src/components/tasks/EditTaskDialog.tsx`
- `src/renderer/src/components/tasks/VoiceTaskDialog.tsx`
- `src/renderer/src/components/notes/ConvertToTaskDialog.tsx`
- `src/renderer/src/components/planning/CreateTaskFromPlanningDialog.tsx`

Replace `TaskPromptEditor` with `<RichTextEditor variant="compact" ... />`

### Step 6: Delete old components

- Delete `src/renderer/src/components/notes/NoteEditor.tsx`
- Delete `src/renderer/src/components/tasks/TaskPromptEditor.tsx`

### Step 7: Update MarkdownRenderer

- Import `isMarkdown` from `@/lib/markdown-to-html`
- Remove duplicate `isMarkdown()` function definition

---

## File Structure

```
src/renderer/src/components/ui/
├── rich-text-editor/
│   ├── index.tsx           # Main component + re-export
│   ├── toolbar.tsx         # ToolbarButton, ToolbarGroup, button configs
│   └── styles.ts           # Variant-specific Tailwind class configs
└── markdown-renderer.tsx   # (unchanged, just import fix)
```

---

## Detailed Component Design

### Toolbar Button Configuration

```typescript
interface ToolbarButtonConfig {
  id: string
  icon: LucideIcon
  action: (editor: Editor) => void
  isActive: (editor: Editor) => boolean
  title: string
  shortcut?: string  // e.g., "Cmd+B"
}

// Grouped by toolbar section
const TOOLBAR_GROUPS = {
  headings: ['h1', 'h2', 'h3'],
  formatting: ['bold', 'italic', 'strikethrough', 'code', 'highlight', 'link'],
  lists: ['bulletList', 'orderedList', 'taskList', 'blockquote'],
  history: ['undo', 'redo']
}
```

### Variant Feature Defaults

```typescript
const VARIANT_FEATURES = {
  full: {
    headings: true,
    mentions: true,
    taskLists: true,
    highlight: true,
    strikethrough: true,
    blockquotes: true
  },
  compact: {
    headings: false,
    mentions: false,
    taskLists: false,
    highlight: false,
    strikethrough: false,
    blockquotes: false
  },
  minimal: {
    headings: false,
    mentions: false,
    taskLists: false,
    highlight: false,
    strikethrough: false,
    blockquotes: false
  }
}
```

### Styling by Variant

| Aspect | `full` | `compact` |
|--------|--------|-----------|
| Toolbar padding | `px-4 py-3` | `px-2 py-1.5` |
| Button size | `h-8 w-8` | `h-7 w-7` |
| Icon size | `h-4 w-4` | `h-3.5 w-3.5` |
| Editor padding | `px-8 py-6` | `px-3 py-2` |
| Min height | `300px` | `150px` |
| First-line title | Yes | No |
| Prose size | `prose-base` | `prose-sm` |

---

## Estimated Impact

- **Lines removed:** ~300 (duplicated code from NoteEditor + TaskPromptEditor)
- **Lines added:** ~400 (unified component with better organization)
- **Net:** Slight increase but much better maintainability
- **Files modified:** 8 total
  - 1 new directory with 3 files
  - 6 consumer updates
  - 2 deletions

---

## Testing Checklist

After implementation, verify each use case:

- [ ] **Notes (NoteDialog):**
  - Full toolbar with H1-H3, all formatting options
  - @project mentions work
  - #tag mentions work
  - First line styled as title
  - Shift+Paste converts markdown

- [ ] **Add Task (AddTaskDialog):**
  - Compact toolbar (bold, italic, code, link, lists)
  - Voice recording red ring visual feedback
  - Min/max height constraints

- [ ] **Edit Task (EditTaskDialog):**
  - Loads existing task prompt content
  - Compact toolbar
  - Cmd+Enter saves

- [ ] **Voice Task (VoiceTaskDialog):**
  - Prompt step: editable with voice feedback
  - Confirm step: read-only mode (`editable={false}`)

- [ ] **Convert Note (ConvertToTaskDialog):**
  - Pre-populated with note content
  - Compact toolbar

- [ ] **Planning Task (CreateTaskFromPlanningDialog):**
  - Pre-populated from planning session
  - Compact toolbar

- [ ] **General:**
  - Shift+Paste converts markdown in all editors
  - Content syncs when props change
  - Read-only mode hides toolbar
