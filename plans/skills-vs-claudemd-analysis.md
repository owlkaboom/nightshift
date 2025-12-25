# Skills vs CLAUDE.md: Analysis and Recommendations

## The Core Question

> Do we need skills, or would Claude automatically figure things out if we have a good CLAUDE.md file? For example, if I had sections about "if you are doing frontend work then follow the front-end best practices" would that do anything? Or do we have to include this as context in front of our prompts like we are doing with skills?

## TL;DR Recommendation

**A well-structured CLAUDE.md is sufficient for most use cases.** You don't need to maintain a separate skills system. Claude Code natively reads CLAUDE.md files and applies those instructions. The key is *how* you structure the content.

---

## How Claude Code Handles CLAUDE.md

Claude Code automatically reads and applies CLAUDE.md in the following order:
1. `~/.claude/CLAUDE.md` (user-level, applies to all projects)
2. `CLAUDE.md` in the project root
3. `.claude/docs/*.md` files (referenced from main CLAUDE.md)

**Key insight**: Claude Code includes this content as part of its system context *before* processing your task prompt. This means CLAUDE.md instructions have the same effect as skill prompt injection - they're both context that guides Claude's behavior.

---

## Will Conditional Instructions Work?

**Short answer: Yes, but phrasing matters.**

### What Works Well

```markdown
## Frontend Development Guidelines

When working with React components:
- Use functional components with TypeScript
- Prefer `useState` and `useReducer` over class state
- Extract hooks for reusable logic (prefix with `use`)
- Co-locate component tests in `__tests__/` subdirectory

When styling components:
- Use Tailwind utility classes
- Avoid inline styles except for dynamic values
- Group related utilities with comments
```

This works because:
- Clear scope ("When working with React components")
- Actionable, specific instructions
- Claude understands context from the task

### What Works Less Well

```markdown
## Best Practices

If you are doing frontend work, follow frontend best practices.
If you are doing backend work, follow backend best practices.
```

This doesn't work well because:
- Too vague - what are "frontend best practices"?
- Claude already knows generic best practices
- No project-specific guidance added

---

## Skills vs CLAUDE.md: Feature Comparison

| Feature | Skills (Current) | CLAUDE.md |
|---------|-----------------|-----------|
| **Context injection** | Prepended to prompt | Read natively by Claude Code |
| **Per-task customization** | ✅ Select different skills per task | ❌ Same for all tasks in project |
| **Version controlled** | ❌ Stored in Nightshift DB | ✅ Committed to git |
| **Team sharing** | ❌ Local to user | ✅ Shared via repository |
| **Works outside Nightshift** | ❌ Nightshift-only | ✅ Works with raw Claude Code |
| **Maintenance** | Duplicate of project docs | Single source of truth |
| **Dynamic selection** | UI selection before task | N/A - always applied |

---

## When You Might Still Want Skills

### Legitimate Use Cases

1. **Cross-project patterns**: Things that apply to ALL your projects regardless of stack
   - Personal coding style preferences
   - Company-wide security policies
   - Documentation standards

2. **Experimental/temporary guidance**: Testing new approaches without modifying git
   - "Try using effect-ts for this task"
   - "Output verbose logging for debugging"

3. **Task-specific overrides**: When one task needs different behavior
   - "Don't write tests for this prototype"
   - "Use verbose comments for educational code"

### Why These Are Edge Cases

For case 1, use `~/.claude/CLAUDE.md` (user-level) instead.
For cases 2-3, you can add instructions directly in the task prompt.

---

## Recommendation: Simplify to CLAUDE.md-First

### Phase 1: Immediate Simplification

1. **Remove skill injection from task execution**
   - Claude Code already reads CLAUDE.md natively
   - Current dual-injection is redundant

2. **Convert existing built-in skills to CLAUDE.md templates**
   - Instead of runtime injection, offer to add content to CLAUDE.md
   - "Add TypeScript guidelines" → writes to CLAUDE.md section

3. **Keep skill storage for migration path**
   - Users with existing skills get migration wizard
   - Convert their enabled skills → CLAUDE.md content

### Phase 2: CLAUDE.md Management Focus

The existing plan in `plans/claude-md-skills-evolution.md` covers this well:
- CLAUDE.md quality analysis
- Section-based editing
- `.claude/docs/` sub-file management
- AI-assisted generation

### Phase 3: Deprecate Skills UI

- Remove per-task skill selection
- Replace Skills page with "Project Context" page
- Focus on making CLAUDE.md editing excellent

---

## Recommended File Structure: Keep CLAUDE.md Lean

**Problem**: A monolithic CLAUDE.md becomes unwieldy and wastes context on irrelevant instructions.

**Solution**: Use `.claude/docs/` sub-files for domain-specific content. The main CLAUDE.md stays lean (~100-150 lines) and references detailed docs that Claude reads when contextually relevant.

### Recommended Structure for Nightshift

