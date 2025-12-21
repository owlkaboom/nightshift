# Project Git Management Features

## Overview

Add Git management capabilities to project workflows, including branch creation, AI-assisted commit authoring, and a VS Code-style diff viewer. These features will live in a new **Project Detail View** that consolidates project-specific functionality.

## Requirements

### Core Features
1. **Branch Creation** - Create new branches from the current branch or any ref
2. **AI Commit Authoring** - Generate commit messages from staged changes using Claude Haiku
3. **Diff Viewer** - VS Code-style file-by-file diff viewer with:
   - File tree showing changed files (added/modified/deleted indicators)
   - Side-by-side or inline diff view per file
   - Ability to stage/unstage individual files
4. **Remote Operations** - Push, pull, and fetch with remote tracking
5. **Stash Management** - Save, list, apply, and drop stashes

### UX Goals
- Discoverable without cluttering the board (which is multi-project)
- Natural workflow for project-specific Git operations
- Familiar patterns for developers (VS Code-like diff experience)

## Architecture Decision: Project Detail View

### Recommendation: Create `/projects/:projectId` Route

**Rationale:**
- Projects are first-class entities deserving their own detail page
- Git operations are inherently project-scoped
- Consolidates existing `/context` (CLAUDE.md) functionality
- Room for future growth (issues, PRs, activity logs)

**Navigation Flow:**
```
/projects (grid) → click project → /projects/:projectId (detail view)
```

### Tab Structure

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Projects    [Project Name]    [Open in Finder]  │
├─────────────────────────────────────────────────────────────┤
│  [Overview] [Source Control] [Context] [Activity]          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tab content here...                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

1. **Overview** - Project metadata, quick stats, recent activity
2. **Source Control** - Git management (branches, staging, commits, diffs)
3. **Context** - CLAUDE.md management (migrate from `/context`)
4. **Activity** (future) - Task history, logs for this project

## Technical Design

### 1. New Git Operations (Backend)

Add to `src/main/git/`:

```typescript
// git-operations.ts (new file)

// Branch operations
export async function listBranches(repoPath: string): Promise<BranchInfo[]>
export async function createBranch(repoPath: string, name: string, startPoint?: string): Promise<void>
export async function checkoutBranch(repoPath: string, name: string): Promise<void>
export async function deleteBranch(repoPath: string, name: string, force?: boolean): Promise<void>

// Staging operations
export async function getStatus(repoPath: string): Promise<FileStatus[]>
export async function stageFiles(repoPath: string, files: string[]): Promise<void>
export async function unstageFiles(repoPath: string, files: string[]): Promise<void>
export async function stageAll(repoPath: string): Promise<void>

// Diff operations
export async function getDiff(repoPath: string, file?: string, staged?: boolean): Promise<string>
export async function getFileDiff(repoPath: string, file: string): Promise<FileDiff>

// Commit operations
export async function commit(repoPath: string, message: string): Promise<CommitResult>
export async function getRecentCommits(repoPath: string, count?: number): Promise<CommitInfo[]>

// Remote operations
export async function fetch(repoPath: string, remote?: string): Promise<FetchResult>
export async function pull(repoPath: string, remote?: string, branch?: string): Promise<PullResult>
export async function push(repoPath: string, remote?: string, branch?: string, options?: PushOptions): Promise<PushResult>
export async function getRemoteStatus(repoPath: string): Promise<RemoteStatus>

// Stash operations
export async function stashSave(repoPath: string, message?: string, includeUntracked?: boolean): Promise<void>
export async function stashList(repoPath: string): Promise<StashEntry[]>
export async function stashApply(repoPath: string, index?: number): Promise<void>
export async function stashPop(repoPath: string, index?: number): Promise<void>
export async function stashDrop(repoPath: string, index?: number): Promise<void>
```

### 2. New Types

Add to `src/shared/types/git.ts` (new file):

