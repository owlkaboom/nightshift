/**
 * Planning Manager
 *
 * Manages chat sessions with AI agents for planning.
 * Handles streaming responses, conversation continuity via --resume,
 * and broadcasts events to renderer.
 */

import { BrowserWindow } from 'electron'
import type { AgentChatEvent, AgentProcess, ContextAttachment } from '@shared/types'
import { AGENT_IDS } from '@shared/types'
import { agentRegistry } from './registry'
import type { ClaudeCodeAdapter } from './adapters/claude-code'
import * as planningStore from '@main/storage/planning-store'
import { formatContextAttachmentsForAgent, loadContextAttachmentContent } from '@main/utils/context-loader'
import { processManager } from './process-manager'

/**
 * Active chat session info
 */
interface ActiveChatSession {
  sessionId: string
  process: AgentProcess
  streamingContent: string
  parseOutput: () => AsyncIterable<AgentChatEvent>
}

/**
 * Planning manager singleton
 */
class PlanningManager {
  private activeSessions: Map<string, ActiveChatSession> = new Map()

  /**
   * Get the Claude Code adapter from the registry
   * This ensures we use the same instance with custom path settings
   */
  private getAdapter(): ClaudeCodeAdapter {
    const adapter = agentRegistry.get(AGENT_IDS.CLAUDE_CODE)
    if (!adapter) {
      throw new Error('Claude Code adapter not found in registry')
    }
    return adapter as ClaudeCodeAdapter
  }

  /**
   * Ensure the adapter is ready
   */
  async ensureReady(): Promise<void> {
    await this.getAdapter().getExecutablePath()
  }

  /**
   * Check if there's an active chat for a session
   */
  isSessionActive(sessionId: string): boolean {
    return this.activeSessions.has(sessionId)
  }

