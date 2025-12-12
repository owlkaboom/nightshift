/**
 * Description Generator
 *
 * Uses AI to generate descriptions for projects and groups based on their content.
 * This helps provide context to the agent when working with group-targeted tasks.
 */

import { spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import type { Project } from '@shared/types'
import { ClaudeCodeAdapter } from './adapters/claude-code'
import { getProjectPath } from '../storage'

const adapter = new ClaudeCodeAdapter()

/**
 * Gather context from a project directory for description generation
 */
async function gatherProjectContext(projectPath: string): Promise<string> {
  const contextParts: string[] = []

  // Read README if exists (first 500 lines)
  const readmeNames = ['README.md', 'README.rst', 'README.txt', 'README']
  for (const readmeName of readmeNames) {
    const readmePath = join(projectPath, readmeName)
    if (existsSync(readmePath)) {
      try {
        const content = readFileSync(readmePath, 'utf-8')
        const lines = content.split('\n').slice(0, 100) // First 100 lines
        contextParts.push(`## README\n${lines.join('\n')}`)
      } catch {
        // Ignore read errors
      }
      break
    }
  }

  // Read package.json if exists
  const packageJsonPath = join(projectPath, 'package.json')
  if (existsSync(packageJsonPath)) {
    try {
      const content = readFileSync(packageJsonPath, 'utf-8')
      const pkg = JSON.parse(content)
      contextParts.push(`## package.json
Name: ${pkg.name || 'N/A'}
Description: ${pkg.description || 'N/A'}
Main dependencies: ${Object.keys(pkg.dependencies || {}).slice(0, 10).join(', ')}`)
    } catch {
      // Ignore parse errors
    }
  }

  // Read CLAUDE.md if exists
  const claudeMdPath = join(projectPath, 'CLAUDE.md')
  if (existsSync(claudeMdPath)) {
    try {
      const content = readFileSync(claudeMdPath, 'utf-8')
      const lines = content.split('\n').slice(0, 50) // First 50 lines
      contextParts.push(`## CLAUDE.md\n${lines.join('\n')}`)
    } catch {
      // Ignore read errors
    }
  }

  // Get top-level directory structure
  try {
    const entries = await readdir(projectPath)
    const dirInfo: string[] = []

    for (const entry of entries.slice(0, 30)) {
      // Limit to 30 entries
      if (entry.startsWith('.')) continue // Skip hidden files
      try {
        const entryPath = join(projectPath, entry)
        const entryStat = await stat(entryPath)
        dirInfo.push(`${entry}${entryStat.isDirectory() ? '/' : ''}`)
      } catch {
        // Ignore stat errors
      }
    }

    if (dirInfo.length > 0) {
      contextParts.push(`## Directory Structure\n${dirInfo.join('\n')}`)
    }
  } catch {
    // Ignore readdir errors
  }

  return contextParts.join('\n\n')
}

/**
 * Generate a description for a project using AI
 */
export async function generateProjectDescription(project: Project): Promise<string> {
  const projectPath = await getProjectPath(project.id)
  if (!projectPath) {
    throw new Error(`Project ${project.id} has no local path configured`)
  }

  const execPath = await adapter.getExecutablePath()
  if (!execPath) {
    throw new Error('Claude Code CLI not found')
  }

  const context = await gatherProjectContext(projectPath)

  const prompt = `Analyze this project and write a concise 1-2 sentence description that captures its purpose and main technologies. Focus on what the project DOES, not implementation details.

${context}

Write only the description, no preamble, no quotes, no explanation. Just the description itself.`

  return new Promise((resolve, reject) => {
    const args = ['-p', '--output-format', 'json', '--dangerously-skip-permissions', prompt]

    const child = spawn(execPath, args, {
      cwd: projectPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CI: 'true',
        TERM: 'dumb'
      }
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.stdin?.end()

    // 60 second timeout
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Description generation timed out'))
    }, 60000)

    child.on('close', (code) => {
      clearTimeout(timeout)

      if (code !== 0) {
        reject(new Error(`Description generation failed: ${stderr || 'Unknown error'}`))
        return
      }

      // Parse the output - Claude Code outputs JSON
      try {
        // Find the result JSON line
        const lines = stdout.split('\n').filter((line) => line.trim())
        for (const line of lines) {
          try {
            const json = JSON.parse(line)
            if (json.type === 'result' && json.result) {
              // Extract text content from the result
              const description = json.result.trim()
              resolve(description)
              return
            }
          } catch {
            // Not valid JSON, continue
          }
        }

        // If no result found, try to extract any text
        const plainText = stdout.trim()
        if (plainText) {
          resolve(plainText)
        } else {
          reject(new Error('No description generated'))
        }
      } catch (err) {
        reject(new Error(`Failed to parse description: ${err}`))
      }
    })

    child.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`Process error: ${err.message}`))
    })
  })
}

// Group description generation removed - groups migrated to tags
// Tags are simpler and don't need generated descriptions
