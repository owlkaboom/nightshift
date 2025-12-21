/**
 * CLAUDE.md Analysis Service
 *
 * Analyzes CLAUDE.md files and .claude/docs/ directories to provide
 * quality metrics and recommendations for project AI context.
 */

import { join } from 'path'
import { promises as fs } from 'fs'
import type { ClaudeMdAnalysis, ClaudeMdSubFile } from '@shared/types'
import { analyzeClaudeMd } from '@shared/types'

/**
 * Check if a path exists
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Read and analyze sub-files in .claude/docs/
 */
async function analyzeSubFiles(projectPath: string): Promise<ClaudeMdSubFile[]> {
  const docsPath = join(projectPath, '.claude', 'docs')

  if (!(await pathExists(docsPath))) {
    return []
  }

  try {
    const files = await fs.readdir(docsPath, { withFileTypes: true })
    const mdFiles = files.filter(f => f.isFile() && f.name.endsWith('.md'))

    const subFiles: ClaudeMdSubFile[] = []

    for (const file of mdFiles) {
      const filePath = join(docsPath, file.name)

      try {
        const [content, stats] = await Promise.all([
          fs.readFile(filePath, 'utf-8'),
          fs.stat(filePath)
        ])

        // Extract description from first paragraph or first line
        const description = extractDescription(content)
        const lineCount = content.split('\n').length

        subFiles.push({
          path: filePath,
          name: file.name,
          description,
          lineCount,
          sizeBytes: stats.size,
          lastModified: stats.mtime.toISOString()
        })
      } catch (error) {
        console.warn(`[ClaudeMdAnalyzer] Failed to read sub-file ${file.name}:`, error)
      }
    }

    return subFiles
  } catch (error) {
    console.warn(`[ClaudeMdAnalyzer] Failed to read docs directory:`, error)
    return []
  }
}

/**
 * Extract description from markdown content
 */
function extractDescription(content: string): string | null {
  const lines = content.split('\n')

  // Skip title and find first meaningful content
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#')) {
      continue
    }
    if (lines[i].trim()) {
      // Found first non-empty, non-header line
      const description = lines[i].trim()
      return description.length > 200 ? description.slice(0, 200) + '...' : description
    }
  }

  return null
}

/**
 * Analyze a project's CLAUDE.md file
 */
export async function analyzeProjectClaudeMd(projectPath: string): Promise<ClaudeMdAnalysis> {
  const claudeMdPath = join(projectPath, 'CLAUDE.md')
  const exists = await pathExists(claudeMdPath)

  let content: string | null = null
  if (exists) {
    try {
      content = await fs.readFile(claudeMdPath, 'utf-8')
    } catch (error) {
      console.error(`[ClaudeMdAnalyzer] Failed to read CLAUDE.md:`, error)
      content = null
    }
  }

  // Analyze sub-files
  const subFiles = await analyzeSubFiles(projectPath)

  // Use shared analysis logic
  return analyzeClaudeMd(content, exists ? claudeMdPath : null, subFiles)
}

/**
 * Get sub-files for a project
 */
export async function getProjectSubFiles(projectPath: string): Promise<ClaudeMdSubFile[]> {
  return analyzeSubFiles(projectPath)
}

/**
 * Create a sub-file in .claude/docs/
 */
export async function createSubFile(
  projectPath: string,
  name: string,
  content: string
): Promise<void> {
  const docsPath = join(projectPath, '.claude', 'docs')

  // Ensure directory exists
  await fs.mkdir(docsPath, { recursive: true })

  // Ensure name ends with .md
  const fileName = name.endsWith('.md') ? name : `${name}.md`
  const filePath = join(docsPath, fileName)

  // Check if file already exists
  if (await pathExists(filePath)) {
    throw new Error(`Sub-file '${fileName}' already exists`)
  }

  // Write file
  await fs.writeFile(filePath, content, 'utf-8')
}

/**
 * Update a sub-file in .claude/docs/
 */
export async function updateSubFile(
  projectPath: string,
  name: string,
  content: string
): Promise<void> {
  const docsPath = join(projectPath, '.claude', 'docs')
  const fileName = name.endsWith('.md') ? name : `${name}.md`
  const filePath = join(docsPath, fileName)

  // Check if file exists
  if (!(await pathExists(filePath))) {
    throw new Error(`Sub-file '${fileName}' not found`)
  }

  // Write file
  await fs.writeFile(filePath, content, 'utf-8')
}

/**
 * Delete a sub-file from .claude/docs/
 */
export async function deleteSubFile(projectPath: string, name: string): Promise<void> {
  const docsPath = join(projectPath, '.claude', 'docs')
  const fileName = name.endsWith('.md') ? name : `${name}.md`
  const filePath = join(docsPath, fileName)

  // Check if file exists
  if (!(await pathExists(filePath))) {
    throw new Error(`Sub-file '${fileName}' not found`)
  }

  // Delete file
  await fs.unlink(filePath)
}

/**
 * Read a sub-file's content
 */
export async function readSubFile(projectPath: string, name: string): Promise<string> {
  const docsPath = join(projectPath, '.claude', 'docs')
  const fileName = name.endsWith('.md') ? name : `${name}.md`
  const filePath = join(docsPath, fileName)

  // Check if file exists
  if (!(await pathExists(filePath))) {
    throw new Error(`Sub-file '${fileName}' not found`)
  }

  return fs.readFile(filePath, 'utf-8')
}