```
CLAUDE.md                              # ~100-150 lines, essentials only
.claude/
└── docs/
    ├── frontend.md                    # React/renderer process patterns
    ├── backend.md                     # Main process/Electron patterns
    ├── ipc-communication.md           # IPC handler patterns (exists)
    ├── storage-layer.md               # SQLite/storage patterns (exists)
    ├── testing.md                     # Test conventions (exists)
    ├── ui-components.md               # Radix/Tailwind patterns (exists)
    ├── agent-system.md                # Agent adapter patterns (exists)
    └── git-integration.md             # Worktree/git patterns (exists)
```

### What Goes in Main CLAUDE.md

Keep only:
- Project overview (what is this?)
- Quick start commands
- High-level code conventions (naming, file structure)
- **References to sub-files** for detailed guidance
- Pre-completion checklist

```markdown
# Nightshift

Local-first Electron app for AI-assisted coding tasks.

## Quick Start
npm install && npm run dev

## Code Conventions
[Keep existing table - it's concise]

## Domain-Specific Guidelines

Detailed conventions are in `.claude/docs/`:

| Domain | Guide | When to Reference |
|--------|-------|-------------------|
| Frontend | [frontend.md](.claude/docs/frontend.md) | Working in `src/renderer/` |
| Backend | [backend.md](.claude/docs/backend.md) | Working in `src/main/` |
| IPC | [ipc-communication.md](.claude/docs/ipc-communication.md) | Adding/modifying IPC handlers |
| Storage | [storage-layer.md](.claude/docs/storage-layer.md) | Database or file storage work |
| Testing | [testing.md](.claude/docs/testing.md) | Writing or modifying tests |
| UI | [ui-components.md](.claude/docs/ui-components.md) | Creating UI components |

## Before Completing Work
[Keep existing checklist]
```

### What Goes in Sub-Files

Each sub-file contains **specific, actionable instructions** for that domain:

**`.claude/docs/frontend.md`** (new file to create):
```markdown
# Frontend Development (src/renderer/)

## Component Patterns

When creating React components:
- Functional components only, no class components
- TypeScript with explicit prop types
- Co-locate styles, tests, and types with component

### File Organization
```
components/
└── feature-name/
    ├── FeatureName.tsx        # Main component
    ├── FeatureName.types.ts   # Types (if complex)
    ├── use-feature-name.ts    # Custom hooks
    └── __tests__/
        └── FeatureName.test.tsx
```

## State Management

- **Local state**: `useState`, `useReducer` for component-only state
- **Shared state**: Zustand stores in `stores/` directory
- **Server state**: Use IPC via `window.api`, not direct fetches

## Styling

- Tailwind CSS 4 utility classes
- Radix UI primitives for all interactive elements
- Use `cn()` from `lib/utils` for conditional classes
- Never use inline styles except for truly dynamic values

## Common Patterns

### Dialog/Modal
Always use Radix Dialog with these patterns:
- Controlled via Zustand store or local state
- Focus trap handled by Radix
- Close on escape and outside click

### Forms
- Use controlled inputs with useState
- Validation on submit, not on change
- Loading states during async operations
```

**`.claude/docs/backend.md`** (new file to create):
```markdown
# Backend Development (src/main/)

## IPC Handlers

When adding new IPC functionality:
1. Define types in `src/shared/ipc-types.ts`
2. Create handler in `src/main/ipc/[domain]-handlers.ts`
3. Register in `src/main/ipc/index.ts`
4. Expose via preload in `src/preload/index.ts`

### Handler Pattern
```typescript
// In ipc-types.ts
export interface IpcApi {
  'domain:action': (arg: InputType) => Promise<OutputType>
}

// In domain-handlers.ts
ipcMain.handle('domain:action', async (_, arg: InputType): Promise<OutputType> => {
  // Implementation
})
```

## Storage Layer

- SQLite via better-sqlite3 for structured data
- File storage in `~/.nightshift/` for user data
- Secure storage (keychain) for API keys via `secure-store.ts`

### Adding New Storage
1. Create store in `storage/sqlite/[name]-store.ts`
2. Extend `BaseStore` or implement interface
3. Add migrations in `storage/sqlite/migrations/`
4. Register in storage index

## Agent System

When adding new agent adapters:
1. Extend `BaseAgentAdapter` in `agents/adapters/`
2. Implement abstract methods
3. Register in `agents/registry.ts`
4. Add agent ID to `shared/types/agent.ts`

## Logging

- Use `logger` from `./utils/logger`, never `console.log`
- `logger.debug()` for dev output (hidden in production)
- `logger.info/warn/error()` for production-relevant logs
```

### How Claude Uses Sub-Files

1. **Context recognition**: When your task mentions "add a new IPC handler", Claude recognizes this relates to backend/IPC work
2. **Reference following**: Claude reads the linked `.claude/docs/ipc-communication.md` for specific patterns
3. **Selective loading**: Frontend docs aren't loaded for backend-only tasks, saving context

### Benefits of This Structure

| Aspect | Monolithic CLAUDE.md | Split with Sub-Files |
|--------|---------------------|---------------------|
| Context usage | All instructions loaded always | Only relevant docs loaded |
| Maintainability | One huge file | Focused, manageable files |
| Team collaboration | Merge conflicts | Isolated changes |
| Discoverability | Scroll through everything | Clear table of contents |
| Claude effectiveness | May miss buried instructions | Focused, relevant context |

