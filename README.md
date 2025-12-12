# Nightshift

**AI Task Orchestrator for Developers**

Nightshift is a local-first desktop application that enables developers to queue, manage, and review AI-assisted coding tasks. Queue tasks overnight, review results in the morning—all while keeping your code secure on your local machine.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Electron](https://img.shields.io/badge/electron-39-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.9-blue.svg)

## Features

- **Queue Multiple Tasks** - Stack up coding tasks and let AI work through them sequentially
- **Git Worktree Isolation** - Each task runs in its own isolated git worktree branch
- **Human-in-the-Loop** - Review, approve, or reject AI-generated changes before merging
- **Multi-Agent Support** - Works with Claude Code, Google Gemini, and OpenRouter
- **Local-First** - All code stays on your machine; no cloud uploads
- **Planning Sessions** - Interactive AI-assisted planning before task execution
- **Custom Skills** - Enhance agent behavior with custom skill prompts
- **Note-Taking** - Built-in notes with task mentions for documentation
- **Project Management** - Organize tasks by projects and groups

## Quick Start

### Prerequisites

- Node.js 18 or higher
- Git
- One or more supported AI agents:
  - [Claude Code CLI](https://github.com/anthropics/claude-code)
  - [Google Gemini CLI](https://github.com/google/generative-ai-cli)
  - OpenRouter API key

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/nightshift.git
cd nightshift

# Install dependencies
npm install

# Start development mode
npm run dev
```

### Building from Source

```bash
# Build for your platform
npm run build

# Platform-specific builds
npm run build:mac        # macOS (universal)
npm run build:win        # Windows
npm run build:linux      # Linux
```

## Usage

### 1. Configure Agents

On first launch, navigate to Settings to configure your AI agents:

- Install Claude Code CLI or Gemini CLI
- Add API keys for OpenRouter if using that service
- Nightshift will auto-detect available agents

### 2. Create a Project

Projects help organize your tasks:

1. Click "New Project" in the Projects view
2. Select your git repository directory
3. Configure default agent and skills

### 3. Queue Tasks

Add tasks to the queue:

1. Click "Add Task" on the Board view
2. Write a clear description of what needs to be done
3. Select an agent and optional skills
4. Choose priority (low, medium, high, critical)

### 4. Review Results

When tasks complete:

1. View the diff of changes made
2. Read the agent's execution log
3. Accept to merge changes or reject to discard
4. Re-prompt if changes need refinement

## How It Works

### Task Lifecycle

```
queued → running → needs_review/failed → accepted/rejected
```

1. **Queued** - Waiting for execution
2. **Running** - Agent actively working on task
3. **Needs Review** - Complete, awaiting your review
4. **Failed** - Error occurred (rate limit, auth, etc.)
5. **Accepted** - Changes approved and ready to merge
6. **Rejected** - Changes discarded

### Git Worktrees

Each task runs in an isolated git worktree:

- No conflicts between parallel tasks
- Full isolation from your main branch
- You control when to merge changes
- Branch naming: `nightshift/task-{id}`

### Agent Adapters

Nightshift uses an adapter pattern to support multiple AI coding assistants:

- **Claude Code** - Anthropic's Claude CLI for coding tasks
- **Gemini** - Google's Gemini CLI with code capabilities
- **OpenRouter** - Access to multiple AI models via API

## Technology Stack

- **Framework**: Electron 39 + React 19 + TypeScript 5.9
- **State Management**: Zustand
- **Routing**: TanStack Router
- **UI Components**: Radix UI + Tailwind CSS 4
- **Database**: SQLite (better-sqlite3)
- **Git Operations**: simple-git
- **Rich Text**: TipTap editor

## Data Storage

All data is stored locally in `~/.nightshift/`:

- `nightshift.db` - SQLite database (tasks, projects, notes)
- `config.json` - Application configuration
- `worktrees/` - Task working directories
- API keys stored encrypted via OS keychain (Keychain/Credential Manager)

## Development

### Running Tests

```bash
npm run test          # Run test suite
npm run typecheck     # TypeScript type checking
npm run lint          # ESLint checks
npm run lint:fix      # Auto-fix linting issues
```

### Project Structure

```
src/
├── main/           # Electron main process (Node.js)
├── renderer/       # React UI (TypeScript + Tailwind)
├── preload/        # Secure IPC bridge
└── shared/         # Shared types & constants
```

For detailed architecture documentation, see [CLAUDE.md](./CLAUDE.md).

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

Nightshift is designed with security in mind:

- **Local-first**: Code never leaves your machine
- **Encrypted secrets**: API keys stored in OS keychain
- **Git isolation**: Tasks run in isolated worktrees
- **No telemetry**: No usage tracking or analytics

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/nightshift/issues)
- **Documentation**: [.claude/docs](./.claude/docs)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/nightshift/discussions)

## Acknowledgments

Built with:
- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Claude Code](https://github.com/anthropics/claude-code)

---

**Note**: Replace `yourusername` in URLs with your actual GitHub username before publishing.
