/**
 * Prompt Formatter
 *
 * Uses AI to format voice-transcribed task prompts into structured markdown
 * with a representative title and clean formatting.
 */

import { spawn } from 'child_process'
import { ClaudeCodeAdapter } from './adapters/claude-code'

const adapter = new ClaudeCodeAdapter()

export interface FormattedPrompt {
  title: string
  content: string
}

/**
 * Format a voice-transcribed prompt into markdown with a title
 */
export async function formatVoicePrompt(rawPrompt: string): Promise<FormattedPrompt> {
  const execPath = await adapter.getExecutablePath()
  if (!execPath) {
    throw new Error('Claude Code CLI not found')
  }

  const prompt = `You are formatting a voice-transcribed task prompt for an AI coding assistant. Your job is to:

1. Generate a concise, descriptive title (5-10 words) that captures the main action/goal
2. Format the prompt into clean markdown that clearly describes the work to be done
3. Organize the content with appropriate sections if the prompt is complex (e.g., ## Requirements, ## Details)
4. Fix any grammar or clarity issues from voice transcription
5. Preserve all technical details and requirements

Raw voice transcription:
${rawPrompt}

Respond with ONLY a JSON object in this exact format (no other text):
{
  "title": "Your title here",
  "content": "# Your title here\\n\\nFormatted markdown content..."
}

The content should be complete markdown starting with the title as an H1, then the formatted description.`

  return new Promise((resolve, reject) => {
    const args = ['-p', '--output-format', 'json', '--dangerously-skip-permissions', prompt]

    const child = spawn(execPath, args, {
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

    // 30 second timeout (shorter than description generator)
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Prompt formatting timed out'))
    }, 30000)

    child.on('close', (code) => {
      clearTimeout(timeout)

      if (code !== 0) {
        reject(new Error(`Prompt formatting failed: ${stderr || 'Unknown error'}`))
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
              // The result should contain our JSON response
              const resultText = json.result.trim()

              // Try to parse the nested JSON (our formatted prompt object)
              try {
                const formatted = JSON.parse(resultText)
                if (formatted.title && formatted.content) {
                  resolve({
                    title: formatted.title,
                    content: formatted.content
                  })
                  return
                }
              } catch {
                // If we can't parse the nested JSON, try to extract from markdown
                const titleMatch = resultText.match(/^#\s+(.+)$/m)
                if (titleMatch) {
                  resolve({
                    title: titleMatch[1],
                    content: resultText
                  })
                  return
                }
              }
            }
          } catch {
            // Not valid JSON, continue
          }
        }

        // If no result found, fall back to original prompt
        reject(new Error('Failed to parse formatted prompt'))
      } catch (err) {
        reject(new Error(`Failed to parse formatting output: ${err}`))
      }
    })

    child.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`Process error: ${err.message}`))
    })
  })
}
