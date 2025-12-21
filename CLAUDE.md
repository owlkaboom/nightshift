# Nightshift - AI Task Orchestrator

Local-first Electron app for queuing, managing, and reviewing AI-assisted coding tasks.

## Quick Start

```bash
npm install          # Install dependencies
npm run dev          # Start development mode
npm run build        # Build for production
npm run typecheck    # Run TypeScript checks
npm run lint         # Run ESLint
npm run lint:fix     # Run ESLint with auto-fix
npm test             # Run tests
```

## Tech Stack

Electron 39 + React 19 + TypeScript 5.9 | Zustand | TanStack Router | Radix UI + Tailwind CSS 4 | SQLite (better-sqlite3) | TipTap | simple-git | Vite

## Project Structure

```
src/
├── main/           # Electron main process - agents/, storage/, ipc/, git/
├── renderer/src/   # React UI - views/, components/, stores/, hooks/
├── preload/        # Secure IPC bridge (window.api)
└── shared/         # Shared types & constants
```

## Key Concepts

- **Task Lifecycle**: `queued → running → needs_review/failed → accepted/rejected`
- **Git Worktrees**: Each task runs isolated on `nightshift/task-{id}` branch
- **Agents**: Claude Code, Gemini, OpenRouter via adapter pattern
- **Storage**: SQLite in `~/.nightshift/`, API keys in OS keychain
- **Integrations**: GitHub issues/PRs, JIRA issue import
- **Notes**: Rich text notes with @mentions, vault storage
- **Skills**: Customizable prompts that modify agent behavior

## Code Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `TaskCard.tsx` |
| Hooks | camelCase + `use` | `useTaskStore.ts` |
| Types | PascalCase | `AgentAdapter` |
| Files | kebab-case | `task-store.ts` |
| Constants | SCREAMING_SNAKE | `AGENT_IDS` |

**TypeScript**: Strict mode, shared types in `src/shared/types/`, use `import type`

**State**: Zustand stores in `renderer/src/stores/`, IPC via `window.api`

**Errors**: Validate at boundaries (IPC, user input), discriminated unions for error states

## Development

- Main process changes require app restart; renderer hot-reloads
- IPC fully typed via `src/shared/ipc-types.ts`

### Before Completing Work

Run these checks before finishing any task:

```bash
npm run typecheck    # Must pass with no errors
npm run lint         # Must pass with no errors; fix any warnings you introduced
```

- **Errors**: All linting and type errors must be resolved before considering work complete
- **Warnings**: Fix any new warnings introduced by your changes; pre-existing warnings can be left alone
- **Changelog**: When adding new features, update `CHANGELOG.md` under the `[Unreleased]` section following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format (Added/Changed/Deprecated/Removed/Fixed/Security)

## Detailed Documentation

See `.claude/docs/` for in-depth guides:

| Topic | Document |
|-------|----------|
| **Features** | [features.md](.claude/docs/features.md) |
| Architecture | [architecture.md](.claude/docs/architecture.md), [ARCHITECTURE_DIAGRAM.md](.claude/docs/ARCHITECTURE_DIAGRAM.md) |
| Agents | [agent-system.md](.claude/docs/agent-system.md) |
| Tasks | [task-management.md](.claude/docs/task-management.md) |
| Planning | [planning-system.md](.claude/docs/planning-system.md) |
| Notes | [notes-system.md](.claude/docs/notes-system.md) |
| Integrations | [integrations.md](.claude/docs/integrations.md) |
| Storage | [storage-layer.md](.claude/docs/storage-layer.md), [database-migrations.md](.claude/docs/database-migrations.md) |
| IPC | [ipc-communication.md](.claude/docs/ipc-communication.md) |
| UI | [ui-components.md](.claude/docs/ui-components.md), [feature-spotlight-custom-content.md](.claude/docs/feature-spotlight-custom-content.md) |
| Git | [git-integration.md](.claude/docs/git-integration.md) |
| Testing | [testing.md](.claude/docs/testing.md) |

## Architecture Principles

1. **Local-First** - Code stays on developer's machine
2. **Git-Native** - Real worktrees; developer controls commits
3. **Human-in-Loop** - AI works, humans review
4. **Type-Safe** - Full TypeScript across all processes
