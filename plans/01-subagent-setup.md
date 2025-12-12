# Plan: Sub-Agent Setup Support

## Overview

Add features to help users configure Claude Code sub-agents (personalities/specialists) for their projects. This includes generating and managing:
- **Sub-agents** (`.claude/agents/` or custom agent definitions)
- **Skills** (`.claude/skills/` directory)
- **Commands** (`.claude/commands/` directory)

## Background

Claude Code supports sub-agents which are specialized personalities that can be invoked for specific types of work. These are defined as markdown files that describe the agent's role, expertise, and behavior. Combined with skills (reusable instruction sets) and commands (slash command shortcuts), this creates a powerful customization system.

## Goals

1. **Analyze projects** to suggest appropriate sub-agents, skills, and commands
2. **Generate** sub-agent definitions based on project context
3. **Manage** the `.claude/` directory structure from within Nightshift
4. **Integrate** with existing Nightshift skill system (bridge between Nightshift skills and Claude skills)

## Architecture

### New Types (`src/shared/types/claude-config.ts`)

```typescript
/**
 * Claude Code sub-agent definition
 * Stored in .claude/agents/{name}.md
 */
export interface ClaudeAgent {
  name: string
  description: string
  prompt: string  // The markdown content
  filePath: string
  createdAt: string
  updatedAt: string
}

/**
 * Claude Code skill definition
 * Stored in .claude/skills/{name}.md
 */
export interface ClaudeSkill {
  name: string
  description: string
  prompt: string
  filePath: string
  enabled: boolean
}

/**
 * Claude Code command definition
 * Stored in .claude/commands/{name}.md
 */
export interface ClaudeCommand {
  name: string
  description: string
  prompt: string
  filePath: string
}

/**
 * Complete Claude configuration for a project
 */
export interface ClaudeProjectConfig {
  hasClaudeMd: boolean
  claudeMdPath: string | null
  agents: ClaudeAgent[]
  skills: ClaudeSkill[]
  commands: ClaudeCommand[]
  settings: Record<string, unknown> | null  // .claude/settings.json
}
```

### New Service: Claude Config Manager (`src/main/agents/claude-config-manager.ts`)

Responsibilities:
- Scan project for existing `.claude/` configuration
- Read/write agent, skill, and command files
- Generate new configurations using AI
- Validate configuration structure

```typescript
class ClaudeConfigManager {
  // Scanning
  async scanProject(projectPath: string): Promise<ClaudeProjectConfig>
  async getAgents(projectPath: string): Promise<ClaudeAgent[]>
  async getSkills(projectPath: string): Promise<ClaudeSkill[]>
  async getCommands(projectPath: string): Promise<ClaudeCommand[]>

  // CRUD operations
  async createAgent(projectPath: string, agent: Omit<ClaudeAgent, 'filePath' | 'createdAt' | 'updatedAt'>): Promise<ClaudeAgent>
  async updateAgent(projectPath: string, name: string, updates: Partial<ClaudeAgent>): Promise<ClaudeAgent>
  async deleteAgent(projectPath: string, name: string): Promise<void>

  async createSkill(projectPath: string, skill: Omit<ClaudeSkill, 'filePath'>): Promise<ClaudeSkill>
  async updateSkill(projectPath: string, name: string, updates: Partial<ClaudeSkill>): Promise<ClaudeSkill>
  async deleteSkill(projectPath: string, name: string): Promise<void>
  async toggleSkill(projectPath: string, name: string, enabled: boolean): Promise<void>

  async createCommand(projectPath: string, command: Omit<ClaudeCommand, 'filePath'>): Promise<ClaudeCommand>
  async updateCommand(projectPath: string, name: string, updates: Partial<ClaudeCommand>): Promise<ClaudeCommand>
  async deleteCommand(projectPath: string, name: string): Promise<void>

  // AI-powered generation
  async suggestAgents(projectPath: string): Promise<ClaudeAgent[]>
  async suggestSkills(projectPath: string): Promise<ClaudeSkill[]>
  async suggestCommands(projectPath: string): Promise<ClaudeCommand[]>
  async generateAgent(projectPath: string, purpose: string): Promise<ClaudeAgent>
  async generateSkill(projectPath: string, purpose: string): Promise<ClaudeSkill>
  async generateCommand(projectPath: string, purpose: string): Promise<ClaudeCommand>
}
```

### IPC Handlers (`src/main/ipc/claude-config-handlers.ts`)

```typescript
// Scanning
'claude-config:scan' → scanProject(projectId)
'claude-config:getAgents' → getAgents(projectId)
'claude-config:getSkills' → getSkills(projectId)
'claude-config:getCommands' → getCommands(projectId)

// Agent CRUD
'claude-config:createAgent' → createAgent(projectId, agent)
'claude-config:updateAgent' → updateAgent(projectId, name, updates)
'claude-config:deleteAgent' → deleteAgent(projectId, name)

// Skill CRUD
'claude-config:createSkill' → createSkill(projectId, skill)
'claude-config:updateSkill' → updateSkill(projectId, name, updates)
'claude-config:deleteSkill' → deleteSkill(projectId, name)
'claude-config:toggleSkill' → toggleSkill(projectId, name, enabled)

// Command CRUD
'claude-config:createCommand' → createCommand(projectId, command)
'claude-config:updateCommand' → updateCommand(projectId, name, updates)
'claude-config:deleteCommand' → deleteCommand(projectId, name)

// AI suggestions
'claude-config:suggestAgents' → suggestAgents(projectId)
'claude-config:suggestSkills' → suggestSkills(projectId)
'claude-config:suggestCommands' → suggestCommands(projectId)
'claude-config:generateAgent' → generateAgent(projectId, purpose)
'claude-config:generateSkill' → generateSkill(projectId, purpose)
'claude-config:generateCommand' → generateCommand(projectId, purpose)
```

