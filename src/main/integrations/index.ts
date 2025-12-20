/**
 * Integration manager
 * Coordinates GitHub and JIRA integration clients with connection-source model
 */

import type {
  Integration,
  IntegrationConnection,
  IntegrationSource,
  ExternalIssue,
  FetchIssuesOptions,
  CreatePROptions,
  CreatePRResult,
  IntegrationTestResult,
  GitHubConfig,
  GitHubSourceConfig,
  JiraConfig,
  JiraConnectionConfig,
  JiraSourceConfig,
  JiraBoard,
  JiraSprint,
  JiraFilter,
  JiraProject,
  TaskManifest
} from '@shared/types'
import { getIntegration, getConnection, getSource } from '@main/storage/integration-store'
import { getCredential } from '@main/storage/secure-store'
import { GitHubClient, parseGitHubIssueId } from './github'
import { JiraClient } from './jira'
import { createTask } from '@main/storage/sqlite/task-store'
import { getProject } from '@main/storage/sqlite/project-store'

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Get API token for a connection from secure storage
 * Uses new format: nightshift:connection:{id}:token
 */
async function getConnectionToken(connectionId: string): Promise<string | null> {
  const key = `nightshift:connection:${connectionId}:token`
  return getCredential(key)
}

/**
 * Get API token for an integration from secure storage (legacy)
 * @deprecated Use getConnectionToken instead
 */
async function getIntegrationToken(integrationId: string): Promise<string | null> {
  // Try new format first
  const newKey = `nightshift:connection:${integrationId}:token`
  const newToken = await getCredential(newKey)
  if (newToken) return newToken

  // Fall back to legacy format
  const legacyKey = `nightshift:integration:${integrationId}:token`
  return getCredential(legacyKey)
}

// ============================================================================
// CLIENT CREATION (Connection-based)
// ============================================================================

/**
 * Create a GitHub client for a source (uses parent connection for auth)
 */
async function createGitHubClientForSource(source: IntegrationSource): Promise<GitHubClient> {
  if (source.config.type !== 'github') {
    throw new Error('Source is not a GitHub source')
  }

  const connection = await getConnection(source.connectionId)
  if (!connection) {
    throw new Error('Connection not found for source')
  }

  const token = await getConnectionToken(connection.id)
  if (!token) {
    throw new Error('API token not found for GitHub connection')
  }

  const sourceConfig = source.config as GitHubSourceConfig

  // Build a legacy GitHubConfig for the client
  const config: GitHubConfig = {
    type: 'github',
    owner: sourceConfig.owner,
    repo: sourceConfig.repo,
    defaultLabels: sourceConfig.defaultLabels,
    autoCreatePR: sourceConfig.autoCreatePR
  }

  return new GitHubClient(config, token)
}

/**
 * Create a JIRA client for a connection
 */
async function createJiraClientForConnection(connection: IntegrationConnection): Promise<JiraClient> {
  if (connection.type !== 'jira') {
    throw new Error('Connection is not a JIRA connection')
  }

  const token = await getConnectionToken(connection.id)
  if (!token) {
    throw new Error('API token not found for JIRA connection')
  }

  return new JiraClient(connection.config as JiraConnectionConfig, token)
}

/**
 * Create a JIRA client for a source (uses parent connection for auth)
 */
async function createJiraClientForSource(source: IntegrationSource): Promise<JiraClient> {
  if (source.config.type !== 'jira') {
    throw new Error('Source is not a JIRA source')
  }

  const connection = await getConnection(source.connectionId)
  if (!connection) {
    throw new Error('Connection not found for source')
  }

  return createJiraClientForConnection(connection)
}

// ============================================================================
// LEGACY CLIENT CREATION (for backward compatibility)
// ============================================================================

/**
 * Create a GitHub client for an integration (legacy)
 * @deprecated Use createGitHubClientForSource instead
 */
async function createGitHubClient(integration: Integration): Promise<GitHubClient> {
  if (integration.type !== 'github') {
    throw new Error('Integration is not a GitHub integration')
  }

  const token = await getIntegrationToken(integration.id)
  if (!token) {
    throw new Error('API token not found for GitHub integration')
  }

  return new GitHubClient(integration.config as GitHubConfig, token)
}

/**
 * Create a JIRA client for an integration (legacy)
 * @deprecated Use createJiraClientForConnection or createJiraClientForSource instead
 */
async function createJiraClient(integration: Integration): Promise<JiraClient> {
  if (integration.type !== 'jira') {
    throw new Error('Integration is not a JIRA integration')
  }

  const token = await getIntegrationToken(integration.id)
  if (!token) {
    throw new Error('API token not found for JIRA integration')
  }

  return new JiraClient(integration.config as JiraConfig, token)
}

// ============================================================================
// CONNECTION TESTING & DISCOVERY
// ============================================================================

/**
 * Test a connection
 */
