# Plan: Documentation Generation System

## Overview

Add systematic documentation generation capabilities that create and maintain documentation within project repositories. Documentation types include:
- **CLAUDE.md** - Agent context documentation
- **README.md** - Project overview documentation
- **Architecture docs** - System design documentation
- **API docs** - Endpoint/interface documentation

## Goals

1. **Generate documentation** from project analysis
2. **Interactive review** before committing to repository
3. **Update existing docs** rather than just creating new ones
4. **Support multiple doc types** with appropriate templates
5. **Group-level documentation** for multi-project workspaces

## Architecture

### New Types (`src/shared/types/documentation.ts`)

```typescript
/**
 * Types of documentation that can be generated
 */
export type DocumentationType =
  | 'claude-md'      // CLAUDE.md - Agent instructions
  | 'readme'         // README.md - Project overview
  | 'architecture'   // ARCHITECTURE.md or .claude/docs/architecture.md
  | 'api'            // API.md - API documentation
  | 'contributing'   // CONTRIBUTING.md
  | 'changelog'      // CHANGELOG.md
  | 'custom'         // User-defined

/**
 * Documentation generation request
 */
export interface DocGenerationRequest {
  projectId: string
  type: DocumentationType

  // Options
  outputPath?: string  // Override default path
  updateExisting?: boolean  // Merge with existing doc if present
  sections?: string[]  // Specific sections to generate/update
  customInstructions?: string  // Additional instructions for generation
}

/**
 * Generated documentation result
 */
export interface GeneratedDoc {
  type: DocumentationType
  content: string
  suggestedPath: string
  existingContent?: string  // If updating, the original content
  diff?: string  // Visual diff if updating
  metadata: {
    generatedAt: string
    projectId: string
    projectName: string
    sections: string[]
  }
}

/**
 * Documentation session - like planning but for docs
 */
export interface DocSession {
  id: string
  projectId: string
  type: DocumentationType
  status: 'generating' | 'reviewing' | 'editing' | 'committed' | 'cancelled'

  generatedContent: string
  editedContent: string
  targetPath: string

  messages: DocSessionMessage[]  // Conversation for refinements

  createdAt: string
  updatedAt: string
}

export interface DocSessionMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

/**
 * Documentation template
 */
export interface DocTemplate {
  id: string
  type: DocumentationType
  name: string
  description: string
  sections: DocTemplateSection[]
  defaultPath: string
  isBuiltIn: boolean
}

export interface DocTemplateSection {
  id: string
  name: string
  description: string
  required: boolean
  exampleContent?: string
}
```

### Built-in Templates

#### CLAUDE.md Template
```typescript
{
  id: 'claude-md-default',
  type: 'claude-md',
  name: 'Claude Code Instructions',
  description: 'Project-specific instructions for Claude Code',
  defaultPath: 'CLAUDE.md',
  sections: [
    { id: 'overview', name: 'Project Overview', required: true },
    { id: 'quick-start', name: 'Quick Start', required: true },
    { id: 'architecture', name: 'Architecture Overview', required: false },
    { id: 'project-structure', name: 'Project Structure', required: true },
    { id: 'tech-stack', name: 'Technology Stack', required: true },
    { id: 'conventions', name: 'Code Conventions', required: false },
    { id: 'important-files', name: 'Important Files', required: false },
    { id: 'common-tasks', name: 'Common Tasks', required: false },
  ]
}
```

#### README.md Template
```typescript
{
  id: 'readme-default',
  type: 'readme',
  name: 'Standard README',
  defaultPath: 'README.md',
  sections: [
    { id: 'title', name: 'Title & Badges', required: true },
    { id: 'description', name: 'Description', required: true },
    { id: 'features', name: 'Features', required: false },
    { id: 'installation', name: 'Installation', required: true },
    { id: 'usage', name: 'Usage', required: true },
    { id: 'configuration', name: 'Configuration', required: false },
    { id: 'api', name: 'API Reference', required: false },
    { id: 'contributing', name: 'Contributing', required: false },
    { id: 'license', name: 'License', required: true },
  ]
}
```