---

## Structuring Instructions for Conditional Behavior

Within each sub-file, use these patterns:

### Pattern 1: Explicit Scope Headers

```markdown
## React Components

When creating or modifying React components:
- Use functional components with hooks
- TypeScript types in separate `*.types.ts` files
- Tests co-located in `__tests__/ComponentName.test.tsx`
```

### Pattern 2: File-Location Based Rules

```markdown
### `src/renderer/` (Frontend)
- React with Zustand for state
- Tailwind for styling

### `src/main/` (Backend)
- Pure TypeScript, no React
- Use logger utility
```

### Pattern 3: Task-Type Hints

```markdown
## When Writing Tests
- Use Vitest for unit tests
- Mock external dependencies only

## When Fixing Bugs
1. Reproduce with failing test first
2. Fix, verify, check for similar issues
```

---

## What Your Nightshift CLAUDE.md Does Well

Looking at your current CLAUDE.md, it already:
- ✅ Has clear quick start commands
- ✅ Defines code conventions (naming, file organization)
- ✅ References detailed docs in `.claude/docs/`
- ✅ Has "Before Completing Work" checklist
- ✅ Uses logging guidance as an example of specific patterns

### What Could Be Enhanced

Add domain-specific sections like:

```markdown
## Frontend Tasks (src/renderer/)

When working in the renderer process:
- Components go in `components/` with PascalCase naming
- Use Zustand stores in `stores/` for shared state
- All modals/dialogs use Radix primitives
- Prefer `cn()` for conditional classes

## Backend Tasks (src/main/)

When working in the main process:
- IPC handlers in `ipc/` with corresponding types in `shared/ipc-types.ts`
- Storage operations in `storage/` directory
- Use the BaseAgentAdapter pattern for new agents
```

---

## Summary

| Question | Answer |
|----------|--------|
| Do we need skills? | No, CLAUDE.md is sufficient |
| Will conditional CLAUDE.md work? | Yes, if specific enough |
| What about per-task customization? | Add to task prompt directly, or use user-level CLAUDE.md |
| Should we keep the skills system? | Migrate to CLAUDE.md templates, then deprecate |
| Is the existing plan good? | Yes, `claude-md-skills-evolution.md` covers the right approach |

**Bottom line**: Invest in making your CLAUDE.md excellent, not in maintaining a parallel skills system. Claude Code's native CLAUDE.md support makes skills redundant.

---

## Next Steps

### Immediate: Restructure CLAUDE.md

1. [ ] Create `.claude/docs/frontend.md` with renderer-specific patterns
2. [ ] Create `.claude/docs/backend.md` with main process patterns
3. [ ] Slim down main CLAUDE.md to ~100-150 lines with references to sub-files
4. [ ] Add "Domain-Specific Guidelines" table linking to sub-files

### Validation: Test Without Skills

5. [ ] Disable skill injection in `agent-handlers.ts` (comment out `buildSkillPrompt`)
6. [ ] Run several tasks across frontend/backend domains
7. [ ] Verify Claude follows `.claude/docs/` guidelines correctly

### If Validation Succeeds: Deprecate Skills

8. [ ] Remove skill injection code entirely
9. [ ] Convert Skills page → "Project Context" management UI
10. [ ] Add skill-to-CLAUDE.md migration wizard for existing users

### Code Cleanup: Remove Unused Skill Infrastructure

11. [ ] Delete `src/shared/types/skill.ts` (skill types and built-in definitions)
12. [ ] Delete `src/main/storage/skill-store.ts` (file-based storage)
13. [ ] Delete `src/main/storage/sqlite/skill-store.ts` (SQLite storage)
14. [ ] Delete `src/main/ipc/skill-handlers.ts` (IPC endpoints)
15. [ ] Delete `src/main/analysis/skill-recommender.ts` (tech-to-skill mapping)
16. [ ] Delete `src/main/analysis/skill-templates.ts` (40+ skill templates)
17. [ ] Delete `src/main/skills/github-importer.ts` (GitHub skill import)
18. [ ] Delete `src/renderer/src/stores/skill-store.ts` (Zustand store)
19. [ ] Delete `src/renderer/src/components/skills/` directory (SkillSelector, etc.)
20. [ ] Delete `src/renderer/src/lib/skill-suggestions.ts` (keyword matching)
21. [ ] Remove skill-related IPC types from `src/shared/ipc-types.ts`
22. [ ] Remove `enabledSkills` field from `TaskManifest` type
23. [ ] Remove skill selection from task dialogs (AddTaskDialog, EditTaskDialog, etc.)
24. [ ] Add database migration to drop `skills` table
25. [ ] Remove skill references from `.claude/docs/agent-system.md` documentation

### Nightshift Product Enhancement

26. [ ] Build CLAUDE.md editor in Nightshift (per `claude-md-skills-evolution.md` plan)
27. [ ] Add quality scoring for CLAUDE.md files
28. [ ] Add "Add Guidelines" templates that write to `.claude/docs/`
