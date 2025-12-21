# Changelog

All notable changes to Nightshift will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/owlkaboom/nightshift/compare/v0.2.0-beta...HEAD
[0.2.0-beta]: https://github.com/owlkaboom/nightshift/compare/v0.1.0-beta...v0.2.0-beta
[0.1.0-beta]: https://github.com/owlkaboom/nightshift/releases/tag/v0.1.0-beta