### UI Components

#### 1. Claude Config Panel (`src/renderer/src/components/claude-config/ClaudeConfigPanel.tsx`)

Main panel for managing a project's Claude configuration. Tabs for:
- **Agents** - List, create, edit, delete sub-agents
- **Skills** - List, toggle, create, edit, delete skills
- **Commands** - List, create, edit, delete commands

#### 2. Agent Editor (`src/renderer/src/components/claude-config/AgentEditor.tsx`)

Form/editor for creating/editing sub-agents:
- Name field
- Description field
- Prompt editor (markdown with preview)
- "Generate from purpose" button (AI-assisted)
- Save/Cancel buttons

#### 3. Skill Editor (`src/renderer/src/components/claude-config/SkillEditor.tsx`)

Similar to AgentEditor but for skills.

#### 4. Command Editor (`src/renderer/src/components/claude-config/CommandEditor.tsx`)

Similar but for commands. Commands can include argument placeholders.

#### 5. Suggestion Dialog (`src/renderer/src/components/claude-config/SuggestionDialog.tsx`)

Shows AI-suggested agents/skills/commands for a project:
- Analyzes project structure and technologies
- Presents suggestions with descriptions
- User can select which to create
- Bulk creation option

### Integration Points

#### Project Detail View Enhancement

Add a "Claude Config" section to project settings:
- Shows current configuration status
- Quick links to manage agents/skills/commands
- "Analyze & Suggest" button

#### Task Creation Integration

When creating a task:
- Show available project-specific skills (from `.claude/skills/`)
- Allow selecting a sub-agent to use for the task
- This requires extending TaskManifest:

```typescript
interface TaskManifest {
  // ... existing fields
  claudeAgent?: string  // Name of sub-agent to use
  claudeSkills?: string[]  // Project-specific skills to enable
}
```

#### Agent Invocation Update

Modify `agent-handlers.ts` to:
- Pass `--agent` flag when a sub-agent is selected
- Reference project skills via `--skill` or appropriate mechanism

## Implementation Steps

### Phase 1: Core Infrastructure
1. Create `ClaudeProjectConfig` types in `src/shared/types/claude-config.ts`
2. Implement `ClaudeConfigManager` class with scanning and CRUD operations
3. Add IPC handlers for basic operations
4. Update preload to expose new APIs

### Phase 2: UI - Basic Management
5. Create `ClaudeConfigPanel` component with tabs
6. Implement `AgentEditor`, `SkillEditor`, `CommandEditor` components
7. Create Zustand store for Claude config state
8. Add "Claude Config" section to project settings

### Phase 3: AI-Powered Suggestions
9. Implement `suggestAgents`, `suggestSkills`, `suggestCommands` using Claude Code
10. Create `SuggestionDialog` component
11. Add "Analyze & Suggest" flow to project settings

### Phase 4: Task Integration
12. Extend `TaskManifest` with `claudeAgent` and `claudeSkills` fields
13. Update task creation UI to show project-specific options
14. Modify agent invocation to use selected sub-agent/skills

### Phase 5: Nightshift Skill Migration
15. Create migration path from Nightshift built-in skills to project skills
16. Option to "export" Nightshift skill to project `.claude/skills/`
17. Consider deprecation path for Nightshift-specific skills

## File Structure

```
src/
├── shared/types/
│   └── claude-config.ts          # New types
├── main/
│   ├── agents/
│   │   └── claude-config-manager.ts  # Core service
│   └── ipc/
│       └── claude-config-handlers.ts # IPC handlers
├── preload/
│   └── index.ts                  # Add new API exposure
└── renderer/src/
    ├── components/claude-config/
    │   ├── ClaudeConfigPanel.tsx
    │   ├── AgentEditor.tsx
    │   ├── SkillEditor.tsx
    │   ├── CommandEditor.tsx
    │   ├── SuggestionDialog.tsx
    │   └── index.ts
    └── stores/
        └── claude-config-store.ts
```

## Open Questions

1. **Sub-agent invocation**: How exactly does Claude Code invoke sub-agents? Need to verify the CLI flags/mechanism.

2. **Skill format**: Are Claude Code skills just markdown files, or is there a specific structure expected?

3. **Settings.json**: Should we also manage `.claude/settings.json` through this interface?

4. **Multi-agent portability**: How do we want to handle this for non-Claude agents? Options:
   - Ignore for now, Claude Code only
   - Store abstract skill definitions that can be "compiled" to different agent formats
   - Let each agent adapter handle its own config format

5. **Nightshift skill deprecation**: Timeline for moving away from built-in skills toward project-based skills?

## Success Criteria

- [ ] Users can view existing `.claude/` configuration for any project
- [ ] Users can create/edit/delete agents, skills, and commands
- [ ] AI can suggest appropriate configurations based on project analysis
- [ ] Task creation allows selecting project-specific agents and skills
- [ ] Existing Nightshift skills can be exported to project `.claude/skills/`
