# Planning System

## Overview

Nightshift's planning system uses Claude Code to help developers plan features and projects through interactive conversations. The planning agent creates structured markdown plan files that can be converted into actionable tasks.

## Plan File Organization

### Single-File Plans

For simple features or projects, use a single plan file in the `plans/` directory:

```
plans/
└── add-dark-mode.md
```

### Multi-File Plans

For complex features with multiple phases or detailed sections, use a directory structure:

```
plans/
├── user-authentication.md           # Main plan file (overview + links)
└── user-authentication/
    ├── phase-1-backend.md          # Backend implementation details
    ├── phase-2-frontend.md         # Frontend implementation details
    ├── phase-3-testing.md          # Testing strategy
    └── security-considerations.md   # Security analysis
```

**Guidelines:**
- Keep main plan files under 300 lines
- Use sub-directories for detailed sections
- Main file contains:
  - Executive summary
  - High-level requirements
  - Links to detailed sub-files
  - Master task checklist
- Sub-files organized by:
  - Implementation phases
  - Major components or modules
  - Technical deep-dives
  - Testing strategies

## Session Types

### General Planning (`general`)

Free-form planning conversations for any feature or task. The agent is instructed to:
- Create a plan file in `plans/` directory
- Structure the plan with clear sections
- Include actionable tasks
- Use multi-file structure for complex plans

### Project Initialization (`init`)

Specialized planning for new projects. The agent:
- Discusses project requirements
- Proposes directory structure
- Identifies key components
- Creates comprehensive initialization plan
- Can use multi-file structure for complex projects

### CLAUDE.md Improvement (`claude-md`)

Focused on improving project documentation for AI assistants. The agent:
- Reviews current CLAUDE.md
- Suggests improvements
- Recommends organizing into `.claude/docs/` when file exceeds 300 lines

## Plan File Structure

### Main Plan File Template

```markdown
# [Feature/Project Name]

## Overview
High-level description of what this plan accomplishes.

## Plan Structure
This plan is organized into multiple documents:
- [Phase 1: Setup](./feature-name/phase-1-setup.md)
- [Phase 2: Implementation](./feature-name/phase-2-implementation.md)
- [Phase 3: Testing](./feature-name/phase-3-testing.md)

## High-Level Requirements
- Requirement 1
- Requirement 2

## Implementation Order
1. Phase 1: Setup (see detailed plan)
2. Phase 2: Implementation (see detailed plan)
3. Phase 3: Testing (see detailed plan)

## Master Task List
- [ ] Task from Phase 1
- [ ] Task from Phase 2
- [ ] Task from Phase 3
```

### Sub-File Template

```markdown
# Phase 1: Backend Implementation

## Overview
Detailed description of this phase.

## Requirements
- Specific requirement 1
- Specific requirement 2

## Implementation Steps
1. Step 1 with detailed instructions
2. Step 2 with detailed instructions

## Files to Modify
- `src/backend/auth.ts` - Add authentication logic
- `src/backend/db.ts` - Database schema changes

## Technical Decisions
- Decision 1 and rationale
- Decision 2 and rationale

## Testing
- Unit tests for X
- Integration tests for Y
```

## UI Features

### File Detection

The planning UI automatically detects file references in messages:
- Plan files: `plans/feature.md` or `plans/feature/phase-1.md`
- Source files: `src/components/App.tsx`
- Config files: `package.json`, `.eslintrc.js`

Detected files show:
- **View** button to read file contents
- **Task** button (for plan files) to create tasks

### Creating Tasks from Plans

You can create tasks from:
1. **Entire plan file** - Click "Task" button on file reference
2. **Plan sections** - Hover over section headers, click "Create Task"
3. **Manual extraction** - Use plan extraction panel to select specific items

## Storage

### Session Storage
Planning sessions are stored in `~/.nightshift/planning/<session-id>/`:
- `session.json` - Full conversation history, metadata, extracted plan items

### Plan Files
Plan files are stored in the project repository:
- `<project-root>/plans/` - All plan files
- Created by Claude Code agent using the Write tool
- Version-controlled with the project
- Can be edited manually

## Best Practices

1. **Plan First** - Use planning sessions before implementing complex features
2. **Be Specific** - Provide clear requirements and constraints
3. **Review Plans** - Read generated plan files before converting to tasks
4. **Iterate** - Use `--resume` to continue planning conversations
5. **Organize** - Use multi-file structure for complex plans to reduce context size
6. **Link Sub-Files** - Always link to sub-files from main plan for easy navigation
7. **Version Control** - Commit plan files to track evolution of features

## Context Reduction Benefits

Multi-file plan organization reduces context size by:
- Keeping main files concise and focused
- Allowing agents to read only relevant sections
- Making plans easier to scan and understand
- Reducing token usage during task execution
- Improving plan maintainability

When an agent needs implementation details, it can:
1. Read the main plan file for overview
2. Identify relevant sub-file
3. Read only that specific sub-file
4. Load minimal context needed for the task