export async function testConnection(connectionId: string): Promise<IntegrationTestResult> {
  const connection = await getConnection(connectionId)
  if (!connection) {
    return {
      success: false,
      error: 'Connection not found'
    }
  }

  if (!connection.enabled) {
    return {
      success: false,
      error: 'Connection is disabled'
    }
  }

  try {
    if (connection.type === 'github') {
      // For GitHub, we need a source to test, so just verify token exists
      const token = await getConnectionToken(connection.id)
      if (!token) {
        return {
          success: false,
          error: 'API token not found'
        }
      }
      // TODO: Could make a simple API call to verify token
      return {
        success: true,
        details: 'GitHub connection configured'
      }
    } else if (connection.type === 'jira') {
      const client = await createJiraClientForConnection(connection)
      return await client.testConnection()
    } else {
      return {
        success: false,
        error: 'Unknown connection type'
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test connection'
    }
  }
}

/**
 * List boards for a Jira connection
 */
export async function listJiraBoards(connectionId: string): Promise<JiraBoard[]> {
  const connection = await getConnection(connectionId)
  if (!connection || connection.type !== 'jira') {
    throw new Error('Invalid Jira connection')
  }

  const client = await createJiraClientForConnection(connection)
  return await client.listBoards()
}

/**
 * List sprints for a Jira board
 */
export async function listJiraSprints(connectionId: string, boardId: number): Promise<JiraSprint[]> {
  const connection = await getConnection(connectionId)
  if (!connection || connection.type !== 'jira') {
    throw new Error('Invalid Jira connection')
  }

  const client = await createJiraClientForConnection(connection)
  return await client.listSprints(boardId)
}

/**
 * List filters for a Jira connection
 */
export async function listJiraFilters(connectionId: string): Promise<JiraFilter[]> {
  const connection = await getConnection(connectionId)
  if (!connection || connection.type !== 'jira') {
    throw new Error('Invalid Jira connection')
  }

  const client = await createJiraClientForConnection(connection)
  return await client.listFilters()
}

/**
 * List projects for a Jira connection
 */
export async function listJiraProjects(connectionId: string): Promise<JiraProject[]> {
  const connection = await getConnection(connectionId)
  if (!connection || connection.type !== 'jira') {
    throw new Error('Invalid Jira connection')
  }

  const client = await createJiraClientForConnection(connection)
  return await client.listProjects()
}

// ============================================================================
// SOURCE OPERATIONS
// ============================================================================

/**
 * Fetch issues from a source
 */
export async function fetchIssuesFromSource(
  sourceId: string,
  options?: FetchIssuesOptions
): Promise<ExternalIssue[]> {
  const source = await getSource(sourceId)
  if (!source) {
    throw new Error('Source not found')
  }

  if (!source.enabled) {
    throw new Error('Source is disabled')
  }

  let issues: ExternalIssue[]

  if (source.config.type === 'github') {
    const client = await createGitHubClientForSource(source)
    issues = await client.fetchIssues(options)
  } else if (source.config.type === 'jira') {
    const client = await createJiraClientForSource(source)
    const maxResults = options?.limit || 100
    issues = await client.fetchFromSource(source.config as JiraSourceConfig, maxResults)
  } else {
    throw new Error('Unknown source type')
  }

  // Set sourceId on all issues
  return issues.map((issue) => ({
    ...issue,
    sourceId
  }))
}

// ============================================================================
// LEGACY INTEGRATION TESTING (for backward compatibility)
// ============================================================================

/**
 * Test an integration connection (legacy)
 * @deprecated Use testConnection instead
 */
export async function testIntegration(integrationId: string): Promise<IntegrationTestResult> {
  const integration = await getIntegration(integrationId)
  if (!integration) {
    return {
      success: false,
      error: 'Integration not found'
    }
  }

  if (!integration.enabled) {
    return {
      success: false,
      error: 'Integration is disabled'
    }
  }

  try {
    if (integration.type === 'github') {
      const client = await createGitHubClient(integration)
      return await client.testConnection()
    } else if (integration.type === 'jira') {
      const client = await createJiraClient(integration)
      return await client.testConnection()
    } else {
      return {
        success: false,
        error: 'Unknown integration type'
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test integration'
    }
  }
}

/**
 * Fetch issues from an integration (legacy)
 * @deprecated Use fetchIssuesFromSource instead
 */
export async function fetchIssues(
  integrationId: string,
  options?: FetchIssuesOptions
): Promise<ExternalIssue[]> {
  const integration = await getIntegration(integrationId)
  if (!integration) {
    throw new Error('Integration not found')
  }

  if (!integration.enabled) {
    throw new Error('Integration is disabled')
  }

  let issues: ExternalIssue[]

  if (integration.type === 'github') {
    const client = await createGitHubClient(integration)
    issues = await client.fetchIssues(options)
  } else if (integration.type === 'jira') {
    const client = await createJiraClient(integration)
    issues = await client.fetchIssues(options)
  } else {
    throw new Error('Unknown integration type')
  }

  // Set integrationId on all issues
  return issues.map((issue) => ({
    ...issue,
    integrationId
  }))
}

/**
 * Import an issue from a source as a task
 */
export async function importIssueAsTaskFromSource(
  sourceId: string,
  issueId: string,
  projectId: string
): Promise<TaskManifest> {
  const source = await getSource(sourceId)
  if (!source) {
    throw new Error('Source not found')
  }

  // Fetch the issue based on source type
  let issue: ExternalIssue | null = null

  if (source.config.type === 'github') {
    const client = await createGitHubClientForSource(source)
    const issueNumber = parseGitHubIssueId(issueId)
    if (issueNumber === null) {
      throw new Error('Invalid GitHub issue ID format')
    }
    issue = await client.getIssue(issueNumber)
  } else if (source.config.type === 'jira') {
    const client = await createJiraClientForSource(source)
    issue = await client.getIssue(issueId)
  } else {
    throw new Error('Unknown source type')
  }

  if (!issue) {
    throw new Error('Issue not found')
  }

  // Set sourceId
  issue.sourceId = sourceId

  // Verify project exists
  const project = await getProject(projectId)
  if (!project) {
    throw new Error('Project not found')
  }

  const taskPrompt = `${issue.title}\n\n${issue.description}\n\nSource: ${issue.url}`

  const task = await createTask(taskPrompt, projectId, {
    source: source.config.type,
    sourceRef: issue.id,
    externalIssueId: issue.id,
    externalIssueUrl: issue.url,
    integrationId: sourceId // Store sourceId in integrationId field for now
  })

  return task
}

/**
 * Create a pull request from a source (GitHub only)
 */
export async function createPullRequestFromSource(
  sourceId: string,
  _taskId: string,
  options: CreatePROptions
): Promise<CreatePRResult> {
  const source = await getSource(sourceId)
  if (!source) {
    throw new Error('Source not found')
  }

  if (source.config.type !== 'github') {
    throw new Error('Pull requests are only supported for GitHub sources')
  }

  const client = await createGitHubClientForSource(source)
  return await client.createPullRequest(options)
}

// ============================================================================
// LEGACY OPERATIONS (for backward compatibility)
// ============================================================================

/**
 * Get a single issue from an integration (legacy)
 * @deprecated Use fetchIssuesFromSource and filter, or create a getIssueFromSource function
 */
export async function getIssue(
  integrationId: string,
  issueId: string
): Promise<ExternalIssue | null> {
  const integration = await getIntegration(integrationId)
  if (!integration) {
    throw new Error('Integration not found')
  }

  if (!integration.enabled) {
    throw new Error('Integration is disabled')
  }

  let issue: ExternalIssue | null = null

  if (integration.type === 'github') {
    const client = await createGitHubClient(integration)
    const issueNumber = parseGitHubIssueId(issueId)
    if (issueNumber === null) {
      throw new Error('Invalid GitHub issue ID format')
    }
    issue = await client.getIssue(issueNumber)
  } else if (integration.type === 'jira') {
    const client = await createJiraClient(integration)
    issue = await client.getIssue(issueId)
  } else {
    throw new Error('Unknown integration type')
  }

  if (issue) {
    issue.integrationId = integrationId
  }

  return issue
}

/**
 * Import an external issue as a task (legacy)
 * @deprecated Use importIssueAsTaskFromSource instead
 */
export async function importIssueAsTask(
  integrationId: string,
  issueId: string,
  projectId: string
): Promise<TaskManifest> {
  // Fetch the issue
  const issue = await getIssue(integrationId, issueId)
  if (!issue) {
    throw new Error('Issue not found')
  }

  // Verify project exists
  const project = await getProject(projectId)
  if (!project) {
    throw new Error('Project not found')
  }

  // Create task from issue
  const integration = await getIntegration(integrationId)
  if (!integration) {
    throw new Error('Integration not found')
  }

  const taskPrompt = `${issue.title}\n\n${issue.description}\n\nSource: ${issue.url}`

  const task = await createTask(taskPrompt, projectId, {
    source: integration.type,
    sourceRef: issue.id,
    externalIssueId: issue.id,
    externalIssueUrl: issue.url,
    integrationId
  })

  return task
}

/**
 * Create a pull request (GitHub only) (legacy)
 * @deprecated Use createPullRequestFromSource instead
 */
export async function createPullRequest(
  integrationId: string,
  _taskId: string,
  options: CreatePROptions
): Promise<CreatePRResult> {
  const integration = await getIntegration(integrationId)
  if (!integration) {
    throw new Error('Integration not found')
  }

  if (integration.type !== 'github') {
    throw new Error('Pull requests are only supported for GitHub integrations')
  }

  const client = await createGitHubClient(integration)
  return await client.createPullRequest(options)
}

/**
 * Transition a JIRA issue status (legacy)
 * @deprecated Create a source-based version if needed
 */
export async function transitionJiraIssue(
  integrationId: string,
  issueId: string,
  transitionId: string
): Promise<boolean> {
  const integration = await getIntegration(integrationId)
  if (!integration) {
    throw new Error('Integration not found')
  }

  if (integration.type !== 'jira') {
    throw new Error('Issue transitions are only supported for JIRA integrations')
  }

  const client = await createJiraClient(integration)
  return await client.transitionIssue(issueId, transitionId)
}
