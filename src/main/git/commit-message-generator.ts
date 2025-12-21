/**
 * Commit Message Generator
 *
 * Uses Claude (via Claude Code CLI) to generate commit messages from staged changes.
 * Analyzes diffs and recent commits to generate contextually appropriate messages.
 */

import { spawn } from 'child_process'
import { ClaudeCodeAdapter } from '../agents/adapters/claude-code'
import { getDiff, getRecentCommits } from './git-operations'
import type { CommitInfo } from '@shared/types'

const adapter = new ClaudeCodeAdapter()

/**
 * Maximum diff size to send to Claude (in characters)
 * Large diffs get truncated to avoid context limits
 */
const MAX_DIFF_SIZE = 50000

/**
 * Build a prompt for commit message generation
 */
function buildCommitPrompt(diff: string, recentCommits: CommitInfo[]): string {
  // Truncate diff if too large
  let truncatedDiff = diff
  let wasTruncated = false
  if (diff.length > MAX_DIFF_SIZE) {
    truncatedDiff = diff.substring(0, MAX_DIFF_SIZE)
    wasTruncated = true
  }

  // Build commit style reference from recent commits
  const recentCommitsContext = recentCommits.length > 0
    ? `Here are recent commits for style reference:\n${recentCommits.map((c) => `- ${c.message}`).join('\n')}`
    : ''

  return `Generate a concise git commit message for the following changes.

${recentCommitsContext}

Guidelines:
1. Start with a type prefix if the repo uses conventional commits (feat:, fix:, docs:, style:, refactor:, test:, chore:)
2. Keep the subject line under 72 characters
3. Use imperative mood ("Add feature" not "Added feature")
4. Explain WHAT changed and WHY (not HOW)
5. Match the style of recent commits if applicable
${wasTruncated ? '6. Note: The diff was truncated due to size; focus on the visible changes' : ''}

Changes:
\`\`\`diff
${truncatedDiff}
\`\`\`

Return ONLY the commit message text. No explanation, no quotes, no formatting - just the message itself.`
}

/**
 * Generate a commit message for staged changes using AI
 */
export async function generateCommitMessage(repoPath: string): Promise<string> {
  // Get staged diff
  const diff = await getDiff(repoPath, { staged: true })

  if (!diff.trim()) {
    throw new Error('No staged changes to generate a commit message for')
  }

  // Get recent commits for style reference
  const recentCommits = await getRecentCommits(repoPath, 5)

  const execPath = await adapter.getExecutablePath()
  if (!execPath) {
    throw new Error('Claude Code CLI not found')
  }

  const prompt = buildCommitPrompt(diff, recentCommits)

  return new Promise((resolve, reject) => {
    // Use Claude Haiku for fast, cost-effective generation
    const args = [
      '-p',
      '--output-format', 'json',
      '--dangerously-skip-permissions',
      '--model', 'claude-haiku-3-5-sonnet-latest', // Fast model for commit messages
      prompt
    ]

    const child = spawn(execPath, args, {
      cwd: repoPath,
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

    // 30 second timeout - commit messages should be fast
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Commit message generation timed out'))
    }, 30000)

    child.on('close', (code) => {
      clearTimeout(timeout)

      if (code !== 0) {
        reject(new Error(`Commit message generation failed: ${stderr || 'Unknown error'}`))
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
              // Clean up the result
              let message = json.result.trim()
              // Remove surrounding quotes if present
              if ((message.startsWith('"') && message.endsWith('"')) ||
                  (message.startsWith("'") && message.endsWith("'"))) {
                message = message.slice(1, -1)
              }
              resolve(message)
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
          reject(new Error('No commit message generated'))
        }
      } catch (err) {
        reject(new Error(`Failed to parse commit message: ${err}`))
      }
    })

    child.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`Process error: ${err.message}`))
    })
  })
}

/**
 * Generate a commit message with a custom prompt/context
 */
export async function generateCommitMessageWithContext(
  repoPath: string,
  additionalContext: string
): Promise<string> {
  // Get staged diff
  const diff = await getDiff(repoPath, { staged: true })

  if (!diff.trim()) {
    throw new Error('No staged changes to generate a commit message for')
  }

  const execPath = await adapter.getExecutablePath()
  if (!execPath) {
    throw new Error('Claude Code CLI not found')
  }

  // Build custom prompt with additional context
  const prompt = `Generate a concise git commit message for these changes.

Additional context from the user:
${additionalContext}

Guidelines:
1. Use conventional commits format if appropriate (feat:, fix:, docs:, etc.)
2. Keep the subject line under 72 characters
3. Use imperative mood ("Add feature" not "Added feature")

Changes:
\`\`\`diff
${diff.substring(0, MAX_DIFF_SIZE)}
\`\`\`

Return ONLY the commit message text.`

  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--output-format', 'json',
      '--dangerously-skip-permissions',
      '--model', 'claude-haiku-3-5-sonnet-latest',
      prompt
    ]

    const child = spawn(execPath, args, {
      cwd: repoPath,
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

    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Commit message generation timed out'))
    }, 30000)

    child.on('close', (code) => {
      clearTimeout(timeout)

      if (code !== 0) {
        reject(new Error(`Commit message generation failed: ${stderr || 'Unknown error'}`))
        return
      }

      try {
        const lines = stdout.split('\n').filter((line) => line.trim())
        for (const line of lines) {
          try {
            const json = JSON.parse(line)
            if (json.type === 'result' && json.result) {
              let message = json.result.trim()
              if ((message.startsWith('"') && message.endsWith('"')) ||
                  (message.startsWith("'") && message.endsWith("'"))) {
                message = message.slice(1, -1)
              }
              resolve(message)
              return
            }
          } catch {
            // Continue
          }
        }

        const plainText = stdout.trim()
        if (plainText) {
          resolve(plainText)
        } else {
          reject(new Error('No commit message generated'))
        }
      } catch (err) {
        reject(new Error(`Failed to parse commit message: ${err}`))
      }
    })

    child.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`Process error: ${err.message}`))
    })
  })
}
