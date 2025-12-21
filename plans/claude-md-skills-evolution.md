# Plan: Evolving Skills to CLAUDE.md Management

## Overview

Transform the Skills feature from a Nightshift-specific concept into a **CLAUDE.md management and enhancement tool**. This aligns with Claude Code's native patterns, eliminates vendor lock-in, and provides team-shareable project context via git.

## Current State

### What Exists
- **Skills System**: 8 built-in skills, custom skill creation, per-task skill selection
- **CLAUDE.md Infrastructure**: `ClaudeConfigManager` can read/write CLAUDE.md files
- **Project Flag**: `includeClaudeMd: boolean` exists but is NOT used during task execution
- **`.claude/` Detection**: Full scanning of `.claude/skills/`, `.claude/agents/`, `.claude/commands/`

### What's Missing
- CLAUDE.md content is never injected into task context
- No UI to view/edit CLAUDE.md from Nightshift
- No onboarding flow to create CLAUDE.md for new projects
- No analysis of CLAUDE.md quality or completeness
- Skills are a parallel system, not integrated with CLAUDE.md

---

## Phase 1: Foundation - CLAUDE.md Detection & Display

**Goal**: Surface existing CLAUDE.md files in the UI so users can see what context their projects have.

### 1.1 Create CLAUDE.md Analysis Service

**New File**: `src/main/analysis/claude-md-analyzer.ts`

```typescript
interface ClaudeMdAnalysis {
  exists: boolean
  path: string | null
  content: string | null

  // Quality metrics
  lineCount: number
  sectionCount: number
  hasQuickStart: boolean
  hasCodeConventions: boolean
  hasTechStack: boolean
  hasTestingGuidelines: boolean
  hasArchitectureInfo: boolean

  // Detected sections (parsed from ## headers)
  sections: Array<{
    title: string
    lineStart: number
    lineEnd: number
    preview: string // first 100 chars
  }>

  // Sub-files in .claude/docs/
  subFiles: Array<{
    path: string
    name: string
    description: string | null
    lineCount: number
  }>

  // Quality score (0-100)
  qualityScore: number
  recommendations: string[]
}
```

**Analysis Logic**:
- Parse markdown headers to extract sections
- Check for common recommended sections
- Scan `.claude/docs/` for sub-files
- Generate quality score based on:
  - Has content (not empty): +20
  - Has 3+ sections: +20
  - Has code conventions: +15
  - Has testing guidelines: +15
  - Has architecture info: +15
  - Uses sub-files for detailed docs: +15

### 1.2 Add IPC Handlers

**File**: `src/main/ipc/claude-config-handlers.ts` (extend)

```typescript
// New handlers
'claudeConfig:analyze': (projectPath: string) => Promise<ClaudeMdAnalysis>
'claudeConfig:getSubFiles': (projectPath: string) => Promise<SubFile[]>
'claudeConfig:createSubFile': (projectPath: string, name: string, content: string) => Promise<void>
'claudeConfig:updateSubFile': (projectPath: string, name: string, content: string) => Promise<void>
'claudeConfig:deleteSubFile': (projectPath: string, name: string) => Promise<void>
```

### 1.3 Update Project Card/List to Show CLAUDE.md Status

**File**: `src/renderer/src/components/projects/ProjectCard.tsx`

Add indicator showing:
- ✅ Green: Has comprehensive CLAUDE.md (score > 70)
- 🟡 Yellow: Has basic CLAUDE.md (score 30-70)
- ❌ Red/Empty: No CLAUDE.md or very minimal (score < 30)

---

## Phase 2: Project Onboarding Flow

**Goal**: When adding a project, guide users to create or enhance their CLAUDE.md.

### 2.1 Extend AddProjectDialog with CLAUDE.md Step

**File**: `src/renderer/src/components/projects/AddProjectDialog.tsx`

Add new step after directory selection:

```
Step 1: Choose project type (git/directory)
Step 2: Select directory
Step 3: Project details (name, description)
Step 4: [NEW] CLAUDE.md Setup ←
Step 5: Confirm
```

**Step 4 Logic**:

```typescript
// After selecting directory, analyze CLAUDE.md
const analysis = await window.api.analyzeClaudeMd(projectPath)

if (!analysis.exists) {
  // Show: "No CLAUDE.md found - Let's create one!"
  // Offer: Template selection or AI-assisted generation
} else if (analysis.qualityScore < 50) {
  // Show: "Your CLAUDE.md could use some enhancement"
  // Show current sections, suggest additions
} else {
  // Show: "Great! Your project has solid AI context"
  // Display summary, offer to enhance anyway
}
```

### 2.2 Create CLAUDE.md Template System

**New File**: `src/main/templates/claude-md-templates.ts`

