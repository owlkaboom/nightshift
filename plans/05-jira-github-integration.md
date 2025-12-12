# Plan: JIRA and GitHub Integration

## Overview

Add the ability to pull issues from JIRA and GitHub as tasks, enabling a workflow where developers can sync their ticket backlog into Nightshift for AI-assisted implementation.

## Goals

1. **Pull issues as tasks** - Import issues/tickets from external systems
2. **Link tracking** - Maintain bidirectional reference between task and source issue
3. **Status sync** (optional) - Update external issue status when task completes
4. **PR creation** (GitHub only) - Auto-create PRs from accepted tasks

## Integration Architecture

### Shared Integration Types

```typescript
// src/shared/types/integration.ts

export type IntegrationType = 'github' | 'jira'

export interface Integration {
  id: string
  type: IntegrationType
  name: string                    // Display name
  enabled: boolean
  createdAt: string
  config: GitHubConfig | JiraConfig
}

export interface GitHubConfig {
  type: 'github'
  owner: string                   // org or user
  repo: string
  apiToken?: string               // stored in secure storage
  defaultLabels?: string[]        // filter issues by labels
  autoCreatePR: boolean           // create PR on task accept
}

export interface JiraConfig {
  type: 'jira'
  baseUrl: string                 // e.g., https://company.atlassian.net
  projectKey: string              // e.g., PROJ
  email: string                   // for API auth
  apiToken?: string               // stored in secure storage
  jql?: string                    // optional JQL filter
}

export interface ExternalIssue {
  id: string                      // external ID (GH-123, PROJ-456)
  source: IntegrationType
  integrationId: string
  title: string
  description: string
  url: string
  status: string
  labels: string[]
  assignee?: string
  createdAt: string
  updatedAt: string
}
```

### Task Extension

```typescript
// Add to existing Task interface
interface Task {
  // ... existing fields ...

  // Integration fields
  externalIssueId?: string        // e.g., "PROJ-123" or "GH-456"
  externalIssueUrl?: string       // Link to original issue
  integrationId?: string          // Which integration this came from
}
```

### Project Integration Association

```typescript
// Add to Project interface
interface Project {
  // ... existing fields ...

  integrationIds?: string[]       // Integrations associated with this project
}
```

## GitHub Integration

### API Interactions

Using GitHub REST API (via `@octokit/rest` or direct fetch):

1. **List issues**: `GET /repos/{owner}/{repo}/issues`
2. **Get issue**: `GET /repos/{owner}/{repo}/issues/{issue_number}`
3. **Create PR**: `POST /repos/{owner}/{repo}/pulls`
4. **Update issue**: `PATCH /repos/{owner}/{repo}/issues/{issue_number}`

### Features

- **Import issues** - Pull open issues, optionally filtered by labels
- **Issue preview** - Show issue details before importing as task
- **Link back** - Store issue URL on task for reference
- **Auto-PR** (if worktrees implemented) - Create PR from task branch on accept

### Authentication

- Personal Access Token (PAT) stored in secure storage
- Scopes needed: `repo` (for private repos), `public_repo` (for public)

## JIRA Integration

### API Interactions

Using JIRA REST API v3:

1. **Search issues**: `GET /rest/api/3/search?jql={jql}`
2. **Get issue**: `GET /rest/api/3/issue/{issueIdOrKey}`
3. **Transition issue**: `POST /rest/api/3/issue/{issueIdOrKey}/transitions`

### Features

- **Import issues** - Pull issues via JQL query or project filter
- **Issue preview** - Show issue details, subtasks, links
- **Status mapping** - Map Nightshift task status to JIRA transitions
- **Link back** - Store JIRA URL on task

### Authentication

- API Token + Email (Basic Auth)
- Cloud vs Server: Initially target Cloud (Atlassian hosted)

## IPC Channels

```typescript
// src/shared/ipc-types.ts additions

interface IpcChannels {
  // Integration management
  'integration:list': () => Promise<Integration[]>
  'integration:get': (id: string) => Promise<Integration | null>
  'integration:create': (data: CreateIntegrationData) => Promise<Integration>
  'integration:update': (id: string, updates: Partial<Integration>) => Promise<Integration | null>
  'integration:delete': (id: string) => Promise<boolean>
  'integration:test': (id: string) => Promise<{ success: boolean; error?: string }>

  // Issue fetching
  'integration:fetchIssues': (integrationId: string, options?: FetchOptions) => Promise<ExternalIssue[]>
  'integration:getIssue': (integrationId: string, issueId: string) => Promise<ExternalIssue | null>
  'integration:importAsTask': (integrationId: string, issueId: string, projectId: string) => Promise<Task>

  // GitHub specific
  'github:createPR': (integrationId: string, taskId: string, options: PROptions) => Promise<{ url: string }>

  // JIRA specific
  'jira:transitionIssue': (integrationId: string, issueId: string, transitionId: string) => Promise<boolean>
}

interface FetchOptions {
  labels?: string[]      // GitHub: filter by labels
  jql?: string           // JIRA: custom JQL
  state?: 'open' | 'closed' | 'all'
  limit?: number
}

interface PROptions {
  title: string
  body: string
  baseBranch: string
  headBranch: string     // Task worktree branch
  draft?: boolean
}
```