#### Architecture Template
```typescript
{
  id: 'architecture-default',
  type: 'architecture',
  name: 'Architecture Documentation',
  defaultPath: '.claude/docs/ARCHITECTURE.md',
  sections: [
    { id: 'overview', name: 'System Overview', required: true },
    { id: 'diagram', name: 'Architecture Diagram', required: false },
    { id: 'components', name: 'Core Components', required: true },
    { id: 'data-flow', name: 'Data Flow', required: false },
    { id: 'integrations', name: 'External Integrations', required: false },
    { id: 'decisions', name: 'Design Decisions', required: false },
  ]
}
```

### New Service: Documentation Generator (`src/main/docs/doc-generator.ts`)

```typescript
class DocumentationGenerator {
  // Core generation
  async generateDoc(request: DocGenerationRequest): Promise<GeneratedDoc>
  async generateSection(projectId: string, type: DocumentationType, sectionId: string): Promise<string>

  // Session management
  async createSession(projectId: string, type: DocumentationType): Promise<DocSession>
  async getSession(sessionId: string): Promise<DocSession | null>
  async updateSessionContent(sessionId: string, content: string): Promise<void>
  async sendRefinementMessage(sessionId: string, message: string): Promise<string>
  async commitSession(sessionId: string): Promise<void>
  async cancelSession(sessionId: string): Promise<void>

  // Templates
  async getTemplates(): Promise<DocTemplate[]>
  async getTemplate(type: DocumentationType): Promise<DocTemplate>

  // Analysis
  async analyzeExistingDocs(projectPath: string): Promise<ExistingDocAnalysis>
  async suggestDocImprovements(projectId: string): Promise<DocSuggestion[]>
}

interface ExistingDocAnalysis {
  hasClaudeMd: boolean
  hasReadme: boolean
  hasArchitectureDocs: boolean
  hasApiDocs: boolean
  docs: { path: string; type: DocumentationType; lastModified: string }[]
  suggestions: string[]
}

interface DocSuggestion {
  type: DocumentationType
  reason: string
  priority: 'high' | 'medium' | 'low'
}
```

### IPC Handlers (`src/main/ipc/doc-handlers.ts`)

```typescript
// Generation
'docs:generate' → generateDoc(request)
'docs:generateSection' → generateSection(projectId, type, sectionId)

// Sessions
'docs:createSession' → createSession(projectId, type)
'docs:getSession' → getSession(sessionId)
'docs:listSessions' → listSessions(projectId)
'docs:updateContent' → updateSessionContent(sessionId, content)
'docs:refine' → sendRefinementMessage(sessionId, message)
'docs:commit' → commitSession(sessionId)
'docs:cancel' → cancelSession(sessionId)

// Templates
'docs:getTemplates' → getTemplates()
'docs:getTemplate' → getTemplate(type)

// Analysis
'docs:analyze' → analyzeExistingDocs(projectId)
'docs:suggest' → suggestDocImprovements(projectId)
```

### UI Components

#### 1. Documentation View (`src/renderer/src/views/DocsView.tsx`)

New top-level view for documentation management:
- Project selector
- Doc type grid (CLAUDE.md, README, Architecture, API, etc.)
- Active session indicator
- Recent doc sessions list

#### 2. Doc Generation Panel (`src/renderer/src/components/docs/DocGenerationPanel.tsx`)

Main generation interface:
- Template/section selector
- "Generate" button
- Progress indicator during generation
- Preview pane with markdown rendering

#### 3. Doc Editor (`src/renderer/src/components/docs/DocEditor.tsx`)

Interactive editing after generation:
- Split view: Editor | Preview
- Section navigation
- Refinement chat panel (ask AI to modify specific parts)
- Diff view toggle (when updating existing docs)
- Save/Commit/Cancel actions

#### 4. Doc Chat (`src/renderer/src/components/docs/DocChat.tsx`)

Refinement conversation interface:
- Similar to planning chat
- "Make the installation section more detailed"
- "Add a section about environment variables"
- Applies changes to the document in real-time

#### 5. Doc Status Widget (`src/renderer/src/components/docs/DocStatusWidget.tsx`)

Shows documentation status for a project:
- Which docs exist
- Last updated dates
- Suggestions for missing/outdated docs
- Quick action buttons

### Integration Points

#### Project Settings

Add documentation status to project settings:
- Current docs overview
- "Generate CLAUDE.md" quick action
- "Update README" quick action
- Full "Manage Docs" link

#### Sidebar Navigation

Add "Docs" to sidebar navigation:
- New route: `/docs`
- Badge showing active doc sessions

#### Planning Integration

