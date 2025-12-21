# Features Overview

Complete feature reference for Nightshift. Use this document to understand what the application can do and where to find implementation details.

## Core Features

### Task Management

Queue, prioritize, and execute AI-assisted coding tasks.

| Feature | Description | Key Files |
|---------|-------------|-----------|
| Task Queue | Kanban board for managing tasks | `src/renderer/src/components/queue/` |
| Task Lifecycle | `queued → running → needs_review/failed → accepted/rejected` | `src/shared/types/task.ts` |
| Task Iterations | Re-prompt tasks with additional instructions | `src/main/agents/process-manager.ts` |
| Priority Ordering | Drag-and-drop task prioritization | `src/renderer/src/stores/task-store.ts` |
| Bulk Operations | Multi-select and batch task actions | `src/renderer/src/components/queue/` |

### AI Agent System

Support for multiple AI coding assistants via adapter pattern.

| Agent | Description | Adapter |
|-------|-------------|---------|
| Claude Code | Anthropic's CLI tool (primary) | `src/main/agents/adapters/claude-code.ts` |
| Gemini | Google's Gemini CLI | `src/main/agents/adapters/gemini.ts` |
| OpenRouter | Multi-provider API access | `src/main/agents/adapters/openrouter.ts` |

**Agent Capabilities:**
- Model selection and configuration
- Usage/rate limit detection and handling
- Auth validation
- Pause/resume execution
- Output streaming and parsing

See [agent-system.md](./agent-system.md) for implementation details.

### Git Integration

Isolated task execution using git worktrees.

| Feature | Description |
|---------|-------------|
| Worktree Isolation | Each task runs in `nightshift/task-{id}` branch |
| Diff Viewing | Review changes before accepting |
| Merge/Rebase | Choose how to integrate changes |
| Branch Management | Automatic branch creation and cleanup |

See [git-integration.md](./git-integration.md) for implementation details.

### Planning System

Interactive AI-assisted project planning.

| Feature | Description |
|---------|-------------|
| Conversational Planning | Multi-turn planning sessions with Claude |
| Plan File Generation | Creates structured markdown in `plans/` |
| Plan-to-Task Conversion | Extract tasks from plan items |
| Multi-file Plans | Organize complex plans into sub-documents |

See [planning-system.md](./planning-system.md) for implementation details.

## Secondary Features

### Notes System

Rich text note-taking with project context.

| Feature | Description | Key Files |
|---------|-------------|-----------|
| Rich Text Editor | TipTap-based formatting | `src/renderer/src/lib/tiptap/` |
| @Mentions | Reference projects, tasks in notes | `src/renderer/src/lib/tiptap/project-mention.ts` |
| Pin/Archive | Organize notes by importance | `src/renderer/src/stores/note-store.ts` |
| Note Groups | Folder-like organization | `src/main/storage/sqlite/note-groups-store.ts` |
| Note-to-Task | Convert notes into tasks | `src/renderer/src/components/notes/` |

See [notes-system.md](./notes-system.md) for implementation details.

### Skills System

Customizable prompts that modify agent behavior.

| Feature | Description |
|---------|-------------|
| Built-in Skills | TypeScript Expert, React Best Practices, etc. |
| Custom Skills | User-defined skill prompts |
| Skill Suggestions | AI recommends skills based on project analysis |
| GitHub Import | Import skills from GitHub repositories |

**Key Files:**
- `src/main/storage/sqlite/skill-store.ts`
- `src/main/skills/github-importer.ts`
- `src/renderer/src/components/skills/`

### External Integrations

Connect to external services for task import.

| Integration | Features |
|-------------|----------|
| GitHub | Issue fetching, PR creation, repository browsing |
| JIRA | Issue import, sprint/board browsing, transitions |

See [integrations.md](./integrations.md) for implementation details.

### Project Context

AI-readable project documentation.

