# Architecture Overview

## Process Model

Nightshift follows Electron's multi-process architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Process                             │
│  (Node.js - full system access)                             │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Storage   │  │   Agents    │  │     Git     │         │
│  │   (SQLite)  │  │   System    │  │  Operations │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │               │               │                   │
│         └───────────────┴───────────────┘                   │
│                         │                                    │
│                   IPC Handlers                               │
└─────────────────────────┬───────────────────────────────────┘
                          │ IPC (contextBridge)
┌─────────────────────────┴───────────────────────────────────┐
│                    Preload Script                            │
│  (Secure bridge - exposes window.api)                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                   Renderer Process                           │
│  (React - sandboxed browser context)                        │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Zustand   │  │    React    │  │  TanStack   │         │
│  │   Stores    │  │ Components  │  │   Router    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

See [Architecture Diagram](./ARCHITECTURE_DIAGRAM.md) for detailed visual diagrams.

## Directory Structure

### Main Process (`src/main/`)

```
main/
├── index.ts                  # App entry, lifecycle management
├── window.ts                 # BrowserWindow creation
├── agents/                   # Agent abstraction layer
│   ├── index.ts              # Exports
│   ├── registry.ts           # Agent registry singleton
│   ├── process-manager.ts    # Process spawning/management
│   ├── planning-manager.ts   # Planning session management
│   └── adapters/
│       ├── base-adapter.ts   # Shared adapter functionality
│       ├── claude-code.ts    # Claude Code implementation
│       ├── gemini.ts         # Gemini implementation
│       └── openrouter.ts     # OpenRouter implementation
├── storage/                  # Persistence layer
│   ├── index.ts              # Store exports
│   ├── database.ts           # SQLite connection
│   ├── secure-store.ts       # API key encryption
│   └── sqlite/               # SQLite store implementations
│       ├── task-store.ts
│       ├── project-store.ts
│       ├── group-store.ts
│       ├── skill-store.ts
│       ├── note-store.ts
│       ├── config-store.ts
│       ├── local-state-store.ts
│       └── memory-store.ts
├── ipc/                      # IPC handler registration
│   ├── index.ts              # Handler registration
│   ├── task-handlers.ts
│   ├── project-handlers.ts
│   ├── group-handlers.ts
│   ├── config-handlers.ts
│   ├── agent-handlers.ts
│   ├── agent-config-handlers.ts
│   ├── skill-handlers.ts
│   ├── git-handlers.ts
│   ├── planning-handlers.ts
│   ├── note-handlers.ts
│   └── memory-handlers.ts
├── git/                      # Git operations
│   ├── index.ts
│   └── git-info.ts
├── whisper/                  # Speech-to-text service
│   └── whisper-service.ts
├── migration/                # Data migrations
│   └── v2-migration.ts
└── utils/
    ├── paths.ts
    └── broadcast.ts
```

### Renderer Process (`src/renderer/`)

```
renderer/src/
├── App.tsx                   # Root component
├── main.tsx                  # React entry point
├── index.css                 # Global styles (Tailwind)
├── views/                    # Route pages
│   ├── index.ts
│   ├── QueueView.tsx         # Task queue (main view)
│   ├── ProjectsView.tsx      # Project management
│   └── SettingsView.tsx      # Configuration
├── components/               # Reusable components
│   ├── layout/               # App shell, sidebar
│   ├── queue/                # Kanban board
│   ├── tasks/                # Task cards, creation
│   ├── projects/             # Project management
│   ├── review/               # Review interface, diff
│   ├── planning/             # Planning sessions
│   ├── notes/                # Notes with mentions
│   ├── memory/               # Project memory
│   ├── skills/               # Skill management
│   ├── settings/             # Settings panels
│   ├── processes/            # Running process view
│   └── ui/                   # Primitives (Radix)
├── stores/                   # Zustand state
│   ├── index.ts
│   ├── task-store.ts
│   ├── project-store.ts
│   ├── group-store.ts
│   ├── config-store.ts
│   ├── ui-store.ts
│   ├── skill-store.ts
│   ├── note-store.ts
│   ├── planning-store.ts
│   └── usage-limit-store.ts
├── hooks/                    # Custom hooks
│   ├── index.ts
│   ├── useDebounce.ts
│   ├── useKeyboardShortcuts.ts
│   └── useSpeechRecognition.ts
└── lib/                      # Utilities
    ├── utils.ts
    ├── theme.ts
    ├── skill-suggestions.ts
    └── tiptap/               # TipTap editor extensions
        ├── index.ts
        ├── project-mention.ts
        ├── group-mention.ts
        └── floating-suggestion.ts
```

### Shared (`src/shared/`)

