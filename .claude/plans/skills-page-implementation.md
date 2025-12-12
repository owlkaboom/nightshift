# Skills Page Implementation Plan

## Overview

Promote Skills from a hidden settings panel to a first-class top-level page with enhanced discoverability and AI-assisted skill management capabilities.

## Goals

1. Make Skills discoverable via main navigation
2. Provide AI-assisted skill suggestions based on project analysis
3. Enable importing skills from GitHub repositories
4. Help users identify skill overlaps and gaps across projects

---

## Implementation Steps

### Phase 1: Navigation & Route Setup

**1.1 Add Skills route**
- Create `src/renderer/src/routes/skills.tsx` - new route file
- Export route configuration pointing to SkillsView

**1.2 Update Sidebar navigation**
- Add Skills nav item to `src/renderer/src/components/layout/Sidebar.tsx`
- Position after Planning in the nav list
- Use `Sparkles` icon (already imported in SkillsManager)
- Assign keyboard shortcut `K` (for sKills, since S is taken by Schedule)

**1.3 Update NavItem type**
- Add `/skills` to the union type in Sidebar.tsx

---

### Phase 2: SkillsView - Main Page Component

**2.1 Create SkillsView**
- Create `src/renderer/src/views/SkillsView.tsx`
- Split-panel layout similar to NotesView:
  - Left sidebar: Skills list grouped by category
  - Right panel: Contextual content (skill details, suggestions, import)

**2.2 Layout structure**
```
┌─────────────────────────────────────────────────────────────┐
│ Header: "Skills" + action buttons                           │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  Skills      │  Tab Content:                                │
│  List        │  - My Skills (detail/edit view)              │
│  (grouped    │  - Suggestions (AI recommendations)          │
│  by          │  - Import (GitHub URL input)                 │
│  category)   │                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

**2.3 Tab-based right panel**
- **My Skills tab**: Show selected skill details, edit capability
- **Suggestions tab**: AI-powered recommendations based on projects
- **Import tab**: GitHub URL import interface

---

### Phase 3: AI-Assisted Skill Suggestions

**3.1 Project analysis trigger**
- On-demand analysis via "Analyze Projects" button
- Select which project(s) to analyze
- Uses existing `skill-recommender.ts` and `skill-templates.ts`

**3.2 Suggestions UI component**
- Create `src/renderer/src/components/skills/SkillSuggestions.tsx`
- Display recommendations grouped by priority (high/medium/low)
- Show reasoning for each suggestion
- One-click "Add Skill" from suggestion
- Bulk selection and import

**3.3 IPC handlers for project analysis**
- Add `skill:analyzeProject` handler to analyze a project's tech stack
- Returns `SkillRecommendation[]` from the recommender

---

### Phase 4: GitHub Import Feature

**4.1 Import UI component**
- Create `src/renderer/src/components/skills/SkillImport.tsx`
- GitHub URL input field
- Support formats:
  - `https://github.com/user/repo` (looks for skills in root or common paths)
  - `https://github.com/user/repo/tree/main/skills` (specific folder)
  - Raw file URLs for single skill files

**4.2 Backend GitHub fetching**
- Create `src/main/skills/github-importer.ts`
- Use GitHub API to fetch repo contents
- Parse skill definitions (support JSON and markdown formats)
- Handle rate limiting gracefully

**4.3 IPC handlers**
- Add `skill:fetchFromGitHub` handler
- Add `skill:importFromGitHub` handler (actually imports selected skills)

**4.4 Preview & selection**
- Show fetched skills in a preview list
- Allow user to select which skills to import
- Show diff if skill name already exists locally

---

### Phase 5: Skill Detail & Management

**5.1 Enhanced skill detail view**
- Create `src/renderer/src/components/skills/SkillDetail.tsx`
- Full skill information display
- Edit mode for custom skills
- "Used by" section showing which tasks use this skill
- Preview of prompt content

**5.2 Skill overlap analysis**
- Show which projects have similar/overlapping skills enabled
- Suggest consolidation opportunities

---

### Phase 6: Update Exports & Cleanup

**6.1 Update component exports**
- Update `src/renderer/src/components/skills/index.ts`
- Update `src/renderer/src/views/index.ts`

**6.2 Remove from Settings**
- Remove SkillsManager from SettingsView (or keep a link to Skills page)
- Add "Manage Skills" link in settings pointing to /skills

**6.3 Update keyboard shortcuts**
- Register `K` shortcut globally to navigate to Skills page

---

## File Changes Summary

### New Files
- `src/renderer/src/routes/skills.tsx`
- `src/renderer/src/views/SkillsView.tsx`
- `src/renderer/src/components/skills/SkillSuggestions.tsx`
- `src/renderer/src/components/skills/SkillImport.tsx`
- `src/renderer/src/components/skills/SkillDetail.tsx`
- `src/main/skills/github-importer.ts`

### Modified Files
- `src/renderer/src/components/layout/Sidebar.tsx` - Add nav item
- `src/renderer/src/views/index.ts` - Export SkillsView
- `src/renderer/src/components/skills/index.ts` - Export new components
- `src/main/ipc/skill-handlers.ts` - Add new IPC handlers
- `src/shared/ipc-types.ts` - Add new IPC types
- `src/preload/index.ts` - Expose new IPC methods
- `src/renderer/src/stores/skill-store.ts` - Add new actions
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` - Register K shortcut

---

## Technical Notes

### GitHub API Integration
- Use unauthenticated API for public repos (60 requests/hour limit)
- Consider adding optional GitHub token setting for higher limits
- Cache fetched repo contents to avoid repeated requests

### Skill File Format Support
- JSON: `{ name, description, prompt, icon?, category? }`
- Markdown: Parse frontmatter for metadata, body as prompt

### Existing Infrastructure to Leverage
- `skill-recommender.ts` - Already has project analysis logic
- `skill-templates.ts` - 40+ pre-defined skill templates
- `useSkillStore` - Zustand store with full CRUD
- `SkillsManager` - Can repurpose parts for the list view
