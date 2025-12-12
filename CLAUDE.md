# Nightshift - AI Task Orchestrator

Nightshift is a local-first Electron desktop application that enables developers to queue, manage, and review AI-assisted coding tasks. Queue tasks overnight, review results in the morning—all while keeping code on your local machine.

## Quick Start

```bash
npm install          # Install dependencies
npm run dev          # Start development mode
npm run build        # Build for production
npm run typecheck    # Run TypeScript checks
```

## Architecture Overview

See [Architecture Diagram](.claude/docs/ARCHITECTURE_DIAGRAM.md) for a visual representation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Electron App                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         Main Process (Node.js)                           ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       ││
│  │  │   Agents    │ │   Storage   │ │     Git     │ │  Planning   │       ││
│  │  │  Registry   │ │   SQLite    │ │  Worktrees  │ │   Manager   │       ││
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       ││
│  │                                                                          ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │                        Agent Adapters                                │││
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │││
│  │  │  │ Claude Code │ │   Gemini    │ │ OpenRouter  │                   │││
│  │  │  │   Adapter   │ │   Adapter   │ │   Adapter   │                   │││
│  │  │  └─────────────┘ └─────────────┘ └─────────────┘                   │││
│  │  │                         ↑                                           │││
│  │  │               BaseAgentAdapter (shared logic)                       │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                    │                                         │
│                            IPC (contextBridge)                               │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                      Renderer Process (React)                            ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       ││
│  │  │   Zustand   │ │    Views    │ │    React    │ │  TanStack   │       ││
│  │  │   Stores    │ │  (Queue,    │ │ Components  │ │   Router    │       ││
│  │  │             │ │  Projects)  │ │  (UI, Tasks)│ │             │       ││
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
src/
├── main/                    # Electron main process (Node.js)
│   ├── index.ts             # App entry point
│   ├── window.ts            # BrowserWindow management
│   ├── agents/              # Agent abstraction layer
│   │   ├── registry.ts      # Agent registry singleton
│   │   ├── process-manager.ts # Process spawning/lifecycle
│   │   ├── planning-manager.ts # Planning session handling
│   │   └── adapters/        # Agent implementations
│   │       ├── base-adapter.ts   # Shared adapter logic
│   │       ├── claude-code.ts    # Claude Code CLI
│   │       ├── gemini.ts         # Google Gemini CLI
│   │       └── openrouter.ts     # OpenRouter API proxy
│   ├── storage/             # Persistence layer (SQLite)
│   │   ├── database.ts      # SQLite database management
│   │   ├── sqlite/          # SQLite store implementations
│   │   └── secure-store.ts  # Encrypted API key storage
│   ├── ipc/                 # IPC handlers (main ↔ renderer)
│   ├── git/                 # Git operations
│   ├── whisper/             # Local speech-to-text (optional)
│   └── utils/               # Utilities
├── renderer/                # React UI (TypeScript + Tailwind)
│   └── src/
│       ├── views/           # Page views (Queue, Projects, etc.)
│       ├── components/      # Reusable components
│       │   ├── layout/      # App shell, sidebar
│       │   ├── queue/       # Kanban board
│       │   ├── tasks/       # Task cards, detail panels
│       │   ├── projects/    # Project management
│       │   ├── review/      # Review interface, diff viewer
│       │   ├── planning/    # Planning session UI
│       │   ├── notes/       # Note-taking with mentions
│       │   ├── skills/      # Skill management
│       │   ├── settings/    # Configuration panels
│       │   └── ui/          # Primitives (Radix + Tailwind)
│       ├── stores/          # Zustand state management
│       ├── hooks/           # Custom React hooks
│       └── lib/             # Utilities (tiptap, themes)
├── preload/                 # Secure IPC bridge
│   └── index.ts             # window.api exposure
└── shared/                  # Shared types & constants
    ├── types/               # TypeScript type definitions
    │   ├── task.ts          # Task, TaskStatus, Iteration
    │   ├── project.ts       # Project, ProjectConfig
    │   ├── agent.ts         # AgentAdapter interface
    │   ├── planning.ts      # Planning session types
    │   ├── skill.ts         # Skill definitions
    │   └── note.ts          # Note types
    ├── ipc-types.ts         # IPC message contracts
    └── constants.ts         # App constants
```

## Technology Stack

| Category | Technology |
|----------|------------|
| Framework | Electron 39 + React 19 + TypeScript 5.9 |
| State | Zustand |
| Routing | TanStack Router |
| UI | Radix UI primitives + Tailwind CSS 4 |
| Editor | TipTap (notes with mentions) |
| Database | SQLite (better-sqlite3) |
| Git | simple-git |
| Build | Vite via electron-vite |

## Key Concepts

### Task Lifecycle

```
queued → running → needs_review/failed → accepted/rejected
           │              │
           └──────────────┘ (re-prompt, retry)
