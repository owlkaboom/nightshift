/**
 * JIRA integration client
 * Handles JIRA API operations for issue import
 */

import { logger } from '@main/utils/logger'
import type {
  JiraConfig,
  JiraConnectionConfig,
  ExternalIssue,
  FetchIssuesOptions,
  FetchIssuesResult,
  IntegrationTestResult,
  JiraBoard,
  JiraSprint,
  JiraFilter,
  JiraProject,
  JiraStatus,
  JiraSourceConfig
} from '@shared/types'

/**
 * JIRA client for API operations
 */
export class JiraClient {
  private config: JiraConfig | JiraConnectionConfig
  private apiToken: string
  private baseUrl: string
  private email: string

  constructor(config: JiraConfig | JiraConnectionConfig, apiToken: string) {
    this.config = config
    this.apiToken = apiToken
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.email = config.email
  }

  /**
   * Get authorization header for JIRA API
   */
  private getAuthHeader(): string {
    // JIRA Cloud uses email + API token for Basic Auth
    const credentials = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64')
    return `Basic ${credentials}`
  }

  /**
   * Make an authenticated request to JIRA API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.getAuthHeader(),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`JIRA API error: ${response.status} ${errorText}`)
    }

    return response.json() as Promise<T>
  }

  /**
   * Test the JIRA connection
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      // For connection configs, just test authentication by getting user info
      if (this.config.type === 'jira' && !('projectKey' in this.config)) {
        const data = await this.request<any>('/rest/api/3/myself')
        return {
          success: true,
          details: `Connected as ${data.displayName}`
        }
      }

      // For legacy configs with projectKey
      const legacyConfig = this.config as JiraConfig
      if (legacyConfig.projectKey) {
        const data = await this.request<any>(
          `/rest/api/3/project/${legacyConfig.projectKey}`
        )
        return {
          success: true,
          details: `Connected to project ${data.name}`
        }
      }

      // Fallback to user info
      const data = await this.request<any>('/rest/api/3/myself')
      return {
        success: true,
        details: `Connected as ${data.displayName}`
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to JIRA'
      }
    }
  }

  /**
   * Fetch issues from JIRA using JQL
   */
  async fetchIssues(options?: FetchIssuesOptions): Promise<ExternalIssue[]> {
    try {
      // Build JQL query
      // For legacy JiraConfig, use jql or projectKey from config
      // For JiraConnectionConfig, require JQL from options
      const legacyConfig = this.config as JiraConfig
      const baseJql = options?.jql || legacyConfig.jql || (legacyConfig.projectKey ? `project = ${legacyConfig.projectKey}` : '')

      // Build filter clauses
      const filters: string[] = []

      // Add assignee filter if provided
      if (options?.assignedToMe) {
        // Use email-based assignee filter for better reliability with API authentication
        // currentUser() may not work reliably when authenticating via API token
        filters.push(`assignee = "${this.config.email}"`)
      }

      // Add status filter if provided
      if (options?.state && options.state !== 'all') {
        // Use status categories instead of specific status names for better compatibility
        // JIRA has three status categories: "To Do", "In Progress", "Done"
        const statusFilter = options.state === 'open'
          ? 'statusCategory != Done'
          : options.state === 'closed'
          ? 'statusCategory = Done'
          : ''

        if (statusFilter) {
          filters.push(statusFilter)
        }
      }

      // Combine base JQL with filters
      let jql = baseJql
      if (filters.length > 0) {
        const filterClause = filters.join(' AND ')
        if (jql.trim()) {
          jql = `${jql} AND ${filterClause}`
        } else {
          jql = filterClause
        }
      }

      // Add ordering
      if (jql.trim()) {
        jql = `${jql} ORDER BY created DESC`
      } else {
        jql = 'ORDER BY created DESC'
      }

      const maxResults = options?.limit || 500
      const startAt = options?.startAt || 0

      logger.debug('[JiraClient] Executing JQL query:', jql, { maxResults, startAt })

      // Use the new /rest/api/3/search/jql POST endpoint
      const data = await this.request<any>(
        `/rest/api/3/search/jql`,
        {
          method: 'POST',
          body: JSON.stringify({
            jql,
            maxResults,
            startAt,
            fields: [
              'summary',
              'description',
              'status',
              'labels',
              'assignee',
              'created',
              'updated'
            ]
          })
        }
      )

      // Log pagination info if there are more results
      if (data.total > data.startAt + data.issues.length) {
        logger.debug(
          `[JiraClient] Retrieved ${data.issues.length} issues (${data.startAt + 1}-${data.startAt + data.issues.length} of ${data.total} total)`
        )
      }

      return data.issues.map((issue: any) => this.mapIssueToExternalIssue(issue))
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to fetch issues:', error)
      throw error
    }
  }