```typescript
export interface BranchInfo {
  name: string
  current: boolean
  remote?: string
  tracking?: string
  ahead?: number
  behind?: number
}

export interface FileStatus {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked'
  staged: boolean
  oldPath?: string // for renames
}

export interface FileDiff {
  path: string
  status: FileStatus['status']
  hunks: DiffHunk[]
  additions: number
  deletions: number
}

export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

export interface DiffLine {
  type: 'context' | 'add' | 'delete'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

export interface CommitInfo {
  hash: string
  shortHash: string
  message: string
  author: string
  email: string
  date: string
}

export interface CommitResult {
  hash: string
  branch: string
}

// Remote operation types
export interface RemoteStatus {
  remote: string
  branch: string
  ahead: number
  behind: number
  tracking: string | null
}

export interface FetchResult {
  remote: string
  updated: boolean
}

export interface PullResult {
  files: string[]
  insertions: number
  deletions: number
  summary: string
}

export interface PushResult {
  remote: string
  branch: string
  success: boolean
}

export interface PushOptions {
  force?: boolean
  setUpstream?: boolean
}

// Stash types
export interface StashEntry {
  index: number
  message: string
  date: string
  branch: string
}
```

### 3. IPC Handlers

Add to `src/main/ipc/git-handlers.ts`:

```typescript
// Branch operations
'git:listBranches': (projectId: string) => Promise<BranchInfo[]>
'git:createBranch': (projectId: string, name: string, startPoint?: string) => Promise<void>
'git:checkoutBranch': (projectId: string, name: string) => Promise<void>
'git:deleteBranch': (projectId: string, name: string, force?: boolean) => Promise<void>

// Status & staging
'git:getStatus': (projectId: string) => Promise<FileStatus[]>
'git:stageFiles': (projectId: string, files: string[]) => Promise<void>
'git:unstageFiles': (projectId: string, files: string[]) => Promise<void>
'git:stageAll': (projectId: string) => Promise<void>

// Diffs
'git:getDiff': (projectId: string, options?: { file?: string, staged?: boolean }) => Promise<string>
'git:getFileDiff': (projectId: string, file: string) => Promise<FileDiff>

// Commits
'git:commit': (projectId: string, message: string) => Promise<CommitResult>
'git:getRecentCommits': (projectId: string, count?: number) => Promise<CommitInfo[]>

// AI commit message
'git:generateCommitMessage': (projectId: string) => Promise<string>

// Remote operations
'git:fetch': (projectId: string, remote?: string) => Promise<FetchResult>
'git:pull': (projectId: string, remote?: string, branch?: string) => Promise<PullResult>
'git:push': (projectId: string, remote?: string, branch?: string, options?: PushOptions) => Promise<PushResult>
'git:getRemoteStatus': (projectId: string) => Promise<RemoteStatus>

// Stash operations
'git:stashSave': (projectId: string, message?: string, includeUntracked?: boolean) => Promise<void>
'git:stashList': (projectId: string) => Promise<StashEntry[]>
'git:stashApply': (projectId: string, index?: number) => Promise<void>
'git:stashPop': (projectId: string, index?: number) => Promise<void>
'git:stashDrop': (projectId: string, index?: number) => Promise<void>
```

### 4. AI Commit Message Generation

Use Claude Haiku for fast, cost-effective commit message generation:

```typescript
// src/main/git/commit-message-generator.ts

export async function generateCommitMessage(repoPath: string): Promise<string> {
  // 1. Get staged diff
  const diff = await getDiff(repoPath, undefined, true)

  // 2. Get recent commits for style reference
  const recentCommits = await getRecentCommits(repoPath, 5)

  // 3. Build prompt
  const prompt = buildCommitPrompt(diff, recentCommits)

  // 4. Call Claude Haiku (fast and cost-effective for this task)
  const message = await generateWithHaiku(prompt)

  return message
}

function buildCommitPrompt(diff: string, recentCommits: CommitInfo[]): string {
  return `Generate a concise git commit message for the following changes.

Style guide based on recent commits:
${recentCommits.map(c => `- ${c.message}`).join('\n')}

