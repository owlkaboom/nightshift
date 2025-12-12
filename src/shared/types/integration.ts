/**
 * Integration types for external issue tracking systems (GitHub, JIRA)
 */

export type IntegrationType = 'github' | 'jira'

// ============================================================================
// NEW TWO-LEVEL MODEL: Connection (auth) + Sources (filters/boards)
// ============================================================================

/**
 * Authenticated connection to an external service (one token per instance)
 */
export interface IntegrationConnection {
  id: string
  type: IntegrationType
  name: string // Display name, e.g., "My Work Jira"
  enabled: boolean
  createdAt: string
  lastTestedAt: string | null
  config: GitHubConnectionConfig | JiraConnectionConfig
}

/**
 * GitHub connection configuration (just auth)
 */
export interface GitHubConnectionConfig {
  type: 'github'
  // token stored in secure storage with key: nightshift:connection:{id}:token
}

/**
 * JIRA connection configuration (just auth + base URL)
 */
export interface JiraConnectionConfig {
  type: 'jira'
  baseUrl: string // e.g., https://company.atlassian.net
  email: string
  // token stored in secure storage with key: nightshift:connection:{id}:token
}

/**
 * Data source within a connection (board, filter, repo, etc.)
 */
export interface IntegrationSource {
  id: string
  connectionId: string // Parent connection
  name: string // Display name, e.g., "Platform Board"
  enabled: boolean
  createdAt: string
  config: GitHubSourceConfig | JiraSourceConfig
}

/**
 * GitHub source configuration (repository + filters)
 */
export interface GitHubSourceConfig {
  type: 'github'
  sourceType: 'repository'
  owner: string
  repo: string
  defaultLabels?: string[]
  autoCreatePR: boolean
}

/**
 * JIRA source configuration (board, sprint, filter, JQL, etc.)
 */
export type JiraSourceConfig =
  | {
      type: 'jira'
      sourceType: 'board'
      boardId: number
      boardName?: string
    }
  | {
      type: 'jira'
      sourceType: 'sprint'
      boardId: number
      sprintState: 'active' | 'future' | 'closed'
    }
  | {
      type: 'jira'
      sourceType: 'backlog'
      boardId: number
    }
  | {
      type: 'jira'
      sourceType: 'filter'
      filterId: number
      filterName?: string
    }
  | {
      type: 'jira'
      sourceType: 'jql'
      jql: string
    }
  | {
      type: 'jira'
      sourceType: 'project'
      projectKey: string
    }

/**
 * Data for creating a new connection
 */
export type CreateConnectionData = Omit<IntegrationConnection, 'id' | 'createdAt' | 'lastTestedAt'>

/**
 * Data for creating a new source
 */
export type CreateSourceData = Omit<IntegrationSource, 'id' | 'createdAt'>

// ============================================================================
// JIRA DISCOVERY TYPES
// ============================================================================

/**
 * JIRA board from Agile API
 */
export interface JiraBoard {
  id: number
  name: string
  type: 'scrum' | 'kanban' | 'simple'
}

/**
 * JIRA sprint from Agile API
 */
export interface JiraSprint {
  id: number
  name: string
  state: 'active' | 'future' | 'closed'
  startDate?: string
  endDate?: string
}

/**
 * JIRA filter (saved search)
 */
export interface JiraFilter {
  id: number
  name: string
  jql: string
  owner?: string
}

/**
 * JIRA project
 */
export interface JiraProject {
  id: string
  key: string
  name: string
}

// ============================================================================
// LEGACY MODEL (for migration)
// ============================================================================

/**
 * Legacy flat integration configuration (v1)
 * @deprecated Use IntegrationConnection + IntegrationSource instead
 */
export interface Integration {
  id: string
  type: IntegrationType
  name: string // Display name
  enabled: boolean
  createdAt: string
  config: GitHubConfig | JiraConfig
}

/**
 * Legacy GitHub integration configuration
 * @deprecated Use GitHubConnectionConfig + GitHubSourceConfig instead
 */
export interface GitHubConfig {
  type: 'github'
  owner: string // org or user
  repo: string
  apiToken?: string // stored in secure storage
  defaultLabels?: string[] // filter issues by labels
  autoCreatePR: boolean // create PR on task accept
}

/**
 * Legacy JIRA integration configuration
 * @deprecated Use JiraConnectionConfig + JiraSourceConfig instead
 */
export interface JiraConfig {
  type: 'jira'
  baseUrl: string // e.g., https://company.atlassian.net
  projectKey: string // e.g., PROJ
  email: string // for API auth
  apiToken?: string // stored in secure storage
  jql?: string // optional JQL filter
}

/**
 * External issue from GitHub or JIRA
 */
export interface ExternalIssue {
  id: string // external ID (GH-123, PROJ-456)
  source: IntegrationType
  sourceId: string // ID of the IntegrationSource this came from
  integrationId?: string // Legacy field for backward compatibility
  title: string
  description: string
  url: string
  status: string
  labels: string[]
  assignee?: string
  createdAt: string
  updatedAt: string
}

/**
 * Options for fetching issues from external systems
 */
export interface FetchIssuesOptions {
  labels?: string[] // GitHub: filter by labels
  jql?: string // JIRA: custom JQL
  state?: 'open' | 'closed' | 'all'
  assignedToMe?: boolean // Filter for issues assigned to the current user
  limit?: number
}

/**
 * Options for creating a pull request
 */
export interface CreatePROptions {
  title: string
  body: string
  baseBranch: string
  headBranch: string // Task worktree branch
  draft?: boolean
}

/**
 * Data for creating a new integration
 */
export type CreateIntegrationData = Omit<Integration, 'id' | 'createdAt'>

/**
 * Result of testing an integration connection
 */
export interface IntegrationTestResult {
  success: boolean
  error?: string
  details?: string
}

/**
 * Result of creating a pull request
 */
export interface CreatePRResult {
  url: string
  number: number
}