```

| Status | Description |
|--------|-------------|
| `queued` | Waiting for execution |
| `running` | Agent actively working |
| `needs_review` | Complete, awaiting human review |
| `failed` | Error occurred (rate limit, auth, etc.) |
| `accepted` | Changes approved by user |
| `rejected` | Changes discarded |

### Git Worktrees

Each task runs in an isolated git worktree on a `nightshift/task-{id}` branch:
- Parallel execution without conflicts
- Full isolation from main branch
- Developer controls merge strategy

### Agent System

The adapter pattern supports multiple AI coding tools:

```typescript
interface AgentAdapter {
  id: string
  name: string
  isAvailable(): Promise<boolean>
  invoke(options: AgentInvokeOptions): AgentProcess
  parseOutput(stream: ReadableStream): AsyncIterable<AgentOutputEvent>
  detectRateLimit(output: string): boolean
  detectUsageLimit(output: string): UsageLimitResult
  validateAuth(): Promise<AuthValidationResult>
  getCapabilities(): AgentCapabilities
}
```

Supported agents:
- **Claude Code** - Anthropic's Claude CLI
- **Gemini** - Google's Gemini CLI
- **OpenRouter** - Access multiple models via API

### Storage

SQLite database in `~/.nightshift/`:
- `nightshift.db` - Main database (tasks, projects, groups, notes)
- `config.json` - App configuration
- `worktrees/` - Task working directories
- API keys stored encrypted via OS keychain

### Planning Sessions

Interactive AI-assisted planning before task execution:
- Multi-turn conversations with chosen agent
- Extract actionable plan items
- Convert plan items to tasks

### Skills

Customizable skill prompts that modify agent behavior:
- Built-in skills (TypeScript Expert, React Best Practices, etc.)
- User-created custom skills
- Per-task skill selection

## Important Files

| File | Purpose |
|------|---------|
| `src/main/index.ts` | App entry, window creation |
| `src/main/agents/registry.ts` | Agent singleton registry |
| `src/main/agents/adapters/base-adapter.ts` | Shared adapter logic |
| `src/main/agents/adapters/claude-code.ts` | Claude Code integration |
| `src/main/agents/process-manager.ts` | Task execution |
| `src/main/storage/database.ts` | SQLite connection |
| `src/main/ipc/agent-handlers.ts` | Agent IPC handlers |
| `src/shared/ipc-types.ts` | Typed IPC contracts |
| `src/shared/types/agent.ts` | Agent interface |
| `src/renderer/src/views/QueueView.tsx` | Main queue interface |
| `src/renderer/src/stores/task-store.ts` | Task UI state |

## Feature Documentation

Detailed documentation in `.claude/docs/`:

| Document | Description |
|----------|-------------|
| [Architecture Diagram](.claude/docs/ARCHITECTURE_DIAGRAM.md) | Visual system overview |
| [Architecture](.claude/docs/architecture.md) | Process model, data flow |
| [Agent System](.claude/docs/agent-system.md) | Adapter pattern, adding agents |
| [Task Management](.claude/docs/task-management.md) | Task lifecycle, queue |
| [Storage Layer](.claude/docs/storage-layer.md) | SQLite schema, migrations |
| [Database Migrations](.claude/docs/database-migrations.md) | Migration system, troubleshooting |
| [IPC Communication](.claude/docs/ipc-communication.md) | Type-safe IPC patterns |
| [UI Components](.claude/docs/ui-components.md) | Component hierarchy |
| [Git Integration](.claude/docs/git-integration.md) | Worktree management |

## Code Conventions

### TypeScript

- **Strict mode** enabled - no implicit `any`
- Shared types in `src/shared/types/`
- Use type imports: `import type { Task } from '@shared/types'`
- Prefer interfaces over type aliases for object shapes
- Use discriminated unions for complex state

### File Organization

- One component/class per file
- Co-locate related code (component + types + hooks)
- Index files for clean exports
- Base classes for shared logic (e.g., `BaseAgentAdapter`)

### Naming

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `TaskCard.tsx` |
| Hooks | camelCase with `use` | `useTaskStore.ts` |
| Types/Interfaces | PascalCase | `AgentAdapter` |
| Files (non-components) | kebab-case | `task-store.ts` |
| Constants | SCREAMING_SNAKE | `AGENT_IDS` |

### State Management

- Zustand stores in `renderer/src/stores/`
- IPC calls abstracted through `window.api`
- Optimistic updates where appropriate

### Error Handling

- Validate at system boundaries (IPC, user input)
- Use discriminated unions for error states
- Log with adapter context: `console.log('[ClaudeCode]', ...)`

## Development Notes

- Main process changes require app restart
- Renderer hot-reloads on save
- Run `npm run typecheck` before committing
- IPC messages fully typed via `src/shared/ipc-types.ts`
- Check agent auth before starting tasks

## Architecture Principles

1. **Local-First** - All code stays on developer's machine
2. **Git-Native** - Real git worktrees; developer controls commits
3. **Human-in-Loop** - AI does work, humans review and commit
4. **Plugin Ready** - Clean agent abstraction for extensibility
5. **Type-Safe** - Full TypeScript across all processes
6. **DRY** - Shared base classes and utilities