  /**
   * Get a single issue by key
   */
  async getIssue(issueKey: string): Promise<ExternalIssue | null> {
    try {
      const data = await this.request<any>(
        `/rest/api/3/issue/${issueKey}`
      )

      return this.mapIssueToExternalIssue(data)
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to get issue:', error)
      return null
    }
  }

  /**
   * Get available transitions for an issue
   */
  async getTransitions(issueKey: string): Promise<Array<{ id: string; name: string }>> {
    try {
      const data = await this.request<any>(
        `/rest/api/3/issue/${issueKey}/transitions`
      )

      return data.transitions.map((t: any) => ({
        id: t.id,
        name: t.name
      }))
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to get transitions:', error)
      return []
    }
  }

  /**
   * Transition an issue to a new status
   */
  async transitionIssue(issueKey: string, transitionId: string): Promise<boolean> {
    try {
      await this.request(
        `/rest/api/3/issue/${issueKey}/transitions`,
        {
          method: 'POST',
          body: JSON.stringify({
            transition: { id: transitionId }
          })
        }
      )
      return true
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to transition issue:', error)
      return false
    }
  }

  /**
   * Add a comment to an issue
   */
  async addComment(issueKey: string, comment: string): Promise<boolean> {
    try {
      await this.request(
        `/rest/api/3/issue/${issueKey}/comment`,
        {
          method: 'POST',
          body: JSON.stringify({
            body: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: comment
                    }
                  ]
                }
              ]
            }
          })
        }
      )
      return true
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to add comment:', error)
      return false
    }
  }

  /**
   * Map JIRA issue to ExternalIssue format
   */
  private mapIssueToExternalIssue(issue: any): ExternalIssue {
    const fields = issue.fields

    return {
      id: issue.key,
      source: 'jira',
      sourceId: '', // Will be set by the integration manager
      integrationId: '', // Legacy field for backward compatibility
      title: fields.summary,
      description: fields.description?.content?.[0]?.content?.[0]?.text || '',
      url: `${this.baseUrl}/browse/${issue.key}`,
      status: fields.status.name,
      statusCategory: fields.status.statusCategory?.name,
      labels: fields.labels || [],
      assignee: fields.assignee?.displayName,
      assigneeEmail: fields.assignee?.emailAddress,
      createdAt: fields.created,
      updatedAt: fields.updated
    }
  }

  // ============================================================================
  // DISCOVERY METHODS (for finding boards, sprints, filters, projects)
  // ============================================================================

  /**
   * List all accessible boards
   */
  async listBoards(): Promise<JiraBoard[]> {
    try {
      const data = await this.request<any>('/rest/agile/1.0/board')

      return data.values.map((board: any) => ({
        id: board.id,
        name: board.name,
        type: board.type.toLowerCase() as 'scrum' | 'kanban' | 'simple'
      }))
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to list boards:', error)
      throw error
    }
  }

  /**
   * List sprints for a specific board
   */
  async listSprints(boardId: number): Promise<JiraSprint[]> {
    try {
      const data = await this.request<any>(`/rest/agile/1.0/board/${boardId}/sprint`)

      return data.values.map((sprint: any) => ({
        id: sprint.id,
        name: sprint.name,
        state: sprint.state.toLowerCase() as 'active' | 'future' | 'closed',
        startDate: sprint.startDate,
        endDate: sprint.endDate
      }))
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to list sprints:', error)
      throw error
    }
  }

  /**
   * List saved filters accessible to the user
   */
  async listFilters(): Promise<JiraFilter[]> {
    try {
      const data = await this.request<any>('/rest/api/3/filter/search')

      return data.values.map((filter: any) => ({
        id: parseInt(filter.id, 10),
        name: filter.name,
        jql: filter.jql,
        owner: filter.owner?.displayName
      }))
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to list filters:', error)
      throw error
    }
  }

  /**
   * List all accessible projects
   */
  async listProjects(): Promise<JiraProject[]> {
    try {
      const data = await this.request<any>('/rest/api/3/project/search')

      return data.values.map((project: any) => ({
        id: project.id,
        key: project.key,
        name: project.name
      }))
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to list projects:', error)
      throw error
    }
  }

  /**
   * List all available statuses
   */
  async listStatuses(): Promise<JiraStatus[]> {
    try {
      const data = await this.request<any>('/rest/api/3/status')

      return data.map((status: any) => ({
        id: status.id,
        name: status.name,
        statusCategory: {
          id: status.statusCategory.id,
          key: status.statusCategory.key,
          name: status.statusCategory.name
        }
      }))
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to list statuses:', error)
      throw error
    }
  }

  // ============================================================================
  // SOURCE-AWARE FETCH METHODS
  // ============================================================================

  /**
   * Fetch issues from a board
   */
  async fetchBoardIssues(boardId: number, maxResults = 500, startAt = 0): Promise<ExternalIssue[]> {
    try {
      const data = await this.request<any>(
        `/rest/agile/1.0/board/${boardId}/issue?maxResults=${maxResults}&startAt=${startAt}`
      )

      // Log pagination info if there are more results
      if (data.total > data.startAt + data.issues.length) {
        logger.debug(
          `[JiraClient] Retrieved ${data.issues.length} board issues (${data.startAt + 1}-${data.startAt + data.issues.length} of ${data.total} total)`
        )
      }

      return data.issues.map((issue: any) => this.mapIssueToExternalIssue(issue))
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to fetch board issues:', error)
      throw error
    }
  }

  /**
   * Fetch issues from a sprint
   */
  async fetchSprintIssues(sprintId: number, maxResults = 500, startAt = 0): Promise<ExternalIssue[]> {
    try {
      const data = await this.request<any>(
        `/rest/agile/1.0/sprint/${sprintId}/issue?maxResults=${maxResults}&startAt=${startAt}`
      )

      // Log pagination info if there are more results
      if (data.total > data.startAt + data.issues.length) {
        logger.debug(
          `[JiraClient] Retrieved ${data.issues.length} sprint issues (${data.startAt + 1}-${data.startAt + data.issues.length} of ${data.total} total)`
        )
      }

      return data.issues.map((issue: any) => this.mapIssueToExternalIssue(issue))
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to fetch sprint issues:', error)
      throw error
    }
  }

  /**
   * Fetch backlog issues for a board
   */
  async fetchBacklogIssues(boardId: number, maxResults = 500, startAt = 0): Promise<ExternalIssue[]> {
    try {
      const data = await this.request<any>(
        `/rest/agile/1.0/board/${boardId}/backlog?maxResults=${maxResults}&startAt=${startAt}`
      )

      // Log pagination info if there are more results
      if (data.total > data.startAt + data.issues.length) {
        logger.debug(
          `[JiraClient] Retrieved ${data.issues.length} backlog issues (${data.startAt + 1}-${data.startAt + data.issues.length} of ${data.total} total)`
        )
      }

      return data.issues.map((issue: any) => this.mapIssueToExternalIssue(issue))
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to fetch backlog issues:', error)
      throw error
    }
  }

  /**
   * Fetch issues from a saved filter
   */
  async fetchFilterIssues(filterId: number, maxResults = 500, startAt = 0): Promise<ExternalIssue[]> {
    try {
      // Get filter details first to get the JQL
      const filter = await this.request<any>(`/rest/api/3/filter/${filterId}`)

      // Execute the filter's JQL
      const data = await this.request<any>(
        `/rest/api/3/search/jql`,
        {
          method: 'POST',
          body: JSON.stringify({
            jql: filter.jql,
            maxResults,
            startAt,
            fields: [
              'summary',
              'description',
              'status',
              'labels',
              'assignee',
              'created',
              'updated'
            ]
          })
        }
      )

      // Log pagination info if there are more results
      if (data.total > data.startAt + data.issues.length) {
        logger.debug(
          `[JiraClient] Retrieved ${data.issues.length} issues (${data.startAt + 1}-${data.startAt + data.issues.length} of ${data.total} total)`
        )
      }

      return data.issues.map((issue: any) => this.mapIssueToExternalIssue(issue))
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to fetch filter issues:', error)
      throw error
    }
  }

  /**
   * Fetch issues using custom JQL
   */
  async fetchJQLIssues(jql: string, maxResults = 500, startAt = 0): Promise<ExternalIssue[]> {
    try {
      const data = await this.request<any>(
        `/rest/api/3/search/jql`,
        {
          method: 'POST',
          body: JSON.stringify({
            jql,
            maxResults,
            startAt,
            fields: [
              'summary',
              'description',
              'status',
              'labels',
              'assignee',
              'created',
              'updated'
            ]
          })
        }
      )

      // Log pagination info if there are more results
      if (data.total > data.startAt + data.issues.length) {
        logger.debug(
          `[JiraClient] Retrieved ${data.issues.length} issues (${data.startAt + 1}-${data.startAt + data.issues.length} of ${data.total} total)`
        )
      }

      return data.issues.map((issue: any) => this.mapIssueToExternalIssue(issue))
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to fetch JQL issues:', error)
      throw error
    }
  }

  /**
   * Fetch issues from a project
   */
  async fetchProjectIssues(projectKey: string, maxResults = 500, startAt = 0): Promise<ExternalIssue[]> {
    return this.fetchJQLIssues(`project = ${projectKey} ORDER BY created DESC`, maxResults, startAt)
  }

  /**
   * Fetch issues from a source configuration
   */
  async fetchFromSource(
    sourceConfig: JiraSourceConfig,
    options?: FetchIssuesOptions
  ): Promise<FetchIssuesResult> {
    const maxResults = options?.limit || 25

    switch (sourceConfig.sourceType) {
      case 'board':
        return await this.fetchBoardIssuesWithFilters(sourceConfig.boardId, options)

      case 'sprint':
        // For sprint sources, we need to find the appropriate sprint first
        const sprints = await this.listSprints(sourceConfig.boardId)
        const sprint = sprints.find((s) => s.state === sourceConfig.sprintState)
        if (!sprint) {
          logger.debug(`[JiraClient] No ${sourceConfig.sprintState} sprint found for board ${sourceConfig.boardId}`)
          return { issues: [], total: 0, startAt: 0, maxResults, hasMore: false }
        }
        return await this.fetchSprintIssuesWithFilters(sprint.id, options)

      case 'backlog':
        return await this.fetchBacklogIssuesWithFilters(sourceConfig.boardId, options)

      case 'filter':
        // For filters, modify the filter's JQL with additional filters (server-side)
        return await this.fetchFilterIssuesWithOptionsResult(sourceConfig.filterId, options)

      case 'jql':
        // For custom JQL, apply filters to the JQL (server-side)
        return await this.fetchJQLIssuesWithOptionsResult(sourceConfig.jql, options)

      case 'project':
        // For projects, apply filters to the project JQL (server-side)
        return await this.fetchProjectIssuesWithOptionsResult(sourceConfig.projectKey, options)

      default:
        throw new Error(`Unknown source type: ${(sourceConfig as any).sourceType}`)
    }
  }


  // ============================================================================
  // PAGINATION-AWARE FETCH METHODS
  // ============================================================================

  /**
   * Fetch board issues with filters and pagination metadata
   */
  private async fetchBoardIssuesWithFilters(
    boardId: number,
    options?: FetchIssuesOptions
  ): Promise<FetchIssuesResult> {
    const maxResults = options?.limit || 25
    const startAt = options?.startAt || 0

    try {
      // For board issues, we need to use JQL to apply filters server-side
      // Build JQL query for the board
      let jql = `board = ${boardId} ORDER BY created DESC`

      // Build filter clauses
      const filters: string[] = []

      if (options?.assignedToMe) {
        filters.push(`assignee = "${this.email}"`)
      }

      if (options?.state && options.state !== 'all') {
        const statusFilter =
          options.state === 'open'
            ? 'statusCategory != Done'
            : options.state === 'closed'
            ? 'statusCategory = Done'
            : ''
        if (statusFilter) {
          filters.push(statusFilter)
        }
      }

      if (filters.length > 0) {
        const filterClause = filters.join(' AND ')
        jql = `${jql} AND ${filterClause}`
      }

      const data = await this.request<any>('/rest/api/3/search/jql', {
        method: 'POST',
        body: JSON.stringify({
          jql,
          maxResults,
          startAt,
          fields: [
            'summary',
            'description',
            'status',
            'labels',
            'assignee',
            'created',
            'updated'
          ]
        })
      })

      const issues = (data.issues || []).map((issue: any) => this.mapIssueToExternalIssue(issue))

      return {
        issues,
        total: data.total || 0,
        startAt: data.startAt || 0,
        maxResults: data.maxResults || maxResults,
        hasMore: (data.startAt || 0) + issues.length < (data.total || 0)
      }
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to fetch board issues with filters:', error)
      throw error
    }
  }

  /**
   * Fetch sprint issues with filters and pagination metadata
   */
  private async fetchSprintIssuesWithFilters(
    sprintId: number,
    options?: FetchIssuesOptions
  ): Promise<FetchIssuesResult> {
    const maxResults = options?.limit || 25
    const startAt = options?.startAt || 0

    try {
      // For sprint issues, we need to use JQL to apply filters server-side
      let jql = `sprint = ${sprintId} ORDER BY created DESC`

      // Build filter clauses
      const filters: string[] = []

      if (options?.assignedToMe) {
        filters.push(`assignee = "${this.email}"`)
      }

      if (options?.state && options.state !== 'all') {
        const statusFilter =
          options.state === 'open'
            ? 'statusCategory != Done'
            : options.state === 'closed'
            ? 'statusCategory = Done'
            : ''
        if (statusFilter) {
          filters.push(statusFilter)
        }
      }

      if (filters.length > 0) {
        const filterClause = filters.join(' AND ')
        jql = `${jql} AND ${filterClause}`
      }

      const data = await this.request<any>('/rest/api/3/search/jql', {
        method: 'POST',
        body: JSON.stringify({
          jql,
          maxResults,
          startAt,
          fields: [
            'summary',
            'description',
            'status',
            'labels',
            'assignee',
            'created',
            'updated'
          ]
        })
      })

      const issues = (data.issues || []).map((issue: any) => this.mapIssueToExternalIssue(issue))

      return {
        issues,
        total: data.total || 0,
        startAt: data.startAt || 0,
        maxResults: data.maxResults || maxResults,
        hasMore: (data.startAt || 0) + issues.length < (data.total || 0)
      }
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to fetch sprint issues with filters:', error)
      throw error
    }
  }

  /**
   * Fetch backlog issues with filters and pagination metadata
   */
  private async fetchBacklogIssuesWithFilters(
    boardId: number,
    options?: FetchIssuesOptions
  ): Promise<FetchIssuesResult> {
    const maxResults = options?.limit || 25
    const startAt = options?.startAt || 0

    try {
      // For backlog issues, we need to use JQL to apply filters server-side
      let jql = `sprint is EMPTY AND board = ${boardId} ORDER BY created DESC`

      // Build filter clauses
      const filters: string[] = []

      if (options?.assignedToMe) {
        filters.push(`assignee = "${this.email}"`)
      }

      if (options?.state && options.state !== 'all') {
        const statusFilter =
          options.state === 'open'
            ? 'statusCategory != Done'
            : options.state === 'closed'
            ? 'statusCategory = Done'
            : ''
        if (statusFilter) {
          filters.push(statusFilter)
        }
      }

      if (filters.length > 0) {
        const filterClause = filters.join(' AND ')
        jql = `${jql} AND ${filterClause}`
      }

      const data = await this.request<any>('/rest/api/3/search/jql', {
        method: 'POST',
        body: JSON.stringify({
          jql,
          maxResults,
          startAt,
          fields: [
            'summary',
            'description',
            'status',
            'labels',
            'assignee',
            'created',
            'updated'
          ]
        })
      })

      const issues = (data.issues || []).map((issue: any) => this.mapIssueToExternalIssue(issue))

      return {
        issues,
        total: data.total || 0,
        startAt: data.startAt || 0,
        maxResults: data.maxResults || maxResults,
        hasMore: (data.startAt || 0) + issues.length < (data.total || 0)
      }
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to fetch backlog issues with filters:', error)
      throw error
    }
  }

  /**
   * Fetch filter issues with options and return result with pagination
   */
  private async fetchFilterIssuesWithOptionsResult(
    filterId: number,
    options?: FetchIssuesOptions
  ): Promise<FetchIssuesResult> {
    try {
      // Get filter details first to get the JQL
      const filter = await this.request<any>(`/rest/api/3/filter/${filterId}`)

      // Use the filter's JQL with options
      return await this.fetchJQLIssuesWithOptionsResult(filter.jql, options)
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to fetch filter issues:', error)
      throw error
    }
  }

  /**
   * Fetch issues using JQL with options and return result with pagination
   */
  private async fetchJQLIssuesWithOptionsResult(
    baseJql: string,
    options?: FetchIssuesOptions
  ): Promise<FetchIssuesResult> {
    try {
      // Build filter clauses
      const filters: string[] = []

      // Add assignee filter if provided
      if (options?.assignedToMe) {
        filters.push(`assignee = "${this.email}"`)
      }

      // Add status filter if provided
      if (options?.state && options.state !== 'all') {
        const statusFilter =
          options.state === 'open'
            ? 'statusCategory != Done'
            : options.state === 'closed'
            ? 'statusCategory = Done'
            : ''

        if (statusFilter) {
          filters.push(statusFilter)
        }
      }

      // Combine base JQL with filters
      let jql = baseJql
      if (filters.length > 0) {
        const filterClause = filters.join(' AND ')
        jql = `${jql} AND ${filterClause}`
      }

      const maxResults = options?.limit || 25
      const startAt = options?.startAt || 0

      logger.debug('[JiraClient] Executing JQL query with options:', jql, { maxResults, startAt })

      const data = await this.request<any>('/rest/api/3/search/jql', {
        method: 'POST',
        body: JSON.stringify({
          jql,
          maxResults,
          startAt,
          fields: [
            'summary',
            'description',
            'status',
            'labels',
            'assignee',
            'created',
            'updated'
          ]
        })
      })

      const issues = (data.issues || []).map((issue: any) => this.mapIssueToExternalIssue(issue))

      return {
        issues,
        total: data.total || 0,
        startAt: data.startAt || 0,
        maxResults: data.maxResults || maxResults,
        hasMore: (data.startAt || 0) + issues.length < (data.total || 0)
      }
    } catch (error) {
      logger.log('error', '[JiraClient] Failed to fetch JQL issues with options:', error)
      throw error
    }
  }

  /**
   * Fetch issues from a project with options and return result with pagination
   */
  private async fetchProjectIssuesWithOptionsResult(
    projectKey: string,
    options?: FetchIssuesOptions
  ): Promise<FetchIssuesResult> {
    const jql = `project = ${projectKey} ORDER BY created DESC`
    return this.fetchJQLIssuesWithOptionsResult(jql, options)
  }
}
