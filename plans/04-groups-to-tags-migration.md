# Plan: Groups to Tags Migration

## Overview

Replace the hierarchical Groups system with a simpler flat Tags system. This reduces complexity while maintaining organizational capabilities.

## Current State (Groups)

### Files to Remove/Modify

**Types:**
- `src/shared/types/group.ts` - Full removal (Group, GroupTreeNode, GroupsRegistry, MAX_GROUP_NESTING_DEPTH, GROUP_COLORS, GROUP_ICONS)

**Storage:**
- `src/main/storage/group-store.ts` - Replace with tag-store.ts
- `~/.nightshift/sync/groups.json` - Migrate to tags.json

**IPC:**
- `src/main/ipc/group-handlers.ts` - Replace with tag-handlers.ts
- `src/shared/ipc-types.ts` - Remove all `group:*` channels, add `tag:*` channels

**Renderer:**
- `src/renderer/src/views/GroupsView.tsx` - Replace with TagsView.tsx (much simpler)
- `src/renderer/src/stores/group-store.ts` - Replace with tag-store.ts
- Components using groups (Sidebar, filters, etc.)

**Features to Remove:**
- Parent-child relationships / tree nesting
- Tree rendering / breadcrumb navigation
- Context generation from hierarchy
- 5-level nesting depth limit
- Group ancestors/descendants operations

## Target State (Tags)

### New Type Definition

```typescript
// src/shared/types/tag.ts

export interface Tag {
  id: string           // tag_xxx
  name: string         // Display name
  color: string | null // Optional color (hex)
  createdAt: string
}

export interface TagsRegistry {
  tags: Tag[]
}

export const TAG_COLORS = [
  '#4A90D9', // Blue
  '#7B68EE', // Purple
  '#3CB371', // Green
  '#FF6B6B', // Red
  '#FFB347', // Orange
  '#20B2AA', // Teal
  '#DDA0DD', // Plum
  '#87CEEB'  // Sky Blue
] as const

export function generateTagId(): string {
  return `tag_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}
```

### Tag Associations

Tags will be associated with:
- **Projects** - `project.tagIds: string[]`
- **Tasks** - `task.tagIds: string[]` (optional, for filtering)

### New IPC Channels

```typescript
// Replace group:* with tag:*
'tag:list': () => Promise<Tag[]>
'tag:get': (id: string) => Promise<Tag | null>
'tag:create': (name: string, color?: string) => Promise<Tag>
'tag:update': (id: string, updates: Partial<Tag>) => Promise<Tag | null>
'tag:delete': (id: string) => Promise<boolean>
'tag:getForProject': (projectId: string) => Promise<Tag[]>
```

### UI Changes

**TagsView (simplified from GroupsView):**
- Simple list/grid of tags with color chips
- Create/edit/delete tags
- No tree structure, no nesting
- Click tag to filter projects by that tag

**Sidebar:**
- Replace Groups section with Tags section
- Flat list of tags, click to filter
- "All Projects" option to clear filter

**Project association:**
- Multi-select tag picker on project edit
- Display tags as colored chips on project cards

## Migration Steps

### Phase 1: Create Tag Infrastructure

1. Create `src/shared/types/tag.ts` with Tag interface
2. Create `src/main/storage/tag-store.ts`
3. Create `src/main/ipc/tag-handlers.ts`
4. Add tag IPC channels to `ipc-types.ts`
5. Wire up handlers in `src/main/ipc/index.ts`

### Phase 2: Add Tag Fields to Projects

1. Add `tagIds: string[]` to Project interface
2. Update project store to handle tags
3. Add tag picker component to project edit dialog
4. Display tags on project cards

### Phase 3: Create Tags UI

1. Create simple `TagsView.tsx` (list view with create/edit/delete)
2. Create `TagChip.tsx` component for display
3. Create `TagPicker.tsx` for multi-select
4. Add Tags to sidebar navigation

### Phase 4: Data Migration

1. Create migration script: groups.json -> tags.json
   - Each group becomes a tag (flatten hierarchy)
   - Preserve name and color
   - Map group.projectIds to project.tagIds
2. Run migration on app startup if groups.json exists and tags.json doesn't
3. Keep groups.json as backup initially

### Phase 5: Remove Groups Code

1. Delete `src/shared/types/group.ts`
2. Delete `src/main/storage/group-store.ts`
3. Delete `src/main/ipc/group-handlers.ts`
4. Delete `src/renderer/src/views/GroupsView.tsx`
5. Delete `src/renderer/src/stores/group-store.ts`
6. Remove group IPC channels from `ipc-types.ts`
7. Remove group handlers from IPC index
8. Update Sidebar to use tags instead of groups
9. Remove group references from notes (mentions)

### Phase 6: Cleanup

1. Remove GROUP_ICONS constant (not needed for simple tags)
2. Update any remaining group references in codebase
3. Remove group-related menu items
4. Update tests if any exist

## Notes on Note Mentions

Currently notes support `#group` mentions. Options:
1. **Keep as `#tag`** - Simple rename, same functionality
2. **Remove tag mentions** - Simplify notes to just `@project` mentions
3. **Keep both temporarily** - Migrate gradually

Recommendation: Keep as `#tag` mentions for consistency.

## Files Changed Summary

| Action | File |
|--------|------|
| Create | `src/shared/types/tag.ts` |
| Create | `src/main/storage/tag-store.ts` |
| Create | `src/main/ipc/tag-handlers.ts` |
| Create | `src/renderer/src/views/TagsView.tsx` |
| Create | `src/renderer/src/stores/tag-store.ts` |
| Create | `src/renderer/src/components/tags/TagChip.tsx` |
| Create | `src/renderer/src/components/tags/TagPicker.tsx` |
| Modify | `src/shared/types/project.ts` (add tagIds) |
| Modify | `src/shared/ipc-types.ts` |
| Modify | `src/main/ipc/index.ts` |
| Modify | `src/renderer/src/components/layout/Sidebar.tsx` |
| Modify | `src/preload/index.ts` |
| Delete | `src/shared/types/group.ts` |
| Delete | `src/main/storage/group-store.ts` |
| Delete | `src/main/ipc/group-handlers.ts` |
| Delete | `src/renderer/src/views/GroupsView.tsx` |
| Delete | `src/renderer/src/stores/group-store.ts` |

## Risk Assessment

- **Low risk**: Most changes are additive then subtractive
- **Data migration**: One-time, with backup preserved
- **Breaking change**: Users with complex group hierarchies lose nesting (by design)
