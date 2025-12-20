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
      const planFileInstructions = `IMPORTANT: If you create any planning documents or markdown files during this session, always place them in a \`plans/\` directory in the project root. For example:
- \`plans/architecture.md\`
- \`plans/implementation-plan.md\`
- \`plans/feature-spec.md\`

---

User: ${message}`
      effectiveMessage = planFileInstructions
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

      // Broadcast completion
      const updatedSession = await planningStore.loadPlanningSession(sessionId)
      this.broadcastPlanningEvent('planning:complete', {
        sessionId,
        session: updatedSession
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[PlanningManager] Chat error:', errorMessage)

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
   * Get streaming content for a session
   */
  getStreamingContent(sessionId: string): string | null {
    const session = this.activeSessions.get(sessionId)
    return session ? session.streamingContent : null
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