```typescript
interface ClaudeMdTemplate {
  id: string
  name: string
  description: string
  forProjectTypes: string[] // 'react', 'node', 'python', etc.
  content: string
}

const templates: ClaudeMdTemplate[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Basic project info and quick commands',
    content: `# {projectName}

## Quick Start
\`\`\`bash
npm install
npm run dev
\`\`\`

## Key Commands
- \`npm run build\` - Build for production
- \`npm run test\` - Run tests
`
  },
  {
    id: 'comprehensive',
    name: 'Comprehensive',
    description: 'Full project context with architecture and conventions',
    content: `# {projectName}

## Quick Start
...

## Architecture Overview
...

## Code Conventions
...

## Testing Guidelines
For detailed guidance, see \`.claude/docs/testing.md\`

## Additional Documentation
- API Guidelines: \`.claude/docs/api.md\`
- Component Standards: \`.claude/docs/components.md\`
`
  },
  // More templates...
]
```

### 2.3 AI-Assisted CLAUDE.md Generation

**New File**: `src/main/analysis/claude-md-generator.ts`

When user opts for AI generation:
1. Scan project for: package.json, tsconfig, common files
2. Detect tech stack (React, Node, Python, etc.)
3. Find existing README.md content
4. Use Claude to generate contextual CLAUDE.md draft
5. Present to user for editing before save

---

## Phase 3: Transform Skills Page → Project Context Manager

**Goal**: Repurpose the Skills page to manage CLAUDE.md and `.claude/docs/` files.

### 3.1 Rename and Restructure

**Old**: "Skills" page with skill cards
**New**: "Project Context" or "AI Guidelines" page

### 3.2 New Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Project Context                              [Project Selector]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ CLAUDE.md                                    Quality: 75/100 ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ ## Quick Start                                    [Edit]    ││
│  │ ## Architecture Overview                          [Edit]    ││
│  │ ## Code Conventions                               [Edit]    ││
│  │                                                             ││
│  │ [+ Add Section]                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Detailed Guidelines (.claude/docs/)                         ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ 📄 api-guidelines.md      "REST API conventions..."  [Edit] ││
│  │ 📄 testing.md             "Vitest patterns..."       [Edit] ││
│  │ 📄 components.md          "React component..."       [Edit] ││
│  │                                                             ││
│  │ [+ Add Guideline Document]                                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Recommendations                                             ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ ⚠️  Missing testing guidelines - Add .claude/docs/testing.md││
│  │ ⚠️  Consider adding error handling conventions              ││
│  │ ✓  Good coverage of architecture patterns                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Section Editor Component

**New File**: `src/renderer/src/components/context/SectionEditor.tsx`

- Rich markdown editor for each section
- Preview mode
- Templates for common section types
- AI assist button to enhance content

### 3.4 Sub-File Manager Component

**New File**: `src/renderer/src/components/context/SubFileManager.tsx`

- List `.claude/docs/*.md` files
- Create new files from templates
- Edit with markdown editor
- Delete with confirmation
- Show file references in main CLAUDE.md

---

## Phase 4: Legacy Skills Migration

**Goal**: Gracefully transition from skills to CLAUDE.md-based context.

### 4.1 Migration Strategy

**Option A: Skills as "Quick Add" to CLAUDE.md**
- Keep skill definitions but change action
- Clicking a skill appends its content to CLAUDE.md or creates a sub-file
- Skills become templates, not runtime injections

**Option B: Deprecate Skills Gradually**
- Add banner: "Skills are being replaced by CLAUDE.md sections"
- Provide migration tool to convert enabled skills → CLAUDE.md content
- Keep skills working for 2-3 versions, then remove

**Recommended**: Option A - Skills become templates for CLAUDE.md content

### 4.2 Migration UI

**New Component**: `src/renderer/src/components/context/SkillMigration.tsx`

```
┌────────────────────────────────────────────────────────────────┐
│ Migrate Skills to CLAUDE.md                                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ Your enabled skills can be added to your project's CLAUDE.md  │
│ for native Claude Code compatibility.                         │
│                                                                │
│ ☑️ TypeScript Expert → Add to "Code Conventions" section       │
│ ☑️ Test-Driven Development → Create .claude/docs/testing.md    │
│ ☐ React Best Practices → Add to "Code Conventions" section    │
│                                                                │
│ [Preview Changes]  [Migrate Selected]                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 4.3 Update Task Creation

**File**: `src/main/ipc/agent-handlers.ts`

Remove skill prompt injection, rely on Claude Code's native CLAUDE.md reading:

```typescript
// BEFORE (current)
const skillPrompt = await buildSkillPrompt(task.enabledSkills || [])
fullPrompt += skillPrompt

// AFTER (new)
// No skill injection needed - Claude Code reads CLAUDE.md natively
// We just ensure we're running in the project directory
```

---

## Phase 5: Team Sharing & Best Practices

**Goal**: Help teams standardize on shared CLAUDE.md patterns.

### 5.1 Export/Import Project Context

- Export: Bundle CLAUDE.md + `.claude/docs/` as JSON/zip
- Import: Apply exported bundle to another project
- Use case: Company-wide standards

### 5.2 Template Library

**New Feature**: Curated template library
- Industry templates (fintech, healthcare compliance, etc.)
- Framework templates (React, Vue, Django, Rails, etc.)
- Company can add custom templates

### 5.3 CLAUDE.md Linting (Future)

- Check for outdated information
- Validate referenced file paths exist
- Suggest updates based on codebase changes

---

## Implementation Order

### Sprint 1: Foundation (Phase 1)
1. Create `claude-md-analyzer.ts` with analysis logic
2. Add IPC handlers for analysis
3. Create basic "Project Context" view showing analysis
4. Add CLAUDE.md status indicator to project cards

### Sprint 2: Onboarding (Phase 2)
1. Add CLAUDE.md step to AddProjectDialog
2. Create template system
3. Implement template selection UI
4. Add "Create CLAUDE.md" flow for new projects

### Sprint 3: Full Editor (Phase 3)
1. Build section editor component
2. Build sub-file manager
3. Replace Skills page with Project Context page
4. Add recommendations panel

### Sprint 4: Migration & Polish (Phase 4)
1. Create skill-to-CLAUDE.md migration tool
2. Update task creation to remove skill injection
3. Add deprecation notices to old skills UI
4. Documentation and help content

### Sprint 5: Team Features (Phase 5)
1. Export/import functionality
2. Template library browser
3. Team template sharing (if applicable)

---

## File Changes Summary

### New Files
```
src/main/analysis/claude-md-analyzer.ts       # Analysis service
src/main/analysis/claude-md-generator.ts      # AI generation helper
src/main/templates/claude-md-templates.ts     # Template definitions

src/renderer/src/views/ProjectContextView.tsx # New main view
src/renderer/src/components/context/
  ├── ClaudeMdEditor.tsx                      # Main CLAUDE.md editor
  ├── SectionEditor.tsx                       # Section-level editing
  ├── SubFileManager.tsx                      # .claude/docs/ manager
  ├── QualityIndicator.tsx                    # Quality score display
  ├── Recommendations.tsx                     # Improvement suggestions
  ├── TemplateSelector.tsx                    # Template picker
  ├── SkillMigration.tsx                      # Migration wizard
  └── index.ts                                # Exports
```

### Modified Files
```
src/main/ipc/claude-config-handlers.ts        # Add analysis handlers
src/main/agents/claude-config-manager.ts      # Extend with sub-file ops
src/shared/ipc-types.ts                       # Add new IPC types

src/renderer/src/components/projects/
  ├── AddProjectDialog.tsx                    # Add CLAUDE.md step
  ├── ProjectCard.tsx                         # Add status indicator

src/renderer/src/App.tsx                      # Update routing
src/renderer/src/components/layout/Sidebar.tsx # Rename nav item
```

### Deprecated (Phase 4+)
```
src/renderer/src/views/SkillsView.tsx         # Replace with ProjectContextView
src/renderer/src/components/skills/           # Migrate to context/
src/main/storage/skill-store.ts               # Keep for migration, then remove
```

---

## Success Metrics

1. **Adoption**: % of projects with CLAUDE.md score > 50
2. **Quality**: Average CLAUDE.md quality score across projects
3. **Engagement**: Users editing CLAUDE.md through Nightshift vs external editors
4. **Migration**: % of users who migrated from skills to CLAUDE.md

---

## Open Questions

1. **Naming**: "Project Context" vs "AI Guidelines" vs "Claude Config" vs other?
2. **Skills Sunset**: How long to keep legacy skills working?
3. **AI Generation**: Use built-in agent or separate lightweight call?
4. **Sub-file Naming**: Enforce `.claude/docs/` or allow custom paths?

---

## Appendix: CLAUDE.md Best Practices to Promote

```markdown
# {Project Name}

## Quick Start
- Essential commands to get running
- Keep to 3-5 commands max

## Architecture Overview
- High-level system description
- Key directories and their purposes
- Critical architectural decisions

## Code Conventions
- Naming conventions
- File organization rules
- Import ordering, etc.

## Detailed Guidelines
For in-depth guidance, Claude will read these as needed:
- Testing: `.claude/docs/testing.md`
- API Design: `.claude/docs/api.md`
- Components: `.claude/docs/components.md`

## What NOT to Do
- Common mistakes to avoid
- Anti-patterns specific to this codebase
```