```
shared/
├── types/                    # Type definitions
│   ├── index.ts              # Re-exports all types
│   ├── task.ts               # Task, TaskStatus, Iteration
│   ├── project.ts            # Project, ProjectConfig
│   ├── group.ts              # Group
│   ├── agent.ts              # AgentAdapter interface
│   ├── config.ts             # AppConfig
│   ├── skill.ts              # Skill types
│   ├── note.ts               # Note types
│   ├── planning.ts           # Planning session types
│   └── project-memory.ts     # Memory types
├── ipc-types.ts              # IPC message contracts
├── constants.ts              # App constants
└── themes.ts                 # Theme definitions
```

## Data Flow

### Creating a Task

```
User Input → React Component → Zustand Store → window.api.createTask()
                                                      │
                                                      ▼
                                              IPC to Main Process
                                                      │
                                                      ▼
                                              task-handlers.ts
                                                      │
                                                      ▼
                                              sqlite/task-store.ts
                                                      │
                                                      ▼
                                              SQLite INSERT
```

### Running a Task

```
User clicks "Run" → Zustand action → window.api.startTask()
                                            │
                                            ▼
                                     agent-handlers.ts
                                            │
                                     ┌──────┴──────┐
                                     │  Validate   │
                                     │  Auth/Limits│
                                     └──────┬──────┘
                                            │
                                            ▼
                                     process-manager.ts
                                            │
                                            ▼
                                     AgentRegistry.getAdapter()
                                            │
                                            ▼
                                     Adapter.invoke()
                                            │
                                     ┌──────┴──────┐
                                     │ Create git  │
                                     │  worktree   │
                                     └──────┬──────┘
                                            │
                                            ▼
                                     Spawn CLI process
                                            │
                                            ▼
                                     parseOutput() → IPC events
                                            │
                                            ▼
                                     Renderer updates via broadcast
```

### Planning Session Flow

```
User starts planning → window.api.createPlanningSession()
                              │
                              ▼
                       planning-handlers.ts
                              │
                              ▼
                       planning-manager.ts
                              │
                              ▼
                       Adapter.chat() (Claude only)
                              │
                              ▼
                       Stream messages via IPC
                              │
                              ▼
                       Extract plan items
                              │
                              ▼
                       Convert to tasks (optional)
```

## Key Design Patterns

### 1. Agent Abstraction (Adapter Pattern)
All agent interactions go through `AgentAdapter` interface. A `BaseAgentAdapter` provides shared functionality.

```typescript
// Application code uses abstract interface
const adapter = agentRegistry.getAdapter(agentId)
const process = adapter.invoke(options)

// Adapters inherit shared behavior
class ClaudeCodeAdapter extends BaseAgentAdapter {
  // Override only what's specific to Claude
}
```

### 2. Store Pattern
Each domain has paired stores:
- **Main store** (`src/main/storage/sqlite/`): SQLite persistence
- **Renderer store** (`src/renderer/src/stores/`): UI state, IPC bridge

### 3. Type-Safe IPC
All IPC messages defined in `src/shared/ipc-types.ts`. Both processes use same types.

```typescript
// Defined once
interface TaskHandlers {
  'task:create': (data: CreateTaskData) => Promise<Task>
}

// Used in main process handlers
ipcMain.handle('task:create', (_, data) => createTask(data))

// Used in preload
createTask: (data) => ipcRenderer.invoke('task:create', data)
```

### 4. SQLite Storage
Single database file with all entities. Supports transactions and migrations.

### 5. Event Broadcasting
Main process broadcasts events to all renderer windows:

```typescript
// Main process
broadcastToAll('task:status-changed', { taskId, status })

// Renderer (preload)
onTaskStatusChanged: (callback) =>
  ipcRenderer.on('task:status-changed', (_, data) => callback(data))
```

## Module Boundaries

| Module | Responsibility | Can Access |
|--------|----------------|------------|
| `main/agents/` | Agent execution | Storage, Git |
| `main/storage/` | Data persistence | SQLite, file system |
| `main/ipc/` | IPC handling | Storage, Agents, Git |
| `main/git/` | Git operations | File system, simple-git |
| `renderer/stores/` | UI state | window.api only |
| `renderer/components/` | UI rendering | Stores, hooks |
| `shared/` | Types, constants | Nothing (pure) |

## Build Configuration

- **Vite**: Bundler for all processes
- **electron-vite**: Orchestrates main/preload/renderer builds
- **Path aliases**:
  - `@shared` → `src/shared/`
  - `@renderer` → `src/renderer/src/`
- **TypeScript**: Strict mode enabled

## Related Documentation

- [Architecture Diagram](./ARCHITECTURE_DIAGRAM.md) - Visual diagrams
- [Agent System](./agent-system.md) - Agent adapter details
- [Storage Layer](./storage-layer.md) - SQLite schema
- [IPC Communication](./ipc-communication.md) - IPC patterns