## Storage

### Integration Storage

```typescript
// src/main/storage/integration-store.ts

// File: ~/.nightshift/integrations.json
interface IntegrationsRegistry {
  integrations: Integration[]
}

// API tokens stored separately in secure storage (keychain)
// Key format: nightshift:integration:{id}:token
```

## UI Components

### Settings Panel

`src/renderer/src/components/settings/IntegrationsPanel.tsx`
- List configured integrations
- Add/edit/delete integrations
- Test connection button
- Show connection status

### Integration Setup Dialog

`src/renderer/src/components/integrations/SetupIntegrationDialog.tsx`
- Step-by-step setup wizard
- GitHub: owner/repo, token input, label filter
- JIRA: base URL, project key, email, token, JQL

### Issue Import View

`src/renderer/src/components/integrations/IssueImportView.tsx`
- List available issues from integration
- Preview issue details
- Select project to import into
- Import button creates task

### Task Integration Badge

Show integration source on task cards:
- GitHub icon + issue number
- JIRA icon + ticket key
- Click to open external URL

## Implementation Phases

### Phase 1: Integration Infrastructure

1. Create `src/shared/types/integration.ts`
2. Create `src/main/storage/integration-store.ts`
3. Add secure token storage helpers
4. Create `src/main/ipc/integration-handlers.ts`
5. Add IPC channels to types and preload

### Phase 2: GitHub Integration

1. Create `src/main/integrations/github.ts`
   - Octokit client wrapper
   - Issue fetching
   - Issue parsing to ExternalIssue format
2. Add GitHub config UI in settings
3. Create issue list/import UI
4. Test with real GitHub repo

### Phase 3: JIRA Integration

1. Create `src/main/integrations/jira.ts`
   - JIRA API client
   - JQL query builder
   - Issue parsing
2. Add JIRA config UI in settings
3. Reuse issue import UI (shared component)
4. Test with JIRA instance

### Phase 4: Task Linking

1. Add external issue fields to Task type
2. Update task creation to accept integration source
3. Display integration badge on task cards
4. Add "View Original Issue" action

### Phase 5: Advanced Features (Optional)

1. **Status sync back** - Update external issue when task accepted/rejected
2. **Auto-PR creation** - Requires worktree implementation first
3. **Webhook support** - Listen for issue updates (requires server component)
4. **Bulk import** - Import multiple issues at once

## File Structure

```
src/
├── main/
│   ├── integrations/
│   │   ├── index.ts           # Integration manager
│   │   ├── github.ts          # GitHub API client
│   │   └── jira.ts            # JIRA API client
│   ├── storage/
│   │   └── integration-store.ts
│   └── ipc/
│       └── integration-handlers.ts
├── renderer/src/
│   ├── components/
│   │   └── integrations/
│   │       ├── SetupIntegrationDialog.tsx
│   │       ├── IssueImportView.tsx
│   │       ├── IssueCard.tsx
│   │       └── IntegrationBadge.tsx
│   └── stores/
│       └── integration-store.ts
└── shared/
    └── types/
        └── integration.ts
```

## Dependencies

```json
{
  "@octokit/rest": "^20.x",    // GitHub API client (optional, can use fetch)
}
```

Note: JIRA can use native fetch with proper headers.

## Security Considerations

1. **Token storage** - Use OS keychain via secure-store.ts (already exists)
2. **Token scope** - Request minimal permissions
3. **No token in logs** - Redact tokens from any logging
4. **HTTPS only** - All API calls over HTTPS

## Error Handling

- **Auth failures** - Clear error message, prompt to re-auth
- **Rate limiting** - Respect rate limits, show retry time
- **Network errors** - Offline handling, retry logic
- **Invalid config** - Validation on setup, test connection

## Future Enhancements

1. **Linear integration** - Similar to GitHub/JIRA
2. **GitLab integration** - GitLab issues API
3. **Azure DevOps** - Work items API
4. **Notion integration** - Database items as tasks
5. **Two-way sync** - Full bidirectional status sync
6. **Comment sync** - Sync task notes to issue comments
