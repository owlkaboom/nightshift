/**
 * Retry Context Generator
 *
 * Generates context-aware retry prompts for failed tasks by analyzing
 * execution logs to understand what was attempted before the failure.
 */

import type { TaskManifest } from '@shared/types'
import { readIterationLog } from '@main/storage'

interface ParsedLogEntry {
  type: 'assistant' | 'tool' | 'result' | 'system' | 'unknown'
  content: string
  toolName?: string
  toolInput?: string
  isError?: boolean
}

interface RetryContextResult {
  /** The generated retry prompt with context */
  prompt: string
  /** Summary of what was attempted */
  summary: string
  /** Number of actions that were taken */
  actionCount: number
  /** Whether any meaningful progress was made */
  hasProgress: boolean
}

/**
 * Parse execution logs into structured entries
 */
function parseLogs(logs: string): ParsedLogEntry[] {
  const entries: ParsedLogEntry[] = []
  const lines = logs.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    try {
      const json = JSON.parse(trimmed)
      const entry = parseJsonEntry(json)
      if (entry) {
        entries.push(entry)
      }
    } catch {
      // Not JSON, skip raw text lines
    }
  }

  return entries
}

/**
 * Parse a single JSON log entry
 */
function parseJsonEntry(json: Record<string, unknown>): ParsedLogEntry | null {
  const type = json.type as string

  switch (type) {
    case 'assistant': {
      const message = json.message as Record<string, unknown>
      const content = message?.content as Array<{
        type: string
        text?: string
        name?: string
        input?: unknown
      }> | undefined

      if (!content || !Array.isArray(content)) return null

      // Extract text content
      const textParts: string[] = []
      const toolUses: { name: string; input: string }[] = []

      for (const block of content) {
        if (block.type === 'text' && block.text) {
          textParts.push(block.text)
        } else if (block.type === 'tool_use' && block.name) {
          toolUses.push({
            name: block.name,
            input: formatToolInput(block.input)
          })
        }
      }

      // If there are tool uses, return the first one
      if (toolUses.length > 0) {
        return {
          type: 'tool',
          content: textParts.join('\n'),
          toolName: toolUses[0].name,
          toolInput: toolUses[0].input
        }
      }

      // Otherwise return text content
      if (textParts.length > 0) {
        return {
          type: 'assistant',
          content: textParts.join('\n')
        }
      }

      return null
    }

    case 'result': {
      const isError = json.is_error === true
      const result = json.result as string | undefined
      return {
        type: 'result',
        content: result || '',
        isError
      }
    }

    case 'system': {
      return {
        type: 'system',
        content: ''
      }
    }

    default:
      return null
  }
}

/**
 * Format tool input for display
 */
function formatToolInput(input: unknown): string {
  if (!input) return ''
  if (typeof input === 'string') return input

  const obj = input as Record<string, unknown>

  if (obj.file_path) return String(obj.file_path)
  if (obj.command) return String(obj.command)
  if (obj.pattern && obj.path) return `${obj.pattern} in ${obj.path}`
  if (obj.pattern) return String(obj.pattern)
  if (obj.query) return String(obj.query)
  if (obj.url) return String(obj.url)

  return JSON.stringify(input).slice(0, 100)
}

/**
 * Summarize the actions taken from parsed log entries
 */
function summarizeActions(entries: ParsedLogEntry[]): string[] {
  const actions: string[] = []

  for (const entry of entries) {
    if (entry.type === 'tool' && entry.toolName) {
      const action = formatAction(entry.toolName, entry.toolInput)
      if (action) {
        actions.push(action)
      }
    }
  }

  return actions
}

/**
 * Format a single action for the summary
 */
function formatAction(toolName: string, input?: string): string | null {
  switch (toolName.toLowerCase()) {
    case 'read':
      return input ? `Read file: ${input}` : 'Read a file'
    case 'edit':
      return input ? `Edited file: ${input}` : 'Edited a file'
    case 'write':
      return input ? `Wrote file: ${input}` : 'Wrote a file'
    case 'bash':
      return input ? `Ran command: ${input.slice(0, 60)}${input.length > 60 ? '...' : ''}` : 'Ran a command'
    case 'grep':
      return input ? `Searched for: ${input}` : 'Searched code'
    case 'glob':
      return input ? `Found files matching: ${input}` : 'Found files'
    case 'webfetch':
    case 'websearch':
      return input ? `Fetched: ${input}` : 'Fetched web content'
    case 'todowrite':
      return 'Updated task list'
    case 'task':
      return 'Launched a sub-task'
    default:
      return `Used ${toolName}${input ? `: ${input.slice(0, 40)}` : ''}`
  }
}