Allow converting planning sessions to documentation:
- "Save as Architecture Doc" option
- Extract key decisions from planning into docs

## Implementation Steps

### Phase 1: Core Infrastructure
1. Create documentation types in `src/shared/types/documentation.ts`
2. Implement built-in templates
3. Create `DocumentationGenerator` service
4. Add doc session storage (SQLite table or JSON files)
5. Implement IPC handlers

### Phase 2: Basic Generation
6. Implement CLAUDE.md generation (highest priority)
7. Implement README.md generation
8. Create simple generation UI (generate → preview → commit)

### Phase 3: Interactive Editing
9. Create `DocEditor` component with split view
10. Implement refinement chat functionality
11. Add diff view for updates
12. Session persistence and resume

### Phase 4: Full Documentation Suite
13. Add Architecture doc generation
14. Add API doc generation
15. Create doc templates UI for customization
16. Implement doc suggestions based on project analysis

### Phase 5: Advanced Features
17. Group-level documentation (multi-project overview)
18. Automatic doc update suggestions (when code changes)
19. Doc versioning/history
20. Export to other formats (if needed)

## File Structure

```
src/
├── shared/types/
│   └── documentation.ts          # New types
├── main/
│   ├── docs/
│   │   ├── doc-generator.ts      # Core service
│   │   ├── templates.ts          # Built-in templates
│   │   └── doc-session-store.ts  # Session persistence
│   └── ipc/
│       └── doc-handlers.ts       # IPC handlers
├── preload/
│   └── index.ts                  # Add new API exposure
└── renderer/src/
    ├── views/
    │   └── DocsView.tsx          # New view
    ├── components/docs/
    │   ├── DocGenerationPanel.tsx
    │   ├── DocEditor.tsx
    │   ├── DocChat.tsx
    │   ├── DocStatusWidget.tsx
    │   ├── DocPreview.tsx
    │   ├── DiffView.tsx
    │   └── index.ts
    ├── stores/
    │   └── doc-store.ts
    └── routes/
        └── docs.tsx              # New route
```

## AI Generation Strategy

### Project Analysis for Generation

Before generating, analyze the project to gather context:

```typescript
async function gatherDocContext(projectPath: string, docType: DocumentationType) {
  const context = {
    // Always gather
    packageJson: await readPackageJson(projectPath),
    readme: await readIfExists(join(projectPath, 'README.md')),
    claudeMd: await readIfExists(join(projectPath, 'CLAUDE.md')),

    // Directory structure (limited depth)
    structure: await getDirectoryTree(projectPath, { maxDepth: 3 }),

    // Key files based on project type
    configFiles: await findConfigFiles(projectPath),

    // For architecture docs
    entryPoints: await findEntryPoints(projectPath),

    // For API docs
    routeFiles: await findRouteFiles(projectPath),
  }

  return context
}
```

### Generation Prompts

Each doc type has a tailored generation prompt:

**CLAUDE.md:**
```
You are generating a CLAUDE.md file for a software project. This file provides
context and instructions for Claude Code (an AI coding assistant).

Analyze the project and create comprehensive documentation that helps an AI
understand:
1. What this project is and its purpose
2. How to run/build/test it
3. The architecture and key components
4. Important conventions and patterns
5. Common tasks and how to perform them

Be specific and include actual paths, commands, and file names from the project.
```

**README.md:**
```
You are generating a README.md file for a software project. The README should
be user-friendly and help developers quickly understand and get started with
the project.

Include:
1. Clear project title and description
2. Key features and capabilities
3. Installation instructions
4. Usage examples
5. Configuration options
6. How to contribute

Write for human developers, not AI. Be concise but thorough.
```

## Open Questions

1. **Storage location for sessions**: SQLite table vs JSON files in `~/.nightshift/docs/`?

2. **Git integration**: Should we auto-commit generated docs, or just write to filesystem?

3. **Template customization**: Allow users to create custom templates? Where to store them?

4. **Update detection**: How to detect when docs are outdated (code changed significantly)?

5. **Multi-project docs**: For groups, generate overview docs that reference all projects?

## Success Criteria

- [ ] Users can generate CLAUDE.md for any project with one click
- [ ] Users can interactively refine generated documentation
- [ ] Documentation is committed to the project repository
- [ ] Existing docs can be updated/merged with new content
- [ ] Multiple documentation types are supported
- [ ] Documentation status is visible in project settings
