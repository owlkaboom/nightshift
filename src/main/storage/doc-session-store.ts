/**
 * Documentation session storage for ~/.nightshift/docs/<session-id>/session.json
 *
 * Similar to planning sessions, documentation sessions enable
 * interactive AI-assisted documentation generation with refinement.
 */

import { readdir, rm } from 'fs/promises'
import type {
  DocSession,
  DocSessionMessage,
  DocMessageRole,
  CreateDocSessionData,
  DocumentationType
} from '@shared/types'
import {
  createDocSession,
  createDocMessage,
  getDocumentationTypeLabel
} from '@shared/types'
import {
  getDocsDir,
  getDocSessionDir,
  getDocSessionPath
} from '../utils/paths'
import { readJson, writeJson, ensureDir, fileExists } from './file-store'

/**
 * Load a documentation session by ID
 */
export async function loadDocSession(
  sessionId: string
): Promise<DocSession | null> {
  const path = getDocSessionPath(sessionId)
  return readJson(path)
}

/**
 * Save a documentation session
 */
export async function saveDocSession(session: DocSession): Promise<void> {
  const path = getDocSessionPath(session.id)
  await writeJson(path, session)
}

/**
 * Create a new documentation session
 */
export async function createSession(
  data: CreateDocSessionData,
  agentId: string,
  targetPath: string
): Promise<DocSession> {
  const session = createDocSession(
    data.projectId,
    data.type,
    agentId,
    targetPath,
    {
      isUpdate: data.updateExisting || false
    }
  )

  // Set title based on documentation type
  session.title = `Generate ${getDocumentationTypeLabel(data.type)}`

  await saveDocSession(session)
  return session
}

/**
 * Update a documentation session
 */
export async function updateDocSession(
  sessionId: string,
  updates: Partial<Omit<DocSession, 'id' | 'createdAt'>>
): Promise<DocSession | null> {
  const session = await loadDocSession(sessionId)
  if (!session) return null

  const updated: DocSession = {
    ...session,
    ...updates,
    updatedAt: new Date().toISOString()
  }
  await saveDocSession(updated)
  return updated
}

/**
 * Delete a documentation session
 */
export async function deleteDocSession(sessionId: string): Promise<boolean> {
  const sessionDir = getDocSessionDir(sessionId)

  if (!(await fileExists(sessionDir))) {
    return false
  }

  await rm(sessionDir, { recursive: true, force: true })
  return true
}

/**
 * List all documentation sessions for a project
 */
export async function listProjectSessions(
  projectId: string
): Promise<DocSession[]> {
  const docsDir = getDocsDir()

  // Ensure directory exists
  await ensureDir(docsDir)

  try {
    const entries = await readdir(docsDir, { withFileTypes: true })
    const sessionIds = entries.filter((e) => e.isDirectory()).map((e) => e.name)

    const sessions: DocSession[] = []

    for (const sessionId of sessionIds) {
      const session = await loadDocSession(sessionId)
      if (session && session.projectId === projectId) {
        sessions.push(session)
      }
    }

    // Sort by updatedAt descending (most recent first)
    sessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )

    return sessions
  } catch {
    return []
  }
}

/**
 * List all documentation sessions
 */
export async function listAllSessions(): Promise<DocSession[]> {
  const docsDir = getDocsDir()

  // Ensure directory exists
  await ensureDir(docsDir)

  try {
    const entries = await readdir(docsDir, { withFileTypes: true })
    const sessionIds = entries.filter((e) => e.isDirectory()).map((e) => e.name)

    const sessions: DocSession[] = []

    for (const sessionId of sessionIds) {
      const session = await loadDocSession(sessionId)
      if (session) {
        sessions.push(session)
      }
    }

    // Sort by updatedAt descending (most recent first)
    sessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )

    return sessions
  } catch {
    return []
  }
}

/**
 * List sessions by documentation type
 */
export async function listSessionsByType(
  type: DocumentationType
): Promise<DocSession[]> {
  const allSessions = await listAllSessions()
  return allSessions.filter((s) => s.type === type)
}

/**
 * Add a message to a documentation session
 */
export async function addMessage(
  sessionId: string,
  role: DocMessageRole,
  content: string
): Promise<DocSessionMessage | null> {
  const session = await loadDocSession(sessionId)
  if (!session) return null

  const message = createDocMessage(role, content)
  session.messages.push(message)

  session.updatedAt = new Date().toISOString()
  await saveDocSession(session)

  return message
}

/**
 * Update the last message in a session (for streaming)
 */
export async function updateLastMessage(
  sessionId: string,
  content: string,
  isStreaming: boolean
): Promise<DocSessionMessage | null> {
  const session = await loadDocSession(sessionId)
  if (!session || session.messages.length === 0) return null

  const lastMessage = session.messages[session.messages.length - 1]
  lastMessage.content = content
  lastMessage.isStreaming = isStreaming

  session.updatedAt = new Date().toISOString()
  await saveDocSession(session)

  return lastMessage
}

/**
 * Update the session's generated content
 */
export async function updateGeneratedContent(
  sessionId: string,
  content: string
): Promise<void> {
  const session = await loadDocSession(sessionId)
  if (!session) return

  session.generatedContent = content
  // Initialize editedContent if not set
  if (!session.editedContent) {
    session.editedContent = content
  }
  session.updatedAt = new Date().toISOString()
  await saveDocSession(session)
}

/**
 * Update the session's edited content
 */
export async function updateEditedContent(
  sessionId: string,
  content: string
): Promise<void> {
  const session = await loadDocSession(sessionId)
  if (!session) return

  session.editedContent = content
  session.updatedAt = new Date().toISOString()
  await saveDocSession(session)
}

/**
 * Set the conversation ID for a session (for --resume)
 */
export async function setConversationId(
  sessionId: string,
  conversationId: string
): Promise<void> {
  const session = await loadDocSession(sessionId)
  if (!session) return

  session.conversationId = conversationId
  session.updatedAt = new Date().toISOString()
  await saveDocSession(session)
}

/**
 * Get active sessions (status = 'generating' | 'reviewing' | 'editing')
 */
export async function getActiveSessions(): Promise<DocSession[]> {
  const sessions = await listAllSessions()
  return sessions.filter((s) =>
    ['generating', 'reviewing', 'editing'].includes(s.status)
  )
}

/**
 * Mark session as committed
 */
export async function markCommitted(sessionId: string): Promise<void> {
  await updateDocSession(sessionId, {
    status: 'committed'
  })
}

/**
 * Mark session as cancelled
 */
export async function markCancelled(sessionId: string): Promise<void> {
  await updateDocSession(sessionId, {
    status: 'cancelled'
  })
}
