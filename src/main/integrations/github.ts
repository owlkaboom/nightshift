/**
 * GitHub integration client
 * Handles GitHub API operations for issue import and PR creation
 */

import { Octokit } from '@octokit/rest'
import type {
  GitHubConfig,
  ExternalIssue,
  FetchIssuesOptions,
  CreatePROptions,
  CreatePRResult,
  IntegrationTestResult
} from '@shared/types'

/**
 * GitHub client wrapper for API operations
 */
export class GitHubClient {
  private octokit: Octokit
  private config: GitHubConfig

  constructor(config: GitHubConfig, apiToken: string) {
    this.config = config
    this.octokit = new Octokit({
      auth: apiToken
    })
  }

  /**
   * Test the GitHub connection
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      // Try to get the repository info
      const { data } = await this.octokit.rest.repos.get({
        owner: this.config.owner,
        repo: this.config.repo
      })

      return {
        success: true,
        details: `Connected to ${data.full_name}`
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to GitHub'
      }
    }
  }

  /**
   * Fetch issues from GitHub
   */
  async fetchIssues(options?: FetchIssuesOptions): Promise<ExternalIssue[]> {
    try {
      const labels = options?.labels || this.config.defaultLabels || []
      const state = options?.state || 'open'
      const perPage = options?.limit || 100
      const assignedToMe = options?.assignedToMe || false

      // If assignedToMe is true, we need to get the authenticated user first
      let assignee: string | undefined = undefined
      if (assignedToMe) {
        try {
          const { data: user } = await this.octokit.rest.users.getAuthenticated()
          assignee = user.login
        } catch (error) {
          console.warn('[GitHubClient] Failed to get authenticated user:', error)
        }
      }

      const { data: issues } = await this.octokit.rest.issues.listForRepo({
        owner: this.config.owner,
        repo: this.config.repo,
        state: state === 'all' ? undefined : state,
        labels: labels.join(','),
        assignee: assignee,
        per_page: perPage
      })

      return issues
        .filter((issue) => !issue.pull_request) // Exclude pull requests
        .map((issue) => this.mapIssueToExternalIssue(issue))
    } catch (error) {
      console.error('[GitHubClient] Failed to fetch issues:', error)
      throw error
    }
  }

  /**
   * Get a single issue by number
   */
  async getIssue(issueNumber: number): Promise<ExternalIssue | null> {
    try {
      const { data: issue } = await this.octokit.rest.issues.get({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber
      })

      return this.mapIssueToExternalIssue(issue)
    } catch (error) {
      console.error('[GitHubClient] Failed to get issue:', error)
      return null
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(options: CreatePROptions): Promise<CreatePRResult> {
    try {
      const { data: pr } = await this.octokit.rest.pulls.create({
        owner: this.config.owner,
        repo: this.config.repo,
        title: options.title,
        body: options.body,
        head: options.headBranch,
        base: options.baseBranch,
        draft: options.draft || false
      })

      return {
        url: pr.html_url,
        number: pr.number
      }
    } catch (error) {
      console.error('[GitHubClient] Failed to create PR:', error)
      throw error
    }
  }

  /**
   * Update issue status (close/reopen)
   */
  async updateIssueStatus(issueNumber: number, state: 'open' | 'closed'): Promise<boolean> {
    try {
      await this.octokit.rest.issues.update({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber,
        state
      })
      return true
    } catch (error) {
      console.error('[GitHubClient] Failed to update issue status:', error)
      return false
    }
  }

  /**
   * Add a comment to an issue
   */
  async addComment(issueNumber: number, comment: string): Promise<boolean> {
    try {
      await this.octokit.rest.issues.createComment({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber,
        body: comment
      })
      return true
    } catch (error) {
      console.error('[GitHubClient] Failed to add comment:', error)
      return false
    }
  }

  /**
   * Map GitHub issue to ExternalIssue format
   */
  private mapIssueToExternalIssue(issue: any): ExternalIssue {
    return {
      id: `GH-${issue.number}`,
      source: 'github',
      sourceId: '', // Will be set by the integration manager
      integrationId: '', // Legacy field for backward compatibility
      title: issue.title,
      description: issue.body || '',
      url: issue.html_url,
      status: issue.state,
      labels: issue.labels?.map((label: any) => label.name) || [],
      assignee: issue.assignee?.login,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at
    }
  }
}

/**
 * Parse GitHub issue ID (e.g., "GH-123" → 123)
 */
export function parseGitHubIssueId(externalId: string): number | null {
  const match = externalId.match(/^GH-(\d+)$/)
  return match ? parseInt(match[1], 10) : null
}
