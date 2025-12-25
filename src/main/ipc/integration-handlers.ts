/**
 * IPC handlers for integration operations (connections + sources)
 */

import { ipcMain } from 'electron'
import type {
  Integration,
  IntegrationConnection,
  IntegrationSource,
  CreateIntegrationData,
  CreateConnectionData,
  CreateSourceData,
  FetchIssuesOptions,
  CreatePROptions
} from '@shared/types'
import {
  // Legacy integration functions
  listIntegrations,
  getIntegration,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  getIntegrationsForProject,
  // New connection/source functions
  listConnections,
  getConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  listSources,
  getSource,
  getSourcesForConnection,
  createSource,
  updateSource,
  deleteSource
} from '@main/storage/integration-store'
import {
  // Legacy integration functions
  testIntegration,
  fetchIssues,
  getIssue,
  importIssueAsTask,
  createPullRequest,
  transitionJiraIssue,
  // New connection/source functions
  testConnection,
  fetchIssuesFromSource,
  importIssueAsTaskFromSource,
  createPullRequestFromSource,
  // Jira discovery functions
  listJiraBoards,
  listJiraSprints,
  listJiraFilters,
  listJiraProjects,
  listJiraStatuses
} from '@main/integrations'
import { setCredential, deleteCredential } from '@main/storage/secure-store'

/**
 * Register all integration IPC handlers (connections + sources + legacy)
 */
