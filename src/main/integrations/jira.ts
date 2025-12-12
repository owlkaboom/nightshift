/**
 * JIRA integration client
 * Handles JIRA API operations for issue import
 */

import type {
  JiraConfig,
  JiraConnectionConfig,
  ExternalIssue,
  FetchIssuesOptions,
  IntegrationTestResult,
  JiraBoard,
  JiraSprint,
  JiraFilter,
  JiraProject,
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
      let jql = options?.jql || legacyConfig.jql || (legacyConfig.projectKey ? `project = ${legacyConfig.projectKey}` : '')

      // Add assignee filter if provided
      if (options?.assignedToMe) {
        // Use email-based assignee filter for better reliability with API authentication
        // currentUser() may not work reliably when authenticating via API token
        jql = `${jql} AND assignee = "${this.config.email}"`
      }

      // Add status filter if provided
      if (options?.state) {
        const statusFilter = options.state === 'open'
          ? 'status NOT IN (Done, Closed, Resolved)'
          : options.state === 'closed'
          ? 'status IN (Done, Closed, Resolved)'
          : ''

        if (statusFilter) {
          jql = `${jql} AND ${statusFilter}`
        }
      }

      // Add ordering
      jql = `${jql} ORDER BY created DESC`

      const maxResults = options?.limit || 100

      console.log('[JiraClient] Executing JQL query:', jql)

      // Use the new /rest/api/3/search/jql POST endpoint
      const data = await this.request<any>(
        `/rest/api/3/search/jql`,
        {
          method: 'POST',
          body: JSON.stringify({
            jql,
            maxResults,
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

      return data.issues.map((issue: any) => this.mapIssueToExternalIssue(issue))
    } catch (error) {
      console.error('[JiraClient] Failed to fetch issues:', error)
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
      console.error('[JiraClient] Failed to get issue:', error)
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
      console.error('[JiraClient] Failed to get transitions:', error)
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
      console.error('[JiraClient] Failed to transition issue:', error)
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
      console.error('[JiraClient] Failed to add comment:', error)
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
      labels: fields.labels || [],
      assignee: fields.assignee?.displayName,
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
      console.error('[JiraClient] Failed to list boards:', error)
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
      console.error('[JiraClient] Failed to list sprints:', error)
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
      console.error('[JiraClient] Failed to list filters:', error)
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
      console.error('[JiraClient] Failed to list projects:', error)
      throw error
    }
  }

  // ============================================================================
  // SOURCE-AWARE FETCH METHODS
  // ============================================================================

  /**
   * Fetch issues from a board
   */
  async fetchBoardIssues(boardId: number, maxResults = 100): Promise<ExternalIssue[]> {
    try {
      const data = await this.request<any>(
        `/rest/agile/1.0/board/${boardId}/issue?maxResults=${maxResults}`
      )

      return data.issues.map((issue: any) => this.mapIssueToExternalIssue(issue))
    } catch (error) {
      console.error('[JiraClient] Failed to fetch board issues:', error)
      throw error
    }
  }

  /**
   * Fetch issues from a sprint
   */
  async fetchSprintIssues(sprintId: number, maxResults = 100): Promise<ExternalIssue[]> {
    try {
      const data = await this.request<any>(
        `/rest/agile/1.0/sprint/${sprintId}/issue?maxResults=${maxResults}`
      )

      return data.issues.map((issue: any) => this.mapIssueToExternalIssue(issue))
    } catch (error) {
      console.error('[JiraClient] Failed to fetch sprint issues:', error)
      throw error
    }
  }

  /**
   * Fetch backlog issues for a board
   */
  async fetchBacklogIssues(boardId: number, maxResults = 100): Promise<ExternalIssue[]> {
    try {
      const data = await this.request<any>(
        `/rest/agile/1.0/board/${boardId}/backlog?maxResults=${maxResults}`
      )

      return data.issues.map((issue: any) => this.mapIssueToExternalIssue(issue))
    } catch (error) {
      console.error('[JiraClient] Failed to fetch backlog issues:', error)
      throw error
    }
  }

  /**
   * Fetch issues from a saved filter
   */
  async fetchFilterIssues(filterId: number, maxResults = 100): Promise<ExternalIssue[]> {
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

      return data.issues.map((issue: any) => this.mapIssueToExternalIssue(issue))
    } catch (error) {
      console.error('[JiraClient] Failed to fetch filter issues:', error)
      throw error
    }
  }

  /**
   * Fetch issues using custom JQL
   */
  async fetchJQLIssues(jql: string, maxResults = 100): Promise<ExternalIssue[]> {
    try {
      const data = await this.request<any>(
        `/rest/api/3/search/jql`,
        {
          method: 'POST',
          body: JSON.stringify({
            jql,
            maxResults,
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

      return data.issues.map((issue: any) => this.mapIssueToExternalIssue(issue))
    } catch (error) {
      console.error('[JiraClient] Failed to fetch JQL issues:', error)
      throw error
    }
  }

  /**
   * Fetch issues from a project
   */
  async fetchProjectIssues(projectKey: string, maxResults = 100): Promise<ExternalIssue[]> {
    return this.fetchJQLIssues(`project = ${projectKey} ORDER BY created DESC`, maxResults)
  }

  /**
   * Fetch issues from a source configuration
   */
  async fetchFromSource(sourceConfig: JiraSourceConfig, maxResults = 100): Promise<ExternalIssue[]> {
    switch (sourceConfig.sourceType) {
      case 'board':
        return this.fetchBoardIssues(sourceConfig.boardId, maxResults)

      case 'sprint':
        // For sprint sources, we need to find the appropriate sprint first
        const sprints = await this.listSprints(sourceConfig.boardId)
        const sprint = sprints.find((s) => s.state === sourceConfig.sprintState)
        if (!sprint) {
          console.warn(`[JiraClient] No ${sourceConfig.sprintState} sprint found for board ${sourceConfig.boardId}`)
          return []
        }
        return this.fetchSprintIssues(sprint.id, maxResults)

      case 'backlog':
        return this.fetchBacklogIssues(sourceConfig.boardId, maxResults)

      case 'filter':
        return this.fetchFilterIssues(sourceConfig.filterId, maxResults)

      case 'jql':
        return this.fetchJQLIssues(sourceConfig.jql, maxResults)

      case 'project':
        return this.fetchProjectIssues(sourceConfig.projectKey, maxResults)

      default:
        throw new Error(`Unknown source type: ${(sourceConfig as any).sourceType}`)
    }
  }
}
