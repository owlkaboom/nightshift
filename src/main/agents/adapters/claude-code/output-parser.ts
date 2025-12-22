/**
 * Output Parser Module
 *
 * Handles parsing of Claude Code CLI stream-json output format.
 */

import type { AgentOutputEvent } from '@shared/types'

/**
 * Usage limit detection result
 */
export interface UsageLimitResult {
  isUsageLimit: boolean
  resetAt?: Date
}

/**
 * Detect rate limit errors (temporary, retry soon)
 */
export function detectRateLimit(output: string): boolean {
  const lower = output.toLowerCase()
  return (
    lower.includes('rate limit') ||
    lower.includes('rate_limit') ||
    lower.includes('429') ||
    lower.includes('too many requests') ||
    lower.includes('overloaded')
  )
}

/**
 * Detect usage limit errors (quota exceeded, need to wait longer)
 * These are different from rate limits - they indicate the user has
 * reached their API usage quota and need to wait for reset.
 */
export function detectUsageLimit(output: string): UsageLimitResult {
  const lower = output.toLowerCase()

  // Check for usage limit patterns
  const isUsageLimit =
    lower.includes('usage limit') ||
    lower.includes('usage_limit') ||
    lower.includes('quota exceeded') ||
    lower.includes('quota_exceeded') ||
    lower.includes('limit exceeded') ||
    lower.includes('daily limit') ||
    lower.includes('monthly limit') ||
    lower.includes('exceeded your') ||
    lower.includes('api limit') ||
    lower.includes('request limit reached') ||
    lower.includes('token limit') ||
    lower.includes('out of credits') ||
    lower.includes('billing')

  if (!isUsageLimit) {
    return { isUsageLimit: false }
  }

  // Try to extract reset time from the message
  let resetAt: Date | undefined

  // Pattern: "resets at HH:MM" or "resets at HH:MM:SS"
  const timeMatch = output.match(
    /(?:reset|available|try again)(?:\s+at)?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM))?)/i
  )
  if (timeMatch) {
    const today = new Date()
    const [hours, minutes] = timeMatch[1].split(':').map(Number)
    resetAt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes)
    // If the time is in the past, assume it's tomorrow
    if (resetAt < today) {
      resetAt.setDate(resetAt.getDate() + 1)
    }
  }

  // Pattern: "in X hours/minutes"
  const durationMatch = output.match(
    /(?:reset|available|try again)\s+in\s+(\d+)\s*(hour|minute|min|hr|h|m)s?/i
  )
  if (durationMatch && !resetAt) {
    const amount = parseInt(durationMatch[1], 10)
    const unit = durationMatch[2].toLowerCase()
    resetAt = new Date()
    if (unit.startsWith('h')) {
      resetAt.setHours(resetAt.getHours() + amount)
    } else {
      resetAt.setMinutes(resetAt.getMinutes() + amount)
    }
  }

  // Pattern: ISO timestamp
  const isoMatch = output.match(
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/i
  )
  if (isoMatch && !resetAt) {
    resetAt = new Date(isoMatch[1])
  }

  return { isUsageLimit: true, resetAt }
}

/**
 * Detect authentication errors in agent output
 */
export function detectAuthError(output: string): boolean {
  const lower = output.toLowerCase()
  return (
    lower.includes('unauthorized') ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('authentication failed') ||
    lower.includes('not authenticated') ||
    lower.includes('invalid token') ||
    lower.includes('token expired') ||
    lower.includes('please log in') ||
    lower.includes('please authenticate') ||
    lower.includes('login required') ||
    lower.includes('access denied') ||
    (lower.includes('oauth') && (lower.includes('error') || lower.includes('failed'))) ||
    (lower.includes('credential') && (lower.includes('invalid') || lower.includes('expired')))
  )
}

/**
 * Parse a single line of output
 * Returns the raw line as the message so it can be written directly to the log
 * The AgentLogViewer will parse the JSON for display
 */
export function parseLine(line: string): AgentOutputEvent | null {
  const timestamp = new Date()

  // Try to parse as JSON (Claude Code --print outputs JSON-lines)
  try {
    const json = JSON.parse(line)

    // Extract session_id if present
    const sessionId = json.session_id || undefined

    // Determine event type for internal routing, but preserve raw line as message
    if (json.type === 'error') {
      // Check if the error is a usage limit
      const errorMessage = json.error || json.message || line
      const usageLimitResult = detectUsageLimit(errorMessage)
      if (usageLimitResult.isUsageLimit) {
        return {
          type: 'usage-limit',
          message: line,
          timestamp,
          resetAt: usageLimitResult.resetAt,
          sessionId
        }
      }

      // Check if the error is a rate limit
      if (detectRateLimit(errorMessage)) {
        return {
          type: 'rate-limit',
          message: line,
          timestamp,
          sessionId
        }
      }

      return {
        type: 'error',
        message: line, // Keep raw JSON for log viewer
        timestamp,
        sessionId
      }
    } else if (json.type === 'result') {
      // Extract usage data from result event
      const usage = json.usage
        ? {
            inputTokens: json.usage.input_tokens || 0,
            outputTokens: json.usage.output_tokens || 0,
            cacheCreationInputTokens: json.usage.cache_creation_input_tokens || 0,
            cacheReadInputTokens: json.usage.cache_read_input_tokens || 0,
            costUsd: json.total_cost_usd || null
          }
        : undefined

      return {
        type: 'complete',
        message: line, // Keep raw JSON for log viewer
        timestamp,
        sessionId,
        usage
      }
    }

    // Default: treat as log, keep raw JSON line
    return {
      type: 'log',
      message: line,
      timestamp,
      sessionId
    }
  } catch {
    // Not JSON, treat as plain text
    // Check usage limit first (more specific)
    const usageLimitResult = detectUsageLimit(line)
    if (usageLimitResult.isUsageLimit) {
      return {
        type: 'usage-limit',
        message: line,
        timestamp,
        resetAt: usageLimitResult.resetAt
      }
    }

    if (detectRateLimit(line)) {
      return {
        type: 'rate-limit',
        message: line,
        timestamp
      }
    }

    if (line.toLowerCase().includes('error')) {
      return {
        type: 'error',
        message: line,
        timestamp
      }
    }

    return {
      type: 'log',
      message: line,
      timestamp
    }
  }
}

/**
 * Parse an output stream into events
 * Async generator that yields AgentOutputEvent for each line
 */
export async function* parseOutputStream(
  stream: NodeJS.ReadableStream
): AsyncIterable<AgentOutputEvent> {
  const decoder = new TextDecoder()
  let buffer = ''

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk as Buffer, { stream: true })

    // Process complete lines
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue

      const event = parseLine(line)
      if (event) {
        yield event
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    const event = parseLine(buffer)
    if (event) {
      yield event
    }
  }
}