| Feature | Description |
|---------|-------------|
| CLAUDE.md Editing | In-app editing of project instructions |
| Sub-file Management | Organize docs in `.claude/docs/` |
| Quality Analysis | Recommendations for improving docs |
| Technology Detection | Automatic stack identification |

**Key Files:**
- `src/renderer/src/components/context/ClaudeMdChatPanel.tsx`
- `src/main/analysis/`

### Voice Input

Speech-to-text task creation.

| Feature | Description |
|---------|-------------|
| Whisper Integration | Local speech-to-text via Whisper |
| Voice-to-Task | Create tasks by speaking |
| Fuzzy Matching | Auto-detect project from voice context |

**Key Files:**
- `src/main/whisper/whisper-service.ts`
- `src/renderer/src/hooks/useSpeechRecognition.ts`

### Tags System

Color-coded organization for tasks and notes.

| Feature | Description |
|---------|-------------|
| Custom Tags | Create tags with custom colors |
| Tag Assignment | Apply tags to tasks and notes |
| Tag Filtering | Filter views by tag |

**Key Files:**
- `src/main/storage/sqlite/tag-store.ts`
- `src/renderer/src/stores/tag-store.ts`

## UI Features

### Views

| View | Route | Description |
|------|-------|-------------|
| Queue | `/queue` | Kanban board for task management |
| Calendar | `/calendar` | Monthly view of completed tasks |
| Projects | `/projects` | Project management and configuration |
| Settings | `/settings` | App configuration |

### Theme System

| Theme | Description |
|-------|-------------|
| Light/Dark | Standard themes |
| System | Match OS preference |
| Custom Themes | 6 additional color schemes |

### Notifications

| Feature | Description |
|---------|-------------|
| Desktop Notifications | Native OS notifications on task completion |
| Sound Alerts | Customizable notification sounds |
| Toast Messages | In-app notification toasts |

### Walkthrough System

| Feature | Description |
|---------|-------------|
| Feature Spotlights | Interactive feature discovery |
| Custom Content | Markdown, images, GIFs, video support |
| Progress Tracking | Remember completed tutorials |

See [feature-spotlight-custom-content.md](./feature-spotlight-custom-content.md) for implementation details.

## Data & Storage

### Local Storage

All data stored locally in `~/.nightshift/`:

| Item | Location |
|------|----------|
| Database | `nightshift.db` (SQLite) |
| Config | `config.json` |
| Worktrees | `worktrees/{project}/{task}/` |
| Logs | `logs/{task-id}/` |
| API Keys | OS keychain (encrypted) |

See [storage-layer.md](./storage-layer.md) for implementation details.

### Vault (Notes Storage)

Separate file-based storage for notes:

| Feature | Description |
|---------|-------------|
| Configurable Path | User-defined vault location |
| Markdown Files | Notes stored as `.md` files |
| Cache Layer | In-memory cache for performance |

**Key Files:**
- `src/main/storage/vault/vault-store.ts`
- `src/main/storage/vault/notes-cache.ts`

## Process Monitoring

| Feature | Description |
|---------|-------------|
| Real-time Tracking | Live execution status updates |
| Pause/Resume | Control running tasks |
| Timeout Handling | Configurable task duration limits |
| Log Viewing | Access agent output logs |

**Key Files:**
- `src/main/agents/process-manager.ts`
- `src/renderer/src/components/processes/`

## Keyboard Shortcuts

Global keyboard navigation throughout the app. Key shortcuts configurable in settings.

**Key Files:**
- `src/renderer/src/hooks/useKeyboardShortcuts.ts`

## Related Documentation

| Document | Content |
|----------|---------|
| [architecture.md](./architecture.md) | System architecture and data flow |
| [agent-system.md](./agent-system.md) | Agent adapter implementation |
| [task-management.md](./task-management.md) | Task lifecycle details |
| [integrations.md](./integrations.md) | External service connections |
| [notes-system.md](./notes-system.md) | Notes and vault system |