  /**
   * Send a message in a planning session
   * Streams the response back via IPC events
   */
  async sendMessage(
    sessionId: string,
    message: string,
    workingDirectory: string,
    contextAttachments?: ContextAttachment[]
  ): Promise<void> {
    // Load the session
    const session = await planningStore.loadPlanningSession(sessionId)
    if (!session) {
      throw new Error(`Planning session not found: ${sessionId}`)
    }

    // Check if there's already an active chat
    if (this.activeSessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already has an active chat`)
    }

    // Add user message to session
    await planningStore.addMessage(sessionId, 'user', message, contextAttachments)
    // Note: We don't broadcast session update here because the renderer
    // already added the user message optimistically. Broadcasting the old
    // session object would overwrite the optimistic update.

    // Start chat with the agent
    await this.ensureReady()

    // For init sessions, prepend system prompt to the first message
    let effectiveMessage = message
    if (session.sessionType === 'init' && session.systemPrompt && session.messages.length <= 1) {
      effectiveMessage = `${session.systemPrompt}\n\n---\n\nUser: ${message}`
    } else if (session.sessionType === 'general' && session.messages.length <= 1) {
      // For general sessions, add file organization instructions on first message
      const planFileInstructions = `CRITICAL INSTRUCTION: Your primary goal in this planning session is to create a comprehensive plan document.

You MUST create a markdown plan file in the \`plans/\` directory at the project root. This is not optional - every planning session should result in a written plan file.

Plan File Requirements:
1. ALWAYS create your plan file in \`plans/\` directory (e.g., \`plans/feature-name.md\`, \`plans/architecture-redesign.md\`)
2. Use descriptive filenames that clearly indicate what the plan is for
3. Structure your plan with clear sections (Overview, Requirements, Implementation Steps, etc.)
4. Include actionable tasks that can be converted to work items
5. Write the plan file BEFORE ending the conversation

MULTI-FILE PLAN ORGANIZATION:
- Keep the main plan file concise and focused (aim for <300 lines)
- For complex plans with multiple phases or detailed sections, create a sub-directory structure
- Use the pattern: \`plans/[feature-name]/\` for sub-files
- Main file (\`plans/feature-name.md\`) should contain:
  * Executive summary and high-level overview
  * Overall requirements and goals
  * Links to detailed sub-files
  * Master task checklist
- Sub-files should contain detailed information organized by:
  * Implementation phases (\`phase-1-setup.md\`, \`phase-2-core.md\`, etc.)
  * Major components or modules (\`backend-changes.md\`, \`ui-updates.md\`)
  * Technical deep-dives (\`architecture-decisions.md\`, \`database-schema.md\`)
  * Testing strategies (\`testing-plan.md\`)

Example single-file plan structure (for simple features):
\`\`\`markdown
# [Feature/Project Name]

## Overview
[Brief description of what this plan accomplishes]

## Requirements
- [Requirement 1]
- [Requirement 2]

## Implementation Steps
1. [Step 1 with details]
2. [Step 2 with details]

## Technical Decisions
- [Key decision 1 and rationale]
- [Key decision 2 and rationale]

## Tasks
- [ ] [Concrete task 1]
- [ ] [Concrete task 2]
\`\`\`

Example multi-file plan structure (for complex features):
\`\`\`
plans/
├── user-authentication.md           # Main plan file (overview + links)
└── user-authentication/
    ├── phase-1-backend.md          # Backend implementation details
    ├── phase-2-frontend.md         # Frontend implementation details
    ├── phase-3-testing.md          # Testing strategy
    └── security-considerations.md   # Security analysis
\`\`\`

Main file (\`plans/user-authentication.md\`) example:
\`\`\`markdown
# User Authentication System

## Overview
High-level description of the authentication system.

## Plan Structure
This plan is organized into multiple documents:
- [Phase 1: Backend Implementation](./user-authentication/phase-1-backend.md)
- [Phase 2: Frontend Implementation](./user-authentication/phase-2-frontend.md)
- [Phase 3: Testing Strategy](./user-authentication/phase-3-testing.md)
- [Security Considerations](./user-authentication/security-considerations.md)

## High-Level Requirements
[Top-level requirements]

## Implementation Order
1. Phase 1: Backend (see detailed plan)
2. Phase 2: Frontend (see detailed plan)
3. Phase 3: Testing (see detailed plan)

## Master Task List
- [ ] Task from Phase 1
- [ ] Task from Phase 2
- [ ] Task from Phase 3
\`\`\`

Remember: The goal is to produce a written plan file (or plan file structure), not just a conversation. Use the Write tool to create your plan file(s) in the \`plans/\` directory. For complex plans, create a sub-directory to keep files organized and reduce context size.

---

User: ${message}`
      effectiveMessage = planFileInstructions
    } else if (session.sessionType === 'claude-md' && session.messages.length <= 1) {
      // For claude-md sessions, add context about improving CLAUDE.md
      const claudeMdInstructions = `You are helping improve the CLAUDE.md file for this project. The CLAUDE.md file provides important context and instructions for AI coding assistants working on the project.

Your role is to:
1. Review the current CLAUDE.md content (provided in context attachments)
2. Answer questions about the project structure and conventions
3. Suggest improvements to the CLAUDE.md to make it more helpful for AI assistants
4. Help iterate on specific sections that need enhancement
5. Ensure the CLAUDE.md follows best practices for AI-readable project documentation

Focus on making the CLAUDE.md clear, actionable, and helpful for AI coding assistants.

IMPORTANT FILE ORGANIZATION BEST PRACTICES:
- Keep the main CLAUDE.md file under 300 lines when possible
- For larger/complex projects, structure CLAUDE.md as an INDEX that links to focused documentation files in .claude/docs/
- Recommend moving detailed sections to separate files in .claude/docs/ (e.g., .claude/docs/ARCHITECTURE.md, .claude/docs/API.md, .claude/docs/TESTING.md)
- Each documentation file should focus on a specific domain (architecture, API, database, deployment, etc.)
- The main CLAUDE.md should contain:
  * High-level project overview
  * Quick start commands
  * Links/references to detailed documentation in .claude/docs/
  * Critical conventions that apply across the entire project
- Suggest creating separate focused files as the project grows rather than expanding CLAUDE.md indefinitely

When reviewing the CLAUDE.md, if it's approaching or exceeding 300 lines, proactively suggest reorganizing it into an index file with links to separate focused documentation files.

---

User: ${message}`
      effectiveMessage = claudeMdInstructions
    }

    // Add context attachments to the message
    const allContextAttachments = [
      ...(session.contextAttachments || []),
      ...(contextAttachments || [])
    ]

    if (allContextAttachments.length > 0) {
      // Load content for all attachments
      const loadedAttachments: ContextAttachment[] = []
      for (const attachment of allContextAttachments) {
        try {
          const loaded = await loadContextAttachmentContent(attachment)
          if (loaded.content) {
            loadedAttachments.push(loaded)
          }
        } catch (error) {
          console.warn('[PlanningManager] Failed to load context attachment:', error)
        }
      }

      // Format and append to message
      if (loadedAttachments.length > 0) {
        const contextFormatted = formatContextAttachmentsForAgent(loadedAttachments)
        effectiveMessage += contextFormatted
      }
    }

    const { process, parseOutput } = this.getAdapter().chat({
      message: effectiveMessage,
      workingDirectory,
      conversationId: session.conversationId
    })

    // Track active session
    const activeSession: ActiveChatSession = {
      sessionId,
      process,
      streamingContent: '',
      parseOutput
    }
    this.activeSessions.set(sessionId, activeSession)

    // Register with process manager
    processManager.registerChatSession(
      sessionId,
      session.projectId,
      process,
      AGENT_IDS.CLAUDE_CODE,
      session.sessionType,
      session.messages.length
    )

    // Add empty assistant message for streaming
    const assistantMessage = await planningStore.addMessage(sessionId, 'assistant', '')
    if (!assistantMessage) {
      throw new Error('Failed to create assistant message')
    }

    // Broadcast that streaming started
    this.broadcastPlanningEvent('planning:streamStart', { sessionId })

    // Process the stream
    try {
      let conversationId: string | undefined

      for await (const event of parseOutput()) {
        if (event.type === 'text' && event.content) {
          activeSession.streamingContent += event.content

          // Update process manager with streaming length
          processManager.updateChatStreamingLength(sessionId, activeSession.streamingContent.length)

          // Update message in storage
          await planningStore.updateLastMessage(
            sessionId,
            activeSession.streamingContent,
            true
          )

          // Broadcast chunk
          this.broadcastPlanningEvent('planning:chunk', {
            sessionId,
            content: event.content,
            fullContent: activeSession.streamingContent
          })
        } else if (event.type === 'tool_use' && event.tool) {
          // Extract a human-readable target from the tool input
          const target = this.extractToolTarget(event.tool, event.toolInput)

          // Broadcast activity
          this.broadcastPlanningEvent('planning:activity', {
            sessionId,
            tool: event.tool,
            target
          })
        } else if (event.type === 'complete') {
          conversationId = event.conversationId

          // Finalize message
          await planningStore.updateLastMessage(
            sessionId,
            activeSession.streamingContent,
            false
          )

          // Save conversation ID for future turns
          if (conversationId) {
            await planningStore.setConversationId(sessionId, conversationId)
          }
        } else if (event.type === 'error') {
          this.broadcastPlanningEvent('planning:error', {
            sessionId,
            error: event.error || 'Unknown error'
          })
        }

        // Track conversation ID
        if (event.conversationId && !conversationId) {
          conversationId = event.conversationId
        }
      }

      // Wait for process to complete
      await process.wait()

      // Mark as completed in process manager
      processManager.completeChatSession(sessionId)

      // Broadcast completion
      const updatedSession = await planningStore.loadPlanningSession(sessionId)
      this.broadcastPlanningEvent('planning:complete', {
        sessionId,
        session: updatedSession
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[PlanningManager] Chat error:', errorMessage)

      // Mark as failed in process manager
      processManager.failChatSession(sessionId, errorMessage)

      // Update message with error indication
      await planningStore.updateLastMessage(
        sessionId,
        activeSession.streamingContent + '\n\n[Error: ' + errorMessage + ']',
        false
      )

      this.broadcastPlanningEvent('planning:error', {
        sessionId,
        error: errorMessage
      })
    } finally {
      // Clean up active session
      this.activeSessions.delete(sessionId)
      // Note: We keep it in process manager for the "Recent" section
    }
  }

  /**
   * Cancel an active chat session
   */
  async cancelResponse(sessionId: string): Promise<boolean> {
    const activeSession = this.activeSessions.get(sessionId)
    if (!activeSession) {
      return false
    }

    // Kill the process
    activeSession.process.kill()

    // Mark as cancelled in process manager
    processManager.cancelChatSession(sessionId)

    // Finalize the message with what we have
    if (activeSession.streamingContent) {
      await planningStore.updateLastMessage(
        sessionId,
        activeSession.streamingContent + '\n\n[Cancelled]',
        false
      )
    }

    // Clean up
    this.activeSessions.delete(sessionId)

    this.broadcastPlanningEvent('planning:cancelled', { sessionId })

    return true
  }

  /**
   * Interrupt an active chat session and send a new message
   * This kills the current response and starts a new one
   */
  async interruptAndSendMessage(
    sessionId: string,
    message: string,
    workingDirectory: string,
    contextAttachments?: ContextAttachment[]
  ): Promise<void> {
    const activeSession = this.activeSessions.get(sessionId)

    // If there's an active session, interrupt it
    if (activeSession) {
      // Kill the process
      activeSession.process.kill()

      // Mark as cancelled in process manager
      processManager.cancelChatSession(sessionId)

      // Finalize the message with what we have so far
      if (activeSession.streamingContent) {
        await planningStore.updateLastMessage(
          sessionId,
          activeSession.streamingContent + '\n\n[Interrupted]',
          false
        )
      }

      // Clean up the active session
      this.activeSessions.delete(sessionId)
    }

    // Now send the new message (will use --resume to continue conversation)
    await this.sendMessage(sessionId, message, workingDirectory, contextAttachments)
  }

  /**
   * Get streaming content for a session
   */
  getStreamingContent(sessionId: string): string | null {
    const session = this.activeSessions.get(sessionId)
    return session ? session.streamingContent : null
  }

  /**
   * Extract a human-readable target from tool input
   */
  private extractToolTarget(tool: string, toolInput?: Record<string, unknown>): string {
    if (!toolInput) return ''

    // Common patterns for different tools
    switch (tool) {
      case 'Read':
      case 'Edit':
      case 'Write':
        return (toolInput.file_path as string) || ''
      case 'Bash':
        return (toolInput.command as string) || ''
      case 'Grep':
        return `"${toolInput.pattern || ''}" in ${toolInput.path || '.'}`
      case 'Glob':
        return (toolInput.pattern as string) || ''
      case 'LSP':
        return `${toolInput.operation || ''} at ${toolInput.filePath || ''}:${toolInput.line || ''}:${toolInput.character || ''}`
      case 'WebFetch':
        return (toolInput.url as string) || ''
      case 'Task':
        return (toolInput.description as string) || ''
      default:
        // For unknown tools, try common field names
        return (
          (toolInput.file_path as string) ||
          (toolInput.path as string) ||
          (toolInput.command as string) ||
          (toolInput.pattern as string) ||
          ''
        )
    }
  }

  /**
   * Broadcast a planning event to all renderer windows
   */
  private broadcastPlanningEvent(channel: string, data: unknown): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }
  }

}

/**
 * Singleton instance
 */
export const planningManager = new PlanningManager()
