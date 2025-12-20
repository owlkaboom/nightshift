/**
 * Context loader utility for planning sessions
 * Loads content from files, URLs, notes, and projects
 */

import fs from 'fs/promises'
import path from 'path'
import type { ContextAttachment } from '@shared/types'
import * as vaultStore from '@main/storage/vault/vault-store'
import { getProject, getProjectPath } from '@main/storage'

/**
 * Maximum file size to load (5MB)
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024

/**
 * Maximum URL content size (2MB)
 */
const MAX_URL_SIZE = 2 * 1024 * 1024

/**
 * Load content for a context attachment based on its type
 */
export async function loadContextAttachmentContent(
  attachment: ContextAttachment
): Promise<ContextAttachment> {
  try {
    let content: string

    switch (attachment.type) {
      case 'file':
        content = await loadFileContent(attachment.reference)
        break

      case 'url':
        content = await loadUrlContent(attachment.reference)
        break

      case 'note':
        content = await loadNoteContent(attachment.reference)
        break

      case 'project':
        content = await loadProjectContext(attachment.reference)
        break

      default:
        throw new Error(`Unknown context attachment type: ${attachment.type}`)
    }

    return {
      ...attachment,
      content,
      error: undefined
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[ContextLoader] Error loading context attachment:', errorMessage)

    return {
      ...attachment,
      content: undefined,
      error: errorMessage
    }
  }
}

/**
 * Load file content from local filesystem
 */
async function loadFileContent(filePath: string): Promise<string> {
  // Check if file exists
  const stats = await fs.stat(filePath)

  if (!stats.isFile()) {
    throw new Error('Path is not a file')
  }

  // Check file size
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`File is too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`)
  }

  // Read file content
  const content = await fs.readFile(filePath, 'utf-8')

  return content
}

/**
 * Load URL content via fetch
 */
async function loadUrlContent(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Nightshift/1.0'
    },
    signal: AbortSignal.timeout(30000) // 30 second timeout
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  // Check content length
  const contentLength = response.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > MAX_URL_SIZE) {
    throw new Error(`URL content too large (max ${MAX_URL_SIZE / 1024 / 1024}MB)`)
  }

  // Get content type
  const contentType = response.headers.get('content-type') || ''

  // Only support text content
  if (!contentType.includes('text') && !contentType.includes('json') && !contentType.includes('xml')) {
    throw new Error('URL must return text content')
  }

  const content = await response.text()

  // Double-check size after download
  if (content.length > MAX_URL_SIZE) {
    throw new Error(`URL content too large (max ${MAX_URL_SIZE / 1024 / 1024}MB)`)
  }

  return content
}

/**
 * Load note content from vault
 */
async function loadNoteContent(noteId: string): Promise<string> {
  const note = await vaultStore.getNote(noteId)

  if (!note) {
    throw new Error(`Note not found: ${noteId}`)
  }

  // Format note content with metadata
  let content = `# ${note.title}\n\n`

  if (note.tags && note.tags.length > 0) {
    content += `Tags: ${note.tags.join(', ')}\n\n`
  }

  content += note.content

  return content
}

/**
 * Load project context (README, description, etc.)
 */
async function loadProjectContext(projectId: string): Promise<string> {
  const project = await getProject(projectId)

  if (!project) {
    throw new Error(`Project not found: ${projectId}`)
  }

  let content = `# Project: ${project.name}\n\n`

  if (project.description) {
    content += `## Description\n${project.description}\n\n`
  }

  // Try to load README from project directory
  const projectPath = await getProjectPath(projectId)
  if (projectPath) {
    const readmePath = await findReadme(projectPath)
    if (readmePath) {
      try {
        const readmeContent = await fs.readFile(readmePath, 'utf-8')
        content += `## README\n\`\`\`\n${readmeContent}\n\`\`\`\n\n`
      } catch (error) {
        console.warn('[ContextLoader] Could not read README:', error)
      }
    }
  }

  return content
}

/**
 * Find README file in a directory
 */
async function findReadme(dirPath: string): Promise<string | null> {
  const possibleNames = [
    'README.md',
    'README.MD',
    'readme.md',
    'Readme.md',
    'README',
    'README.txt'
  ]

  for (const name of possibleNames) {
    const filePath = path.join(dirPath, name)
    try {
      const stats = await fs.stat(filePath)
      if (stats.isFile()) {
        return filePath
      }
    } catch {
      // File doesn't exist, continue
    }
  }

  return null
}

/**
 * Format context attachments for agent consumption
 */
export function formatContextAttachmentsForAgent(attachments: ContextAttachment[]): string {
  if (!attachments || attachments.length === 0) {
    return ''
  }

  let formatted = '\n\n--- Additional Context ---\n\n'

  for (const attachment of attachments) {
    if (!attachment.content) {
      continue
    }

    formatted += `### ${attachment.label}\n`
    formatted += `Source: ${attachment.reference}\n\n`

    // Wrap content in code blocks if it looks like code
    if (attachment.type === 'file' && isCodeFile(attachment.reference)) {
      const ext = path.extname(attachment.reference).slice(1)
      formatted += `\`\`\`${ext}\n${attachment.content}\n\`\`\`\n\n`
    } else {
      formatted += `${attachment.content}\n\n`
    }
  }

  formatted += '--- End Context ---\n\n'

  return formatted
}

/**
 * Check if a file path looks like a code file
 */
function isCodeFile(filePath: string): boolean {
  const codeExtensions = [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.py',
    '.java',
    '.c',
    '.cpp',
    '.rs',
    '.go',
    '.rb',
    '.php',
    '.swift',
    '.kt',
    '.cs',
    '.sql',
    '.sh',
    '.bash',
    '.json',
    '.yaml',
    '.yml',
    '.toml',
    '.xml',
    '.html',
    '.css',
    '.scss',
    '.sass'
  ]

  const ext = path.extname(filePath).toLowerCase()
  return codeExtensions.includes(ext)
}