export function registerIntegrationHandlers(): void {
  // ============================================================================
  // CONNECTION HANDLERS
  // ============================================================================

  // List all connections
  ipcMain.handle('connection:list', async () => {
    return await listConnections()
  })

  // Get a single connection by ID
  ipcMain.handle('connection:get', async (_event, id: string) => {
    return await getConnection(id)
  })

  // Create a new connection
  ipcMain.handle('connection:create', async (_event, data: CreateConnectionData, token: string) => {
    // Create the connection
    const connection = await createConnection(data)

    // Store API token in secure storage
    if (token) {
      const key = `nightshift:connection:${connection.id}:token`
      await setCredential(key, token)
    }

    return connection
  })

  // Update an existing connection
  ipcMain.handle(
    'connection:update',
    async (
      _event,
      id: string,
      updates: Partial<Omit<IntegrationConnection, 'id' | 'createdAt'>>
    ) => {
      return await updateConnection(id, updates)
    }
  )

  // Delete a connection and all its sources
  ipcMain.handle('connection:delete', async (_event, id: string) => {
    const success = await deleteConnection(id)

    // Delete the API token from secure storage
    if (success) {
      const key = `nightshift:connection:${id}:token`
      await deleteCredential(key)
    }

    return success
  })

  // Test a connection
  ipcMain.handle('connection:test', async (_event, id: string) => {
    return await testConnection(id)
  })

  // Update connection token
  ipcMain.handle('connection:updateToken', async (_event, id: string, token: string) => {
    const key = `nightshift:connection:${id}:token`
    await setCredential(key, token)
  })

  // ============================================================================
  // SOURCE HANDLERS
  // ============================================================================

  // List all sources
  ipcMain.handle('source:list', async () => {
    return await listSources()
  })

  // Get a single source by ID
  ipcMain.handle('source:get', async (_event, id: string) => {
    return await getSource(id)
  })

  // Get all sources for a connection
  ipcMain.handle('source:listForConnection', async (_event, connectionId: string) => {
    return await getSourcesForConnection(connectionId)
  })

  // Create a new source
  ipcMain.handle('source:create', async (_event, data: CreateSourceData) => {
    return await createSource(data)
  })

  // Update an existing source
  ipcMain.handle(
    'source:update',
    async (
      _event,
      id: string,
      updates: Partial<Omit<IntegrationSource, 'id' | 'createdAt' | 'connectionId'>>
    ) => {
      return await updateSource(id, updates)
    }
  )

  // Delete a source
  ipcMain.handle('source:delete', async (_event, id: string) => {
    return await deleteSource(id)
  })

  // Fetch issues from a source
  ipcMain.handle(
    'source:fetchIssues',
    async (_event, sourceId: string, options?: FetchIssuesOptions) => {
      return await fetchIssuesFromSource(sourceId, options)
    }
  )

  // Import an issue from a source as a task
  ipcMain.handle(
    'source:importAsTask',
    async (_event, sourceId: string, issueId: string, projectId: string) => {
      return await importIssueAsTaskFromSource(sourceId, issueId, projectId)
    }
  )

  // Create a pull request from a source (GitHub only)
  ipcMain.handle(
    'source:createPR',
    async (_event, sourceId: string, taskId: string, options: CreatePROptions) => {
      return await createPullRequestFromSource(sourceId, taskId, options)
    }
  )

  // ============================================================================
  // JIRA DISCOVERY HANDLERS
  // ============================================================================

  // List boards for a Jira connection
  ipcMain.handle('jira:listBoards', async (_event, connectionId: string) => {
    return await listJiraBoards(connectionId)
  })

  // List sprints for a Jira board
  ipcMain.handle('jira:listSprints', async (_event, connectionId: string, boardId: number) => {
    return await listJiraSprints(connectionId, boardId)
  })

  // List filters for a Jira connection
  ipcMain.handle('jira:listFilters', async (_event, connectionId: string) => {
    return await listJiraFilters(connectionId)
  })

  // List projects for a Jira connection
  ipcMain.handle('jira:listProjects', async (_event, connectionId: string) => {
    return await listJiraProjects(connectionId)
  })

  // List statuses for a Jira connection
  ipcMain.handle('jira:listStatuses', async (_event, connectionId: string) => {
    return await listJiraStatuses(connectionId)
  })

  // ============================================================================
  // LEGACY INTEGRATION HANDLERS (for backward compatibility)
  // ============================================================================

  // List all integrations (legacy)
  ipcMain.handle('integration:list', async () => {
    return await listIntegrations()
  })

  // Get a single integration by ID
  ipcMain.handle('integration:get', async (_event, id: string) => {
    return await getIntegration(id)
  })

  // Create a new integration
  ipcMain.handle('integration:create', async (_event, data: CreateIntegrationData) => {
    // Extract the API token from config
    let apiToken: string | undefined

    if (data.config.type === 'github') {
      apiToken = data.config.apiToken
      // Remove token from config before storing (it will be in secure storage)
      delete data.config.apiToken
    } else if (data.config.type === 'jira') {
      apiToken = data.config.apiToken
      // Remove token from config before storing
      delete data.config.apiToken
    }

    // Create the integration
    const integration = await createIntegration(data)

    // Store API token in secure storage
    if (apiToken) {
      const key = `nightshift:integration:${integration.id}:token`
      await setCredential(key, apiToken)
    }

    return integration
  })

  // Update an existing integration
  ipcMain.handle(
    'integration:update',
    async (_event, id: string, updates: Partial<Omit<Integration, 'id' | 'createdAt'>>) => {
      // Extract API token if provided
      let apiToken: string | undefined

      if (updates.config) {
        if (updates.config.type === 'github') {
          apiToken = updates.config.apiToken
          delete updates.config.apiToken
        } else if (updates.config.type === 'jira') {
          apiToken = updates.config.apiToken
          delete updates.config.apiToken
        }
      }

      // Update the integration
      const integration = await updateIntegration(id, updates)

      // Update API token in secure storage if provided
      if (apiToken && integration) {
        const key = `nightshift:integration:${integration.id}:token`
        await setCredential(key, apiToken)
      }

      return integration
    }
  )

  // Delete an integration
  ipcMain.handle('integration:delete', async (_event, id: string) => {
    // Delete the integration
    const success = await deleteIntegration(id)

    // Delete the API token from secure storage
    if (success) {
      const key = `nightshift:integration:${id}:token`
      await deleteCredential(key)
    }

    return success
  })

  // Test integration connection
  ipcMain.handle('integration:test', async (_event, id: string) => {
    return await testIntegration(id)
  })

  // Fetch issues from an integration
  ipcMain.handle(
    'integration:fetchIssues',
    async (_event, integrationId: string, options?: FetchIssuesOptions) => {
      return await fetchIssues(integrationId, options)
    }
  )

  // Get a single issue from an integration
  ipcMain.handle(
    'integration:getIssue',
    async (_event, integrationId: string, issueId: string) => {
      return await getIssue(integrationId, issueId)
    }
  )

  // Import an external issue as a task
  ipcMain.handle(
    'integration:importAsTask',
    async (_event, integrationId: string, issueId: string, projectId: string) => {
      return await importIssueAsTask(integrationId, issueId, projectId)
    }
  )

  // Create a pull request (GitHub only)
  ipcMain.handle(
    'integration:createPR',
    async (_event, integrationId: string, taskId: string, options: CreatePROptions) => {
      return await createPullRequest(integrationId, taskId, options)
    }
  )

  // Transition a JIRA issue status
  ipcMain.handle(
    'integration:transitionIssue',
    async (_event, integrationId: string, issueId: string, transitionId: string) => {
      return await transitionJiraIssue(integrationId, issueId, transitionId)
    }
  )

  // Get integrations for a specific project
  ipcMain.handle('integration:listForProject', async (_event, projectId: string) => {
    return await getIntegrationsForProject(projectId)
  })
}