/**
 * Extract the last assistant message that describes intent or progress
 */
function getLastAssistantContext(entries: ParsedLogEntry[]): string | null {
  // Look for the last substantial assistant message
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]
    if (entry.type === 'assistant' && entry.content) {
      const content = entry.content.trim()
      // Skip very short messages or ones that are just tool announcements
      if (content.length > 50 && !content.startsWith('I\'ll use') && !content.startsWith('Let me')) {
        return content.slice(0, 500)
      }
    }
  }
  return null
}

/**
 * Generate a retry context from task logs
 */
export async function generateRetryContext(
  task: TaskManifest,
  iteration?: number
): Promise<RetryContextResult> {
  const targetIteration = iteration ?? task.currentIteration ?? 1

  // Read the logs for this iteration
  const logs = await readIterationLog(task.projectId, task.id, targetIteration)

  if (!logs || logs.trim() === '') {
    // No logs available - just retry with original prompt
    return {
      prompt: task.prompt,
      summary: 'No execution logs available',
      actionCount: 0,
      hasProgress: false
    }
  }

  // Parse the logs
  const entries = parseLogs(logs)
  const actions = summarizeActions(entries)
  const lastContext = getLastAssistantContext(entries)

  // Determine failure reason from task or logs
  let failureReason = task.errorMessage || 'Unknown error'

  // Check if it looks like a timeout/interruption
  const isInterruption = failureReason.includes('timed out') ||
    failureReason.includes('timeout') ||
    failureReason.includes('maximum duration') ||
    failureReason.includes('Process reference lost') ||
    failureReason.includes('interrupted') ||
    failureReason.includes('signal')

  // Build the retry prompt
  const promptParts: string[] = []

  // Add context header
  if (isInterruption) {
    promptParts.push('# Continuation of Interrupted Task')
    promptParts.push('')
    promptParts.push('This task was interrupted before completion (likely due to timeout, system sleep, or network issues). Please continue from where you left off.')
  } else {
    promptParts.push('# Retry with Context')
    promptParts.push('')
    promptParts.push(`This task previously failed with error: ${failureReason}`)
    promptParts.push('')
    promptParts.push('Please review what was attempted and try again, addressing any issues.')
  }

  // Add what was accomplished
  if (actions.length > 0) {
    promptParts.push('')
    promptParts.push('## What Was Already Done')
    promptParts.push('')
    // Limit to last 15 actions to avoid prompt bloat
    const recentActions = actions.slice(-15)
    if (actions.length > 15) {
      promptParts.push(`(Showing last 15 of ${actions.length} actions)`)
    }
    for (const action of recentActions) {
      promptParts.push(`- ${action}`)
    }
  }

  // Add last context if meaningful
  if (lastContext) {
    promptParts.push('')
    promptParts.push('## Last Known Progress')
    promptParts.push('')
    promptParts.push(lastContext)
  }

  // Add the original prompt
  promptParts.push('')
  promptParts.push('## Original Task')
  promptParts.push('')
  promptParts.push(task.prompt)

  // Add continuation instructions
  promptParts.push('')
  promptParts.push('---')
  if (isInterruption) {
    promptParts.push('')
    promptParts.push('Please continue this task from where it left off. Do not repeat work that was already completed successfully. Focus on completing the remaining work.')
  } else {
    promptParts.push('')
    promptParts.push('Please attempt this task again, taking into account what was previously tried. If the same approach keeps failing, consider an alternative approach.')
  }

  return {
    prompt: promptParts.join('\n'),
    summary: actions.length > 0
      ? `${actions.length} actions were taken before ${isInterruption ? 'interruption' : 'failure'}`
      : 'Task failed before any significant progress',
    actionCount: actions.length,
    hasProgress: actions.length > 0
  }
}
