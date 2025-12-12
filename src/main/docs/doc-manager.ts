/**
 * Documentation Manager
 *
 * Manages documentation generation sessions with AI agents.
 * Handles streaming responses, conversation continuity via --resume,
 * and broadcasts events to renderer.
 */

import { BrowserWindow } from 'electron'
import { writeFile } from 'fs/promises'
import type { AgentChatEvent, AgentProcess } from '@shared/types'
import { ClaudeCodeAdapter } from '../agents/adapters/claude-code'
import * as docSessionStore from '../storage/doc-session-store'

/**
 * Active documentation session info
 */
interface ActiveDocSession {
  sessionId: string
  process: AgentProcess
  streamingContent: string
  parseOutput: () => AsyncIterable<AgentChatEvent>
}

/**
 * Documentation manager class
 */
class DocManager {
  private activeSessions: Map<string, ActiveDocSession> = new Map()
  private adapter: ClaudeCodeAdapter

  constructor() {
    this.adapter = new ClaudeCodeAdapter()
  }

  /**
   * Ensure the adapter is ready
   */
  async ensureReady(): Promise<void> {
    await this.adapter.getExecutablePath()
  }

  /**
   * Check if there's an active session
   */
  isSessionActive(sessionId: string): boolean {
    return this.activeSessions.has(sessionId)
  }

  /**
   * Start generating documentation
   * Streams the response back via IPC events
   */
  async generateDoc(
    sessionId: string,
    prompt: string,
    workingDirectory: string
  ): Promise<void> {
    // Load the session
    const session = await docSessionStore.loadDocSession(sessionId)
    if (!session) {
      throw new Error(`Documentation session not found: ${sessionId}`)
    }

    // Check if there's already an active generation
    if (this.activeSessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already has an active generation`)
    }

    // Add system message to session
    await docSessionStore.addMessage(sessionId, 'system', prompt)

    // Update session status
    await docSessionStore.updateDocSession(sessionId, {
      status: 'generating'
    })

    // Start chat with the agent
    await this.ensureReady()

    const { process, parseOutput } = this.adapter.chat({
      message: prompt,
      workingDirectory,
      conversationId: session.conversationId
    })

    // Track active session
    const activeSession: ActiveDocSession = {
      sessionId,
      process,
      streamingContent: '',
      parseOutput
    }
    this.activeSessions.set(sessionId, activeSession)

    // Add empty assistant message for streaming
    const assistantMessage = await docSessionStore.addMessage(sessionId, 'assistant', '')
    if (!assistantMessage) {
      throw new Error('Failed to create assistant message')
    }

    // Broadcast that streaming started
    this.broadcastDocEvent('docs:streamStart', { sessionId })

    // Process the stream
    try {
      let conversationId: string | undefined

      for await (const event of parseOutput()) {
        if (event.type === 'text' && event.content) {
          activeSession.streamingContent += event.content

          // Update message in storage
          await docSessionStore.updateLastMessage(
            sessionId,
            activeSession.streamingContent,
            true
          )

          // Broadcast chunk
          this.broadcastDocEvent('docs:chunk', {
            sessionId,
            content: event.content,
            fullContent: activeSession.streamingContent
          })
        } else if (event.type === 'complete') {
          conversationId = event.conversationId

          // Finalize message
          await docSessionStore.updateLastMessage(
            sessionId,
            activeSession.streamingContent,
            false
          )

          // Save generated content
          await docSessionStore.updateGeneratedContent(
            sessionId,
            activeSession.streamingContent
          )

          // Save conversation ID for future turns
          if (conversationId) {
            await docSessionStore.setConversationId(sessionId, conversationId)
          }

          // Update status to reviewing
          await docSessionStore.updateDocSession(sessionId, {
            status: 'reviewing'
          })
        } else if (event.type === 'error') {
          this.broadcastDocEvent('docs:error', {
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
      const updatedSession = await docSessionStore.loadDocSession(sessionId)
      this.broadcastDocEvent('docs:complete', {
        sessionId,
        session: updatedSession
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[DocManager] Generation error:', errorMessage)

      // Update message with error indication
      await docSessionStore.updateLastMessage(
        sessionId,
        activeSession.streamingContent + '\n\n[Error: ' + errorMessage + ']',
        false
      )

      this.broadcastDocEvent('docs:error', {
        sessionId,
        error: errorMessage
      })
    } finally {
      // Clean up active session
      this.activeSessions.delete(sessionId)
    }
  }

  /**
   * Send a refinement message to modify the generated documentation
   */
  async sendRefinement(
    sessionId: string,
    message: string,
    workingDirectory: string
  ): Promise<void> {
    // Similar to generateDoc but for refinement messages
    const session = await docSessionStore.loadDocSession(sessionId)
    if (!session) {
      throw new Error(`Documentation session not found: ${sessionId}`)
    }

    if (this.activeSessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already has an active generation`)
    }

