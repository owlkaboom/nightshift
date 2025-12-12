# Integration System Refactor: Connection → Sources Model

## Overview

Refactor the integrations system from a flat model (where each integration contains both auth AND filter config) to a two-level hierarchy:

1. **IntegrationConnection** - Authenticated link to a service (one token per Jira instance/GitHub account)
2. **IntegrationSource** - Specific filter/board/query within that connection

### Benefits
- One auth token, multiple data sources
- Easier credential management (change token once)
- Matches mental model: "Connect to Jira" → "Add boards/filters"
- Supports Jira boards, sprints, backlogs, saved filters, and custom JQL

---

## Design Decisions

1. **No project linking** - Sources/connections exist independently. Users can import issues from any source to any project on-demand. No need for `integration_ids` on projects or `source_id` on tasks.

2. **Grouped hierarchy in sidebar** - Show connections as expandable headers with sources nested underneath. Clicking a source navigates to browse its issues.

3. **Wizard flow for setup** - After creating a connection and testing succeeds, immediately prompt to add the first source in the same dialog flow. Makes onboarding smoother.

---

## New Data Model

### IntegrationConnection
```typescript
interface IntegrationConnection {
  id: string
  type: 'github' | 'jira'
  name: string                    // "My Work Jira"
  enabled: boolean
  createdAt: string
  lastTestedAt: string | null
  config: GitHubConnectionConfig | JiraConnectionConfig
}

interface JiraConnectionConfig {
  type: 'jira'
  baseUrl: string                 // https://company.atlassian.net
  email: string
  // token in secure storage
}

interface GitHubConnectionConfig {
  type: 'github'
  // token in secure storage
}
```

### IntegrationSource
```typescript
interface IntegrationSource {
  id: string
  connectionId: string            // Parent connection
  name: string                    // "Platform Board"
  enabled: boolean
  createdAt: string
  config: GitHubSourceConfig | JiraSourceConfig
}

// Jira source types
type JiraSourceConfig =
  | { type: 'jira', sourceType: 'board', boardId: number, boardName?: string }
  | { type: 'jira', sourceType: 'sprint', boardId: number, sprintState: 'active'|'future'|'closed' }
  | { type: 'jira', sourceType: 'backlog', boardId: number }
  | { type: 'jira', sourceType: 'filter', filterId: number, filterName?: string }
  | { type: 'jira', sourceType: 'jql', jql: string }
  | { type: 'jira', sourceType: 'project', projectKey: string }

// GitHub source types
interface GitHubSourceConfig {
  type: 'github'
  sourceType: 'repository'
  owner: string
  repo: string
  defaultLabels?: string[]
  autoCreatePR: boolean
}
```

### Example Structure
```
"My Jira" (connection: baseUrl, email, token)
  ├── "Platform Board" (source: board, boardId=123)
  ├── "Current Sprint" (source: sprint, boardId=123, state=active)
  ├── "My Saved Filter" (source: filter, filterId=456)
  └── "High Priority Bugs" (source: jql, "priority=High AND type=Bug")

"Work GitHub" (connection: token)
  ├── "Frontend" (source: repository, owner=acme, repo=frontend)
  └── "Backend" (source: repository, owner=acme, repo=backend)
```

---

## Files to Modify

### Phase 1: Core Types & Storage
| File | Changes |
|------|---------|
| `src/shared/types/integration.ts` | New Connection/Source types, discovery types |
| `src/main/storage/integration-store.ts` | Two-entity storage, migration logic |

### Phase 2: Jira Client Updates
| File | Changes |
|------|---------|
| `src/main/integrations/jira.ts` | Add `listBoards()`, `listSprints()`, `listFilters()`, `listProjects()`, source-aware fetch methods |
| `src/main/integrations/github.ts` | Minor updates for new config structure |
| `src/main/integrations/index.ts` | New `fetchIssuesFromSource()`, update credential key format |

