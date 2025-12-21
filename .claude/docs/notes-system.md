# Notes System

Rich text note-taking with project context, @mentions, and vault storage.

## Overview

The notes system provides a way to capture ideas, requirements, and context that can be referenced during task creation and planning.

```
┌─────────────────────────────────────────────────────────────┐
│                      Notes System                            │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  TipTap     │  │  @Mentions  │  │   Groups    │         │
│  │  Editor     │  │   System    │  │   (Folders) │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                  │
│         └────────────────┴────────────────┘                  │
│                          │                                   │
│                   ┌──────┴──────┐                            │
│                   │  Note Store │                            │
│                   └──────┬──────┘                            │
│                          │                                   │
│              ┌───────────┴───────────┐                       │
│              │                       │                       │
│       ┌──────┴──────┐         ┌──────┴──────┐               │
│       │   SQLite    │         │    Vault    │               │
│       │  (metadata) │         │  (content)  │               │
│       └─────────────┘         └─────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Rich Text Editor

TipTap-based editor with formatting support:

| Feature | Description |
|---------|-------------|
| Text Formatting | Bold, italic, strikethrough, code |
| Headings | H1, H2, H3 support |
| Lists | Ordered and unordered lists |
| Code Blocks | Syntax-highlighted code |
| Links | URL embedding |

### @Mentions

Reference projects and tasks within notes:

```
Working on @ProjectName today. Need to look at @task-123 first.
```

| Mention Type | Trigger | Example |
|--------------|---------|---------|
| Project | `@` | `@nightshift` |
| Task | `@task-` | `@task-abc123` |

### Note Organization

| Feature | Description |
|---------|-------------|
| Pin Notes | Keep important notes at top |
| Archive | Hide completed notes |
| Groups | Folder-like organization |
| Drag-and-Drop | Reorder and move between groups |
| Search | Full-text search across notes |

### Note-to-Task Conversion

Convert notes directly into tasks:

1. Open note
2. Click "Create Task" button
3. Note content becomes task prompt
4. Mentioned project auto-selected

## Storage Architecture

### Dual Storage Model

Notes use a split storage approach:

| Data | Storage | Purpose |
|------|---------|---------|
| Metadata | SQLite | IDs, timestamps, mentions, flags |
| Content | Vault | Full markdown content |

### SQLite Schema

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT,
  excerpt TEXT,          -- First 200 chars for preview
  word_count INTEGER,
  mentions TEXT,         -- JSON array of mention refs
  is_pinned INTEGER DEFAULT 0,
  is_archived INTEGER DEFAULT 0,
  group_id TEXT REFERENCES note_groups(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE note_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  parent_id TEXT REFERENCES note_groups(id),
  created_at TEXT NOT NULL
);
```

### Vault Storage

Markdown files stored in configurable vault location:

```
{vault-path}/
├── notes/
│   ├── {note-id}.md     # Note content
│   └── ...
└── .nightshift/
    └── cache.json       # Metadata cache
```

**Configuration:**
- Default: `~/Documents/Nightshift`
- Configurable in Settings → Vault

## Key Files

### Main Process

| File | Purpose |
|------|---------|
| `src/main/storage/sqlite/note-store.ts` | Note CRUD operations |
| `src/main/storage/sqlite/note-groups-store.ts` | Group management |
| `src/main/storage/vault/vault-store.ts` | Vault file operations |
| `src/main/storage/vault/notes-cache.ts` | In-memory cache layer |
| `src/main/ipc/note-handlers.ts` | IPC handlers |

### Renderer

| File | Purpose |
|------|---------|
| `src/renderer/src/stores/note-store.ts` | Frontend state |
| `src/renderer/src/components/notes/` | Note UI components |
| `src/renderer/src/lib/tiptap/` | Editor extensions |
| `src/renderer/src/lib/tiptap/project-mention.ts` | @mention extension |

## TipTap Extensions

### Project Mention

Custom TipTap extension for project references:

```typescript
// src/renderer/src/lib/tiptap/project-mention.ts
export const ProjectMention = Node.create({
  name: 'projectMention',

  addAttributes() {
    return {
      id: { default: null },
      name: { default: null }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-project-mention]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', { 'data-project-mention': HTMLAttributes.id }, `@${HTMLAttributes.name}`]
  }
})
```

### Floating Suggestion

Popover for mention autocomplete:

```typescript
// src/renderer/src/lib/tiptap/floating-suggestion.ts
export const FloatingSuggestion = Extension.create({
  name: 'floatingSuggestion',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        char: '@',
        items: ({ query }) => filterProjects(query),
        render: () => ({
          onStart: (props) => showPopover(props),
          onUpdate: (props) => updatePopover(props),
          onExit: () => hidePopover()
        })
      })
    ]
  }
})
```

## API Reference

### Create Note

```typescript
const note = await window.api.createNote({
  content: '# My Note\n\nContent here...',
  groupId: 'group-id'  // optional
})
```

### Update Note

```typescript
await window.api.updateNote(noteId, {
  content: 'Updated content',
  isPinned: true
})
```

### List Notes

```typescript
// All notes
const notes = await window.api.listNotes()

// By group
const grouped = await window.api.listNotes({ groupId: 'group-id' })

// Search
const results = await window.api.searchNotes('keyword')
```

### Group Operations

```typescript
// Create group
const group = await window.api.createNoteGroup({
  name: 'Work Notes',
  color: '#3b82f6'
})

// Move note to group
await window.api.updateNote(noteId, { groupId: group.id })
```

## Caching Strategy

### Notes Cache

In-memory cache for fast access:

```typescript
// src/main/storage/vault/notes-cache.ts
class NotesCache {
  private cache: Map<string, NoteContent> = new Map()

  async get(id: string): Promise<NoteContent | null> {
    if (this.cache.has(id)) {
      return this.cache.get(id)!
    }

    const content = await this.loadFromDisk(id)
    if (content) {
      this.cache.set(id, content)
    }
    return content
  }

  async set(id: string, content: NoteContent): Promise<void> {
    this.cache.set(id, content)
    await this.saveToDisk(id, content)
  }

  invalidate(id: string): void {
    this.cache.delete(id)
  }
}
```

### Cache Invalidation

- On note update: invalidate specific note
- On vault path change: clear entire cache
- On app startup: lazy load on access

## Optimistic Updates

Note store uses optimistic updates for responsive UI:

```typescript
// src/renderer/src/stores/note-store.ts
updateNote: async (id, updates) => {
  // Optimistically update UI
  set(state => ({
    notes: state.notes.map(n =>
      n.id === id ? { ...n, ...updates } : n
    )
  }))

  try {
    // Persist to backend
    const updated = await window.api.updateNote(id, updates)
    set(state => ({
      notes: state.notes.map(n => n.id === id ? updated : n)
    }))
  } catch (error) {
    // Rollback on failure
    set(state => ({ notes: state.previousNotes }))
    throw error
  }
}
```

## Related Documentation

- [storage-layer.md](./storage-layer.md) - Database schema
- [ui-components.md](./ui-components.md) - Component patterns
- [features.md](./features.md) - Feature overview
