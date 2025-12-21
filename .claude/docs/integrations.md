# External Integrations

Nightshift integrates with external services to import issues and create pull requests.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Nightshift App                            │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   GitHub    │  │    JIRA     │  │   Future    │         │
│  │ Integration │  │ Integration │  │Integrations │         │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘         │
│         │                │                                   │
│         └────────┬───────┘                                   │
│                  │                                           │
│         ┌────────┴────────┐                                  │
│         │ Integration     │                                  │
│         │ Store/Manager   │                                  │
│         └────────┬────────┘                                  │
└──────────────────┼──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
   ┌────┴────┐          ┌─────┴─────┐
   │ GitHub  │          │   JIRA    │
   │   API   │          │   API     │
   └─────────┘          └───────────┘
```

## GitHub Integration

### Features

| Feature | Description |
|---------|-------------|
| Issue Fetching | Import GitHub issues as tasks |
| PR Creation | Create pull requests from completed tasks |
| Repository Browsing | Browse repo issues and PRs |
| OAuth Authentication | Secure token storage in keychain |

### Setup

1. Navigate to Settings → Integrations
2. Click "Connect GitHub"
3. Authenticate via GitHub OAuth
4. Token stored securely in OS keychain

### Issue Import

```typescript
// Fetch issues from a repository
const issues = await window.api.fetchGitHubIssues({
  owner: 'org',
  repo: 'project',
  state: 'open',
  labels: ['bug', 'enhancement']
})

// Import issue as task
await window.api.importGitHubIssueAsTask({
  issue: issues[0],
  projectId: 'project-id'
})
```

### PR Creation

After accepting a task:
1. Click "Create PR" in task review
2. Select target branch
3. PR created with task summary as description

### Key Files

| File | Purpose |
|------|---------|
| `src/main/integrations/github/` | GitHub API client |
| `src/main/ipc/integration-handlers.ts` | IPC handlers |
| `src/renderer/src/components/integrations/` | UI components |
| `src/renderer/src/stores/integration-store.ts` | Frontend state |

## JIRA Integration

### Features

| Feature | Description |
|---------|-------------|
| Issue Browsing | Browse JIRA issues by project/sprint |
| Sprint/Board Support | View issues by sprint or kanban board |
| Issue Import | Import JIRA issues as tasks |
| Status Transitions | Update issue status from Nightshift |

### Setup

1. Navigate to Settings → Integrations
2. Click "Connect JIRA"
3. Enter JIRA instance URL (e.g., `https://company.atlassian.net`)
4. Provide API token (generated from JIRA account settings)
5. Token stored securely in OS keychain

### Issue Import

```typescript
// Fetch issues from a project
const issues = await window.api.fetchJiraIssues({
  projectKey: 'PROJ',
  jql: 'status = "To Do" AND type = Bug'
})

// Import issue as task
await window.api.importJiraIssueAsTask({
  issue: issues[0],
  projectId: 'project-id'
})
```

### Key Files

| File | Purpose |
|------|---------|
| `src/main/integrations/jira/` | JIRA API client |
| `src/main/ipc/integration-handlers.ts` | IPC handlers |
| `src/renderer/src/components/integrations/` | UI components |

## Connection Management

### Multi-Source Model

Nightshift supports multiple connections per integration type:

```typescript
interface IntegrationConnection {
  id: string
  type: 'github' | 'jira'
  name: string          // User-defined label
  instanceUrl?: string  // For JIRA
  isDefault: boolean
  createdAt: string
}
```

### Storage

| Data | Location |
|------|----------|
| Connection metadata | SQLite database |
| OAuth tokens | OS keychain (encrypted) |
| API keys | OS keychain (encrypted) |

### Key Files

| File | Purpose |
|------|---------|
| `src/main/storage/sqlite/integration-store.ts` | Connection persistence |
| `src/main/storage/secure-store.ts` | Token encryption |
| `src/renderer/src/components/settings/IntegrationsPanel.tsx` | Settings UI |
| `src/renderer/src/components/integrations/SetupConnectionDialog.tsx` | Setup dialog |

## Adding New Integrations

To add a new integration:

1. **Create API client** in `src/main/integrations/{name}/`:

```typescript
// src/main/integrations/linear/client.ts
export class LinearClient {
  constructor(private apiKey: string) {}

  async fetchIssues(teamId: string): Promise<LinearIssue[]> {
    // API implementation
  }
}
```

2. **Add IPC handlers** in `src/main/ipc/integration-handlers.ts`:

```typescript
ipcMain.handle('integration:linear:fetch-issues', async (_, params) => {
  const client = await getLinearClient()
  return client.fetchIssues(params.teamId)
})
```

3. **Add frontend store** in `src/renderer/src/stores/`:

```typescript
// src/renderer/src/stores/linear-store.ts
export const useLinearStore = create<LinearStore>((set) => ({
  issues: [],
  fetchIssues: async (teamId) => {
    const issues = await window.api.fetchLinearIssues({ teamId })
    set({ issues })
  }
}))
```

4. **Create UI components** in `src/renderer/src/components/integrations/`

5. **Add to settings** in `src/renderer/src/components/settings/IntegrationsPanel.tsx`

## Error Handling

### Auth Errors

```typescript
interface IntegrationError {
  type: 'auth' | 'rate_limit' | 'not_found' | 'network'
  message: string
  retryAfter?: number  // For rate limits
}
```

### Token Refresh

- GitHub: OAuth tokens are long-lived, no refresh needed
- JIRA: API tokens don't expire, but can be revoked

### Rate Limiting

Both integrations detect rate limits and surface them to the UI:

```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get('retry-after')
  throw new IntegrationError('rate_limit', `Rate limited. Retry after ${retryAfter}s`)
}
```

## Security

### Token Storage

All tokens stored using Electron's `safeStorage` API:

```typescript
import { safeStorage } from 'electron'

// Encrypt before storing
const encrypted = safeStorage.encryptString(token)
await writeFile(tokenPath, encrypted)

// Decrypt when reading
const encrypted = await readFile(tokenPath)
const token = safeStorage.decryptString(encrypted)
```

### Scope Requirements

| Integration | Required Scopes |
|-------------|-----------------|
| GitHub | `repo`, `read:user` |
| JIRA | Read/write access to projects |

## Related Documentation

- [storage-layer.md](./storage-layer.md) - Secure storage details
- [ipc-communication.md](./ipc-communication.md) - IPC patterns
- [features.md](./features.md) - Feature overview