Changes:
\`\`\`diff
${diff}
\`\`\`

Write a commit message that:
1. Starts with a type prefix if the repo uses conventional commits
2. Is concise but descriptive (50-72 chars for subject)
3. Matches the style of recent commits
4. Explains WHAT changed and WHY (not HOW)

Return only the commit message, no explanation.`
}
```

### 5. UI Components

#### Project Detail View
`src/renderer/src/views/ProjectDetailView.tsx`

```tsx
// Route: /projects/:projectId
export function ProjectDetailView() {
  const { projectId } = useParams()
  const project = useProject(projectId)
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div>
      <ProjectDetailHeader project={project} />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="source-control">Source Control</TabsTrigger>
          <TabsTrigger value="context">Context</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <ProjectOverviewTab project={project} />
        </TabsContent>
        <TabsContent value="source-control">
          <SourceControlTab project={project} />
        </TabsContent>
        <TabsContent value="context">
          {/* Migrate ProjectContextView content here */}
          <ProjectContextTab project={project} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

#### Source Control Tab
`src/renderer/src/components/projects/source-control/SourceControlTab.tsx`

```tsx
export function SourceControlTab({ project }: { project: Project }) {
  return (
    <div className="flex h-full">
      {/* Left panel: file tree */}
      <div className="w-64 border-r flex flex-col">
        <RemoteStatusBar project={project} />
        <BranchSelector project={project} />
        <ChangedFilesList project={project} />
        <StashSection project={project} />
        <CommitPanel project={project} />
      </div>

      {/* Right panel: diff viewer */}
      <div className="flex-1">
        <DiffViewer project={project} />
      </div>
    </div>
  )
}
```

#### Remote Status Bar Component
`src/renderer/src/components/projects/source-control/RemoteStatusBar.tsx`

- Shows ahead/behind count relative to remote (e.g., "↑2 ↓3")
- Fetch button (refresh icon)
- Pull button (with count badge if behind)
- Push button (with count badge if ahead)
- Loading states during operations
- Error handling for network issues

#### Branch Selector Component
`src/renderer/src/components/projects/source-control/BranchSelector.tsx`

- Dropdown showing current branch
- List of local and remote branches
- "Create Branch" button → dialog
- Branch search/filter

#### Stash Section Component
`src/renderer/src/components/projects/source-control/StashSection.tsx`

- Collapsible section showing stash count
- "Stash Changes" button with optional message input
- List of stash entries with:
  - Stash message and date
  - Apply button (keeps stash)
  - Pop button (applies and removes)
  - Drop button (discards with confirmation)
- Option to include untracked files when stashing

#### Changed Files List
`src/renderer/src/components/projects/source-control/ChangedFilesList.tsx`

- Staged changes section (collapsible)
- Unstaged changes section (collapsible)
- File icons with status indicators (A/M/D/R)
- Click to view diff
- Checkbox or +/- button to stage/unstage

#### Diff Viewer Component
`src/renderer/src/components/projects/source-control/DiffViewer.tsx`

Options for implementation:
1. **react-diff-viewer-continued** - Popular, customizable
2. **monaco-editor** with diff mode - VS Code native experience
3. **Custom with Prism/Shiki** - Lightweight, full control

Recommendation: **monaco-editor** for authentic VS Code experience

```tsx
import { DiffEditor } from '@monaco-editor/react'

export function DiffViewer({ file, diff }: Props) {
  return (
    <DiffEditor
      original={diff.originalContent}
      modified={diff.modifiedContent}
      language={getLanguageFromPath(file.path)}
      options={{
        readOnly: true,
        renderSideBySide: true,
        minimap: { enabled: false }
      }}
    />
  )
}
```

#### Commit Panel
`src/renderer/src/components/projects/source-control/CommitPanel.tsx`

```tsx
export function CommitPanel({ project }: Props) {
  const [message, setMessage] = useState('')
  const [generating, setGenerating] = useState(false)

  const handleGenerate = async () => {
    setGenerating(true)
    const generated = await window.api.git.generateCommitMessage(project.id)
    setMessage(generated)
    setGenerating(false)
  }

  return (
    <div className="p-4 border-t">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium">Commit Message</span>
        <Button size="sm" variant="ghost" onClick={handleGenerate}>
          <Sparkles className="h-4 w-4" />
          Generate
        </Button>
      </div>
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Enter commit message..."
        rows={4}
      />
      <Button className="w-full mt-2" disabled={!message.trim()}>
        Commit
      </Button>
    </div>
  )
}
```

### 6. Route Configuration

Update TanStack Router configuration:

```tsx
// src/renderer/src/routes/projects.$projectId.tsx (new file)
export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectDetailView,
  loader: ({ params }) => {
    // Preload project data
    return { projectId: params.projectId }
  }
})
```

### 7. State Management

Create a new Zustand store for source control state:

```typescript
// src/renderer/src/stores/source-control-store.ts

interface SourceControlState {
  // Current project context
  projectId: string | null

  // Branch state
  branches: BranchInfo[]
  currentBranch: string | null

  // Remote state
  remoteStatus: RemoteStatus | null
  isFetching: boolean
  isPulling: boolean
  isPushing: boolean

  // Stash state
  stashes: StashEntry[]
  isStashing: boolean

  // File status
  stagedFiles: FileStatus[]
  unstagedFiles: FileStatus[]

  // Diff viewing
  selectedFile: string | null
  currentDiff: FileDiff | null

  // Commit
  commitMessage: string
  isCommitting: boolean
  isGeneratingMessage: boolean

  // Actions - Status & Files
  loadStatus: (projectId: string) => Promise<void>
  loadBranches: (projectId: string) => Promise<void>
  stageFile: (file: string) => Promise<void>
  unstageFile: (file: string) => Promise<void>
  stageAll: () => Promise<void>
  unstageAll: () => Promise<void>
  discardChanges: (file: string) => Promise<void>
  discardAllChanges: () => Promise<void>
  selectFile: (file: string) => Promise<void>

  // Actions - Commit
  setCommitMessage: (message: string) => void
  generateCommitMessage: () => Promise<void>
  commit: () => Promise<void>

  // Actions - Branches
  createBranch: (name: string, startPoint?: string) => Promise<void>
  checkoutBranch: (name: string) => Promise<void>
  deleteBranch: (name: string, force?: boolean) => Promise<void>

  // Actions - Remote
  fetch: () => Promise<void>
  pull: () => Promise<void>
  push: (options?: PushOptions) => Promise<void>

  // Actions - Stash
  loadStashes: () => Promise<void>
  stashSave: (message?: string, includeUntracked?: boolean) => Promise<void>
  stashApply: (index: number) => Promise<void>
  stashPop: (index: number) => Promise<void>
  stashDrop: (index: number) => Promise<void>
}
```

## Migration Plan

### Phase 1: Backend Git Operations
1. Create `src/main/git/git-operations.ts` with core Git functions
2. Add types to `src/shared/types/git.ts`
3. Add IPC handlers to `src/main/ipc/git-handlers.ts`
4. Update `src/shared/ipc-types.ts` with new channels
5. Update preload to expose new APIs

### Phase 2: Project Detail View Shell
1. Create route `/projects/:projectId`
2. Create `ProjectDetailView` with tab structure
3. Create `ProjectOverviewTab` with basic project info
4. Update `ProjectCard` to navigate to detail view on click
5. Add back navigation to projects grid

### Phase 3: Source Control Tab - File Status
1. Create `SourceControlTab` layout (sidebar + main area)
2. Implement `ChangedFilesList` component
3. Implement file staging/unstaging
4. Create `source-control-store.ts`

### Phase 4: Diff Viewer
1. Add `@monaco-editor/react` dependency
2. Create `DiffViewer` component
3. Wire up file selection to diff display
4. Add syntax highlighting based on file type

### Phase 5: Branch Management
1. Create `BranchSelector` component
2. Implement branch listing
3. Create `CreateBranchDialog`
4. Implement branch checkout
5. Add branch deletion with confirmation

### Phase 6: Remote Operations
1. Add fetch/pull/push functions to `git-operations.ts`
2. Create `RemoteStatusBar` component
3. Show ahead/behind indicators
4. Add loading states for network operations
5. Handle authentication errors gracefully

### Phase 7: Stash Management
1. Add stash functions to `git-operations.ts`
2. Create `StashSection` component
3. Implement stash list with actions
4. Add "Stash Changes" dialog with message input
5. Confirmation dialog for destructive actions (drop)

### Phase 8: AI Commit Messages
1. Create `commit-message-generator.ts`
2. Integrate Claude Haiku for fast generation
3. Add "Generate" button to `CommitPanel`
4. Show loading state during generation

### Phase 9: Context Tab Migration
1. Move `ProjectContextView` content to `ProjectContextTab`
2. Update routing to redirect `/context` → `/projects/:id` (context tab)
3. Consider keeping `/context` as a fallback or removing entirely

## Dependencies

### New npm packages:
- `@monaco-editor/react` - Diff viewer (Monaco is VS Code's editor)
- Alternatively: `react-diff-viewer-continued` (lighter weight)

### Existing packages to leverage:
- `simple-git` - Already used, has all needed Git operations
- Radix UI - Tabs, dialogs, buttons already available
- TanStack Router - Route params already supported

## Decisions Made

1. **Commit message AI model**: Claude Haiku for speed and cost-effectiveness
2. **Remote operations**: Included in v1 (push, pull, fetch)
3. **Stash support**: Included in v1 (save, list, apply, pop, drop)
4. **Conflict resolution**: Detect conflicts and prompt user to resolve in their IDE (no in-app merge UI)
5. **Git authentication**: Relies on system Git config (SSH keys, credential helpers) - no special handling needed since we use the terminal/simple-git
6. **Large diffs**: Use Monaco's built-in virtualization (it handles this natively)

## Tasks

### Backend - Core Git Operations
- [ ] Create `src/shared/types/git.ts` with Git-related types
- [ ] Create `src/main/git/git-operations.ts` with core Git functions
  - [ ] Branch operations (list, create, checkout, delete)
  - [ ] Status and staging operations
  - [ ] Diff operations
  - [ ] Commit operations
- [ ] Add new IPC handlers to `src/main/ipc/git-handlers.ts`
- [ ] Update `src/shared/ipc-types.ts` with new channels
- [ ] Update preload script to expose new Git APIs

### Backend - Remote Operations
- [ ] Add fetch function with remote detection
- [ ] Add pull function with merge handling
- [ ] Add push function with upstream tracking
- [ ] Add getRemoteStatus for ahead/behind counts
- [ ] Handle authentication errors gracefully

### Backend - Stash Operations
- [ ] Add stashSave with optional message and untracked files
- [ ] Add stashList to enumerate stashes
- [ ] Add stashApply, stashPop, stashDrop operations

### Backend - AI Commit Messages
- [ ] Create `src/main/git/commit-message-generator.ts`
- [ ] Integrate Claude Haiku API
- [ ] Build prompt with diff and recent commit style context
- [ ] Handle large diffs (truncation strategy)

### Frontend - Routing & Views
- [ ] Create route file `src/renderer/src/routes/projects.$projectId.tsx`
- [ ] Create `src/renderer/src/views/ProjectDetailView.tsx`
- [ ] Create `ProjectDetailHeader` component
- [ ] Create `ProjectOverviewTab` component
- [ ] Update `ProjectCard` to navigate to detail view

### Frontend - Source Control Core
- [ ] Create `src/renderer/src/stores/source-control-store.ts`
- [ ] Create `SourceControlTab` component with layout
- [ ] Create `ChangedFilesList` component
- [ ] Create `DiffViewer` component using Monaco
- [ ] Create `CommitPanel` component with AI generation

### Frontend - Branch Management
- [ ] Create `BranchSelector` component
- [ ] Create `CreateBranchDialog` component
- [ ] Implement branch checkout
- [ ] Add branch deletion with confirmation

### Frontend - Remote Operations
- [ ] Create `RemoteStatusBar` component
- [ ] Show ahead/behind indicators
- [ ] Add fetch/pull/push buttons with loading states
- [ ] Handle and display network errors

### Frontend - Stash Management
- [ ] Create `StashSection` component
- [ ] Create stash list with apply/pop/drop actions
- [ ] Create "Stash Changes" dialog
- [ ] Add confirmation for destructive actions

### Frontend - Context Migration
- [ ] Create `ProjectContextTab` component (extract from ProjectContextView)
- [ ] Update navigation/routing as needed
- [ ] Decide fate of standalone `/context` route

### Testing & Polish
- [ ] Test with various repo states (clean, dirty, conflicts, detached HEAD)
- [ ] Test with large diffs and many files
- [ ] Test remote operations (fetch, pull, push)
- [ ] Test stash operations
- [ ] Add loading states and error handling throughout
- [ ] Add keyboard shortcuts (Cmd+Enter to commit, Cmd+Shift+S to stash, etc.)
- [ ] Mobile/responsive considerations
