# Changelog

All notable changes to Nightshift will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2025-12-25

### Added

- **Task Board Project Selector**: Added dropdown selector for changing the currently selected project directly from the task board
  - Shows project name with folder icon in the board controls area
  - Appears alongside agent/model selector for better context awareness
  - Click to change project without leaving the board view
- **JIRA Source Management UI**: Added comprehensive UI for managing JIRA integration sources
  - New `ManageSourcesDialog` component for discovering and adding boards, filters, projects, and custom JQL queries
  - Source list display in integrations panel showing all configured sources per connection
  - Support for searching and multi-selecting boards, filters, and projects
  - Custom JQL query builder for advanced filtering
  - Visual source type indicators (board, filter, project, JQL) with enabled/disabled badges
- **JIRA Pagination**: Added proper pagination support for JIRA issue loading
  - Issues are now loaded 25 at a time with Previous/Next navigation
  - Shows current page, total pages, and issue count
  - Pagination controls automatically update based on available results
- **JIRA Status Discovery**: Added API endpoint to dynamically fetch available JIRA statuses from connections
  - New `jira:listStatuses` IPC handler
  - Cached status discovery in integration store
  - Foundation for dynamic status filter UI (to be implemented)

### Fixed

- **JIRA Integration Filtering**: Fixed "assigned to me" filter to correctly apply server-side using JQL queries
  - Previously used client-side filtering which missed results beyond the first page
  - Now uses `assignee = "{email}"` in JQL for board, sprint, backlog, filter, project, and custom JQL sources
  - Filters are applied server-side for accurate pagination and results
- **JIRA Status Filtering**: Fixed "open" and "closed" status filters to use JIRA status categories (Done, To Do, In Progress) for better compatibility across different JIRA workflows
- **JIRA Board/Sprint/Backlog Filtering**: Converted board, sprint, and backlog sources to use JQL queries instead of Agile API endpoints to enable proper server-side filtering

## [0.2.3] - 2025-12-22

## [0.2.2] - 2025-12-22

## [0.2.1] - 2025-12-22

## [0.2.0] - 2025-12-22

### Added

- **Documentation**: Added comprehensive features.md with complete feature reference
- **Documentation**: Added integrations.md documenting GitHub and JIRA integration
- **Documentation**: Added notes-system.md documenting rich text notes, vault storage, and @mentions
- **Documentation**: Updated CLAUDE.md with links to new documentation and additional key concepts

### Fixed

- **Testing**: Fixed note groups store tests failing in CI by setting correct Node.js test environment and ensuring sequential execution

## [0.2.0-beta] - 2025-12-20

## [0.1.0-beta] - 2025-12-19

### Added

- **Task Queue System**: Queue, prioritize, and manage AI-assisted coding tasks with a Kanban-style board
- **Multi-Agent Support**: Integrate with Claude Code, Google Gemini CLI, and OpenRouter API
- **Git Worktree Isolation**: Each task runs in its own git worktree on dedicated branches for parallel execution without conflicts
- **Planning Sessions**: Interactive AI-assisted planning with multi-turn conversations before task execution
- **Task Review Interface**: Review AI-generated changes with diff viewer, accept/reject workflows, and re-prompting
- **Project Management**: Organize tasks by project with vault-based configuration
- **Skills System**: Customizable skill prompts that modify agent behavior (TypeScript Expert, React Best Practices, etc.)
- **Notes with Mentions**: Rich text note-taking with @mentions for tasks and projects
- **Desktop Notifications**: Get notified when tasks complete with customizable sounds
- **Theme System**: Multiple light and dark themes with system preference matching
- **Voice Input**: Optional speech-to-text for creating tasks via voice
- **Keyboard Shortcuts**: Comprehensive keyboard navigation throughout the app
- **SQLite Storage**: Local-first data persistence with secure API key storage via OS keychain
- **Cross-Platform**: Support for macOS, Windows, and Linux

### Technical

- Built with Electron 39, React 19, TypeScript 5.9
- Zustand for state management
- TanStack Router for navigation
- Radix UI + Tailwind CSS for the interface
- TipTap for rich text editing
- simple-git for git operations
- better-sqlite3 for database

[Unreleased]: https://github.com/owlkaboom/nightshift/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/owlkaboom/nightshift/compare/v0.2.3...v0.3.0
[0.2.3]: https://github.com/owlkaboom/nightshift/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/owlkaboom/nightshift/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/owlkaboom/nightshift/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/owlkaboom/nightshift/compare/v0.2.0-beta.1...v0.2.0
[0.2.0-beta]: https://github.com/owlkaboom/nightshift/compare/v0.1.0-beta...v0.2.0-beta
[0.1.0-beta]: https://github.com/owlkaboom/nightshift/releases/tag/v0.1.0-beta
