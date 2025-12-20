/**
 * GitHub Importer - Fetch skill files from GitHub repositories
 *
 * Supports fetching .md files from GitHub repos and parsing them as skills.
 * Expected file format:
 * - First line: # Skill Name
 * - Second paragraph: Description
 * - Remaining content: Prompt
 */

import type { GithubSkillData } from '@shared/ipc-types'
import { logger } from '@main/utils/logger'

/**
 * Parse a GitHub URL to extract owner and repo
 */
function parseGithubUrl(url: string): { owner: string; repo: string; branch?: string } {
  try {
    const parsed = new URL(url)
    const pathParts = parsed.pathname.split('/').filter(Boolean)

    if (pathParts.length < 2) {
      throw new Error('Invalid GitHub URL: must contain owner and repo')
    }

    return {
      owner: pathParts[0],
      repo: pathParts[1],
      branch: pathParts[3] === 'tree' ? pathParts[4] : undefined
    }
  } catch (error) {
    throw new Error('Invalid GitHub URL format')
  }
}

/**
 * Parse a skill markdown file
 */
function parseSkillMarkdown(content: string, path: string): GithubSkillData | null {
  const lines = content.split('\n')

  // Extract title (first heading)
  const titleLine = lines.find(line => line.startsWith('# '))
  if (!titleLine) {
    console.warn(`No title found in ${path}`)
    return null
  }

  const name = titleLine.replace(/^#\s+/, '').trim()

  // Find description (first non-empty paragraph after title)
  let descriptionStart = lines.findIndex(line => line === titleLine) + 1
  while (descriptionStart < lines.length && !lines[descriptionStart].trim()) {
    descriptionStart++
  }

  let descriptionEnd = descriptionStart
  while (descriptionEnd < lines.length && lines[descriptionEnd].trim()) {
    descriptionEnd++
  }

  const description = lines.slice(descriptionStart, descriptionEnd).join(' ').trim()

  if (!description) {
    console.warn(`No description found in ${path}`)
    return null
  }

  // Remaining content is the prompt
  let promptStart = descriptionEnd
  while (promptStart < lines.length && !lines[promptStart].trim()) {
    promptStart++
  }

  const prompt = lines.slice(promptStart).join('\n').trim()

  if (!prompt) {
    console.warn(`No prompt content found in ${path}`)
    return null
  }

  return {
    name,
    description,
    prompt,
    path
  }
}

/**
 * Fetch directory contents from GitHub API
 */
async function fetchGithubDirectory(
  owner: string,
  repo: string,
  path: string = '',
  branch?: string
): Promise<any[]> {
  const branchParam = branch ? `?ref=${branch}` : ''
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}${branchParam}`

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Nightshift-App'
    }
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Repository not found or path does not exist')
    } else if (response.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Please try again later.')
    }
    throw new Error(`GitHub API error: ${response.statusText}`)
  }

  return response.json() as Promise<any[]>
}

/**
 * Fetch file content from GitHub API
 */
async function fetchGithubFile(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3.raw',
      'User-Agent': 'Nightshift-App'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`)
  }

  return response.text()
}

/**
 * Recursively find all .md files in a GitHub repository
 */
async function findMarkdownFiles(
  owner: string,
  repo: string,
  path: string = '',
  branch?: string,
  maxDepth: number = 3,
  currentDepth: number = 0
): Promise<{ path: string; download_url: string }[]> {
  if (currentDepth >= maxDepth) {
    return []
  }

  const contents = await fetchGithubDirectory(owner, repo, path, branch)
  const mdFiles: { path: string; download_url: string }[] = []

  for (const item of contents) {
    if (item.type === 'file' && item.name.endsWith('.md')) {
      mdFiles.push({
        path: item.path,
        download_url: item.download_url
      })
    } else if (item.type === 'dir') {
      // Recursively search subdirectories
      const subFiles = await findMarkdownFiles(
        owner,
        repo,
        item.path,
        branch,
        maxDepth,
        currentDepth + 1
      )
      mdFiles.push(...subFiles)
    }
  }

  return mdFiles
}

/**
 * Fetch skills from a GitHub repository
 *
 * @param githubUrl - GitHub repository URL
 * @returns Array of parsed skill data
 */
export async function fetchSkillsFromGithub(githubUrl: string): Promise<GithubSkillData[]> {
  logger.debug('[GitHubImporter] Fetching skills from:', githubUrl)

  // Parse the URL
  const { owner, repo, branch } = parseGithubUrl(githubUrl)
  logger.debug('[GitHubImporter] Parsed:', { owner, repo, branch })

  // Find all markdown files
  const mdFiles = await findMarkdownFiles(owner, repo, '', branch)
  logger.debug('[GitHubImporter] Found', mdFiles.length, 'markdown files')

  // Fetch and parse each file
  const skills: GithubSkillData[] = []

  for (const file of mdFiles) {
    try {
      const content = await fetchGithubFile(file.download_url)
      const skill = parseSkillMarkdown(content, file.path)

      if (skill) {
        skills.push(skill)
      }
    } catch (error) {
      console.error(`[GitHubImporter] Error parsing ${file.path}:`, error)
      // Continue with other files
    }
  }

  logger.debug('[GitHubImporter] Successfully parsed', skills.length, 'skills')

  return skills
}
