/**
 * Planning session storage for ~/.nightshift/planning/<session-id>/session.json
 */

import { readdir, rm } from 'fs/promises'
import type {
  PlanningSession,
  PlanningMessage,
  MessageRole,
  CreatePlanningSessionData,
  ContextAttachment
} from '@shared/types'
import {
  createPlanningSession,
  createPlanningMessage,
  extractTitleFromMessage,
  generateInitSystemPrompt
} from '@shared/types'
import {
  getPlanningDir,
  getPlanningSessionDir,
  getPlanningSessionPath
} from '../utils/paths'
import { readJson, writeJson, ensureDir, fileExists } from './file-store'

/**
 * Load a planning session by ID
 */
export async function loadPlanningSession(
  sessionId: string
): Promise<PlanningSession | null> {
  const path = getPlanningSessionPath(sessionId)
  return readJson(path)
}

/**
 * Save a planning session
 */
export async function savePlanningSession(session: PlanningSession): Promise<void> {
  const path = getPlanningSessionPath(session.id)
  await writeJson(path, session)
}

/**
 * Create a new planning session
 */
export async function createSession(
  data: CreatePlanningSessionData,
  agentId: string
): Promise<PlanningSession> {
  const sessionType = data.sessionType || 'general'
  const session = createPlanningSession(data.projectId, agentId, {
    sessionType
  })

  // For init sessions, generate and store the system prompt
  if (sessionType === 'init' && data.projectDescription) {
    session.systemPrompt = generateInitSystemPrompt(
      data.projectDescription,
      data.techStack
    )
    session.title = `Init: ${extractTitleFromMessage(data.projectDescription)}`
  }

  // If initial message provided, add it
  if (data.initialMessage) {
    const message = createPlanningMessage('user', data.initialMessage)
    session.messages.push(message)
    // Only override title for general sessions
    if (sessionType === 'general') {
      session.title = extractTitleFromMessage(data.initialMessage)
    }
  }

  await savePlanningSession(session)
  return session
}

/**
 * Update a planning session
 */
export async function updatePlanningSession(
  sessionId: string,
  updates: Partial<Omit<PlanningSession, 'id' | 'createdAt'>>
): Promise<PlanningSession | null> {
  const session = await loadPlanningSession(sessionId)
  if (!session) return null

  const updated: PlanningSession = {
    ...session,
    ...updates,
    updatedAt: new Date().toISOString()
  }
  await savePlanningSession(updated)
  return updated
}

/**
 * Delete a planning session
 */
export async function deletePlanningSession(sessionId: string): Promise<boolean> {
  const sessionDir = getPlanningSessionDir(sessionId)

  if (!(await fileExists(sessionDir))) {
    return false
  }

  await rm(sessionDir, { recursive: true, force: true })
  return true
}

/**
 * List all planning sessions for a project
 */
export async function listProjectSessions(
  projectId: string
): Promise<PlanningSession[]> {
  const planningDir = getPlanningDir()

  // Ensure directory exists
  await ensureDir(planningDir)

  try {
    const entries = await readdir(planningDir, { withFileTypes: true })
    const sessionIds = entries.filter((e) => e.isDirectory()).map((e) => e.name)

    const sessions: PlanningSession[] = []

    for (const sessionId of sessionIds) {
      const session = await loadPlanningSession(sessionId)
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
 * List all planning sessions
 */
export async function listAllSessions(): Promise<PlanningSession[]> {
  const planningDir = getPlanningDir()

  // Ensure directory exists
  await ensureDir(planningDir)

  try {
    const entries = await readdir(planningDir, { withFileTypes: true })
    const sessionIds = entries.filter((e) => e.isDirectory()).map((e) => e.name)

    const sessions: PlanningSession[] = []

    for (const sessionId of sessionIds) {
      const session = await loadPlanningSession(sessionId)
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
 * Add a message to a planning session
 */
export async function addMessage(
  sessionId: string,
  role: MessageRole,
  content: string,
  contextAttachments?: ContextAttachment[]
): Promise<PlanningMessage | null> {
  const session = await loadPlanningSession(sessionId)
  if (!session) return null

  const message = createPlanningMessage(role, content, {
    contextAttachments
  })
  session.messages.push(message)

  // Update title from first user message if session is new
  if (role === 'user' && session.messages.filter((m) => m.role === 'user').length === 1) {
    session.title = extractTitleFromMessage(content)
  }

  session.updatedAt = new Date().toISOString()
  await savePlanningSession(session)

  return message
}

/**
 * Update the last message in a session (for streaming)
 */
export async function updateLastMessage(
  sessionId: string,
  content: string,
  isStreaming: boolean
): Promise<PlanningMessage | null> {
  const session = await loadPlanningSession(sessionId)
  if (!session || session.messages.length === 0) return null

  const lastMessage = session.messages[session.messages.length - 1]
  lastMessage.content = content
  lastMessage.isStreaming = isStreaming

  session.updatedAt = new Date().toISOString()
  await savePlanningSession(session)

  return lastMessage
}

/**
 * Set the conversation ID for a session (for --resume)
 */
export async function setConversationId(
  sessionId: string,
  conversationId: string
): Promise<void> {
  const session = await loadPlanningSession(sessionId)
  if (!session) return

  session.conversationId = conversationId
  session.updatedAt = new Date().toISOString()
  await savePlanningSession(session)
}

/**
 * Get active sessions (status = 'active')
 */
export async function getActiveSessions(): Promise<PlanningSession[]> {
  const sessions = await listAllSessions()
  return sessions.filter((s) => s.status === 'active')
}

/**
 * Add a context attachment to a session
 */
export async function addContextAttachment(
  sessionId: string,
  attachment: ContextAttachment
): Promise<PlanningSession | null> {
  const session = await loadPlanningSession(sessionId)
  if (!session) {
    return null
  }

  // Initialize contextAttachments if needed
  if (!session.contextAttachments) {
    session.contextAttachments = []
  }

  // Add attachment
  session.contextAttachments.push(attachment)
  session.updatedAt = new Date().toISOString()

  await savePlanningSession(session)
  return session
}

/**
 * Remove a context attachment from a session
 */
export async function removeContextAttachment(
  sessionId: string,
  attachmentId: string
): Promise<PlanningSession | null> {
  const session = await loadPlanningSession(sessionId)
  if (!session) {
    return null
  }

  // Filter out the attachment
  if (session.contextAttachments) {
    session.contextAttachments = session.contextAttachments.filter(
      (a) => a.id !== attachmentId
    )
    session.updatedAt = new Date().toISOString()
    await savePlanningSession(session)
  }

  return session
}