### Phase 3: IPC Layer
| File | Changes |
|------|---------|
| `src/shared/ipc-types.ts` | New connection/source/discovery handlers |
| `src/main/ipc/integration-handlers.ts` | Register new handlers, legacy wrappers |
| `src/preload/index.ts` | Expose new API methods |

### Phase 4: UI Components
| File | Changes |
|------|---------|
| `src/renderer/src/stores/integration-store.ts` | Connections + sources state, discovery cache |
| `src/renderer/src/components/integrations/SetupIntegrationDialog.tsx` | Wizard flow: connection → test → add source |
| `src/renderer/src/components/integrations/` | New: ConnectionCard, SourceCard, JiraSourcePicker |
| `src/renderer/src/views/IntegrationView.tsx` | Rename to SourceView, work with sources |
| `src/renderer/src/components/layout/IntegrationsSection.tsx` | Grouped hierarchy (connection headers, nested sources) |

---

## Implementation Steps

### Step 1: Update Type Definitions
- Add `IntegrationConnection`, `IntegrationSource` types
- Add Jira discovery types (`JiraBoard`, `JiraSprint`, `JiraFilter`, `JiraProject`)
- Keep legacy types for migration

### Step 2: Update Storage Layer
- Change `integrations.json` structure to `{ version: 2, connections: [], sources: [] }`
- Implement migration from v1 (flat) to v2 (hierarchical)
- Update credential key format: `nightshift:connection:{id}:token`

### Step 3: Add Jira Discovery Methods
New JiraClient methods using Jira Agile API:
- `listBoards()` → `GET /rest/agile/1.0/board`
- `listSprints(boardId)` → `GET /rest/agile/1.0/board/{boardId}/sprint`
- `listFilters()` → `GET /rest/api/3/filter/search`
- `listProjects()` → `GET /rest/api/3/project/search`

### Step 4: Add Source-Aware Fetch Methods
New JiraClient methods:
- `fetchBoardIssues(boardId)` → `GET /rest/agile/1.0/board/{boardId}/issue`
- `fetchSprintIssues(sprintId)` → `GET /rest/agile/1.0/sprint/{sprintId}/issue`
- `fetchBacklogIssues(boardId)` → `GET /rest/agile/1.0/board/{boardId}/backlog`
- `fetchFilterIssues(filterId)` → JQL with `filter={filterId}`

### Step 5: Update Integration Manager
- New `fetchIssuesFromSource(sourceId)` that routes to correct fetch method
- Update credential retrieval to use connection ID

### Step 6: Add IPC Handlers
New handlers:
- `connection:list`, `connection:create`, `connection:test`, etc.
- `source:list`, `source:create`, `source:fetchIssues`, etc.
- `jira:listBoards`, `jira:listSprints`, `jira:listFilters`, `jira:listProjects`

### Step 7: Update Zustand Store
- Separate `connections` and `sources` arrays
- Add discovery cache (boards, sprints, filters by connection)
- Update actions for new entity types

### Step 8: Build New UI Components
- `SetupIntegrationDialog` - Wizard flow: connection auth → test → add first source
- `AddSourceDialog` - Pick source type, then discover/configure (for adding more sources later)
- `JiraSourcePicker` - Dropdown to select board/sprint/filter from discovered options
- `ConnectionCard` - Expandable card showing connection + nested sources
- `SourceCard` - Individual source with browse/delete actions

### Step 9: Update Existing UI
- `IntegrationsSection` in sidebar - grouped hierarchy (connection headers, nested sources)
- `IntegrationView` → `SourceView` - browse issues for a specific source
- `ImportIssuesDialog` - select source (not connection) to import from

---

## Migration Strategy

1. On startup, check `integrations.json` for `version` field
2. If missing or < 2, run auto-migration:
   - Each legacy integration → 1 connection + 1 source
   - Preserve IDs for credential lookup
   - Map `jql` config → `jql` source type
   - Map `projectKey` → `project` source type
3. Keep legacy IPC handlers as wrappers during transition