    // Add user message to session
    await docSessionStore.addMessage(sessionId, 'user', message)

    // Update session status to editing
    await docSessionStore.updateDocSession(sessionId, {
      status: 'editing'
    })

    // Build refinement prompt
    const refinementPrompt = `The current documentation is:\n\n\`\`\`markdown\n${session.editedContent}\n\`\`\`\n\nUser request: ${message}\n\nPlease provide the updated documentation incorporating the requested changes.`

    await this.ensureReady()

    const { process, parseOutput } = this.adapter.chat({
      message: refinementPrompt,
      workingDirectory,
      conversationId: session.conversationId
    })

    const activeSession: ActiveDocSession = {
      sessionId,
      process,
      streamingContent: '',
      parseOutput
    }
    this.activeSessions.set(sessionId, activeSession)

    const assistantMessage = await docSessionStore.addMessage(sessionId, 'assistant', '')
    if (!assistantMessage) {
      throw new Error('Failed to create assistant message')
    }

    this.broadcastDocEvent('docs:streamStart', { sessionId })

    try {
      let conversationId: string | undefined

      for await (const event of parseOutput()) {
        if (event.type === 'text' && event.content) {
          activeSession.streamingContent += event.content

          await docSessionStore.updateLastMessage(
            sessionId,
            activeSession.streamingContent,
            true
          )

          this.broadcastDocEvent('docs:chunk', {
            sessionId,
            content: event.content,
            fullContent: activeSession.streamingContent
          })
        } else if (event.type === 'complete') {
          conversationId = event.conversationId

          await docSessionStore.updateLastMessage(
            sessionId,
            activeSession.streamingContent,
            false
          )

          // Update edited content with the refinement
          await docSessionStore.updateEditedContent(
            sessionId,
            activeSession.streamingContent
          )

          if (conversationId) {
            await docSessionStore.setConversationId(sessionId, conversationId)
          }

          await docSessionStore.updateDocSession(sessionId, {
            status: 'reviewing'
          })
        } else if (event.type === 'error') {
          this.broadcastDocEvent('docs:error', {
            sessionId,
            error: event.error || 'Unknown error'
          })
        }

        if (event.conversationId && !conversationId) {
          conversationId = event.conversationId
        }
      }

      await process.wait()

      const updatedSession = await docSessionStore.loadDocSession(sessionId)
      this.broadcastDocEvent('docs:complete', {
        sessionId,
        session: updatedSession
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[DocManager] Refinement error:', errorMessage)

      await docSessionStore.updateLastMessage(
        sessionId,
        activeSession.streamingContent + '\n\n[Error: ' + errorMessage + ']',
        false
      )

      this.broadcastDocEvent('docs:error', {
        sessionId,
        error: errorMessage
      })
    } finally {
      this.activeSessions.delete(sessionId)
    }
  }

  /**
   * Commit the documentation to the project repository
   */
  async commitDoc(sessionId: string): Promise<void> {
    const session = await docSessionStore.loadDocSession(sessionId)
    if (!session) {
      throw new Error(`Documentation session not found: ${sessionId}`)
    }

    // Write the content to the target file
    try {
      await writeFile(session.targetPath, session.editedContent, 'utf-8')

      // Mark session as committed
      await docSessionStore.markCommitted(sessionId)

      // Broadcast success
      this.broadcastDocEvent('docs:committed', {
        sessionId,
        path: session.targetPath
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[DocManager] Error committing doc:', errorMessage)
      throw error
    }
  }

  /**
   * Cancel an active generation
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
      await docSessionStore.updateLastMessage(
        sessionId,
        activeSession.streamingContent + '\n\n[Cancelled]',
        false
      )
    }

    // Clean up
    this.activeSessions.delete(sessionId)

    this.broadcastDocEvent('docs:cancelled', { sessionId })

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
   * Broadcast a documentation event to all renderer windows
   */
  private broadcastDocEvent(channel: string, data: unknown): void {
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
export const docManager = new DocManager()
