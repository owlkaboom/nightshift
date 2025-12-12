/**
 * Project Suggester
 *
 * Uses AI to suggest the most appropriate project for a task prompt
 * when working with a group of projects.
 */

import { spawn } from 'child_process'
import type { Project } from '@shared/types'
import { ClaudeCodeAdapter } from './adapters/claude-code'
import { getProjectsByGroup } from '../storage'
import { quoteExecutablePath } from '../utils/paths'
import { platform } from 'os'

const adapter = new ClaudeCodeAdapter()

/**
 * Suggest the most appropriate project for a task prompt
 * when targeting a group of projects
 */
export async function suggestProjectForPrompt(
  groupId: string,
  prompt: string
): Promise<string | null> {
  const projects = await getProjectsByGroup(groupId)

  if (projects.length === 0) {
    return null
  }

  // If only one project, return it
  if (projects.length === 1) {
    return projects[0].id
  }

  const execPath = await adapter.getExecutablePath()
  if (!execPath) {
    // Fallback: return first project
    console.warn('[ProjectSuggester] Claude Code CLI not found, returning first project')
    return projects[0].id
  }

  const projectSummaries = projects
    .map((p) => `- ${p.name}: ${p.description || 'No description available'}`)
    .join('\n')

  const suggestionPrompt = `Given this task prompt:
"${prompt.slice(0, 500)}${prompt.length > 500 ? '...' : ''}"

And these projects in the group:
${projectSummaries}

Which project is most likely the target for this task?
Respond with ONLY the exact project name (nothing else, no quotes, no explanation).`

  // Use a simple directory for the command
  const workingDir = process.cwd()

  return new Promise((resolve) => {
    const args = ['-p', '--output-format', 'json', '--dangerously-skip-permissions', suggestionPrompt]

    // On Windows, use shell mode for proper executable resolution
    const isWindows = platform() === 'win32'

    // Quote the executable path if using shell mode (handles spaces in path)
    const spawnPath = isWindows ? quoteExecutablePath(execPath) : execPath

    const child = spawn(spawnPath, args, {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWindows,
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

    // 30 second timeout
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      console.warn('[ProjectSuggester] Timeout, returning first project')
      resolve(projects[0].id)
    }, 30000)

    child.on('close', (code) => {
      clearTimeout(timeout)

      if (code !== 0) {
        console.warn('[ProjectSuggester] Failed:', stderr)
        resolve(projects[0].id)
        return
      }

      // Parse the output
      try {
        const lines = stdout.split('\n').filter((line) => line.trim())
        for (const line of lines) {
          try {
            const json = JSON.parse(line)
            if (json.type === 'result' && json.result) {
              const suggestedName = json.result.trim()
              const matchedProject = findProjectByName(projects, suggestedName)
              if (matchedProject) {
                resolve(matchedProject.id)
                return
              }
            }
          } catch {
            // Not valid JSON, continue
          }
        }

        // Try to match from raw output
        const plainText = stdout.trim()
        if (plainText) {
          const matchedProject = findProjectByName(projects, plainText)
          if (matchedProject) {
            resolve(matchedProject.id)
            return
          }
        }

        // Fallback to first project
        resolve(projects[0].id)
      } catch {
        resolve(projects[0].id)
      }
    })

    child.on('error', () => {
      clearTimeout(timeout)
      resolve(projects[0].id)
    })
  })
}

/**
 * Find a project by name (case-insensitive, partial match)
 */
function findProjectByName(projects: Project[], name: string): Project | null {
  const normalizedName = name.toLowerCase().trim()

  // Exact match first
  for (const project of projects) {
    if (project.name.toLowerCase() === normalizedName) {
      return project
    }
  }

  // Contains match
  for (const project of projects) {
    if (
      normalizedName.includes(project.name.toLowerCase()) ||
      project.name.toLowerCase().includes(normalizedName)
    ) {
      return project
    }
  }

  return null
}
