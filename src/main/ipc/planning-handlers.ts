/**
 * IPC handlers for planning sessions
 */

import { ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  CreatePlanningSessionData,
  ExtractedPlanItem,
  PlanningSession,
  TaskManifest,
  ContextAttachment
} from '@shared/types'
import type {
  SendPlanningMessageData,
  AddContextAttachmentData,
  RemoveContextAttachmentData,
  LoadContextContentData
} from '@shared/ipc-types'
import { AGENT_IDS } from '@shared/types'
import * as planningStore from '@main/storage/planning-store'
import { planningManager } from '@main/agents/planning-manager'
import { getProjectPath } from '@main/storage'
import { createTask } from '@main/storage/task-store'
import { loadContextAttachmentContent } from '@main/utils/context-loader'

/**
 * Register all planning IPC handlers
 */
export function registerPlanningHandlers(): void {
  /**
   * Create a new planning session
   */
  ipcMain.handle(
    'planning:create',
    async (_event, data: CreatePlanningSessionData): Promise<PlanningSession> => {
      const agentId = data.agentId || AGENT_IDS.CLAUDE_CODE
      const session = await planningStore.createSession(data, agentId)

      // If there's an initial message, start the chat
      if (data.initialMessage) {
        const localPath = await getProjectPath(data.projectId)
        if (localPath) {
          // Send message asynchronously (don't await - it streams)
          planningManager
            .sendMessage(session.id, data.initialMessage, localPath)
            .catch((error) => {
              console.error('[PlanningHandlers] Error sending initial message:', error)
            })
        }
      }

      return session
    }
  )

  /**
   * Get a planning session by ID
   */
  ipcMain.handle(
    'planning:get',
    async (_event, sessionId: string): Promise<PlanningSession | null> => {
      return planningStore.loadPlanningSession(sessionId)
    }
  )

  /**
   * List planning sessions for a project
   */
  ipcMain.handle(
    'planning:list',
    async (_event, projectId: string): Promise<PlanningSession[]> => {
      return planningStore.listProjectSessions(projectId)
    }
  )

  /**
   * List all planning sessions
   */
  ipcMain.handle('planning:listAll', async (): Promise<PlanningSession[]> => {
    return planningStore.listAllSessions()
  })

  /**
   * Delete a planning session
   */
  ipcMain.handle(
    'planning:delete',
    async (_event, sessionId: string): Promise<boolean> => {
      // Cancel any active response first
      await planningManager.cancelResponse(sessionId)
      return planningStore.deletePlanningSession(sessionId)
    }
  )

  /**
   * Send a message in a planning session
   */
  ipcMain.handle(
    'planning:sendMessage',
    async (_event, data: SendPlanningMessageData): Promise<void> => {
      const session = await planningStore.loadPlanningSession(data.sessionId)
      if (!session) {
        throw new Error(`Planning session not found: ${data.sessionId}`)
      }

      const localPath = await getProjectPath(session.projectId)
      if (!localPath) {
        throw new Error(
          `Project path not configured. Please remove and re-add this project to set its local path.`
        )
      }

      // Send message (this streams the response asynchronously)
      await planningManager.sendMessage(
        data.sessionId,
        data.content,
        localPath,
        data.contextAttachments
      )
    }
  )

  /**
   * Cancel an active response
   */
  ipcMain.handle(
    'planning:cancelResponse',
    async (_event, sessionId: string): Promise<boolean> => {
      return planningManager.cancelResponse(sessionId)
    }
  )

  /**
   * Update plan items for a session
   */
  ipcMain.handle(
    'planning:updatePlanItems',
    async (
      _event,
      sessionId: string,
      items: ExtractedPlanItem[]
    ): Promise<PlanningSession | null> => {
      return planningStore.updatePlanningSession(sessionId, {
        finalPlan: items
      })
    }
  )

  /**
   * Convert selected plan items to tasks
   */
  ipcMain.handle(
    'planning:convertToTasks',
    async (_event, sessionId: string, itemIds: string[]): Promise<TaskManifest[]> => {
      const session = await planningStore.loadPlanningSession(sessionId)
      if (!session) {
        throw new Error(`Planning session not found: ${sessionId}`)
      }

      // Filter to selected items
      const selectedItems = session.finalPlan.filter((item) => itemIds.includes(item.id))
      if (selectedItems.length === 0) {
        return []
      }

      // Sort by order
      selectedItems.sort((a, b) => a.order - b.order)

      // Create tasks for each selected item
      const createdTasks: TaskManifest[] = []
      const createdTaskIds: string[] = [...session.createdTaskIds]

      for (const item of selectedItems) {
        // Combine title and description into a single prompt
        const prompt = item.title + '\n\n' + item.description
        const task = await createTask(prompt, session.projectId, {
          source: 'manual', // Using 'manual' as planning isn't a TaskSource yet
          sourceRef: session.id
        })
        createdTasks.push(task)
        createdTaskIds.push(task.id)
      }

      // Update session with created task IDs and status
      await planningStore.updatePlanningSession(sessionId, {
        status: 'converted',
        createdTaskIds
      })

      return createdTasks
    }
  )

  /**
   * Add a context attachment to a planning session
   */
  ipcMain.handle(
    'planning:addContextAttachment',
    async (_event, data: AddContextAttachmentData): Promise<PlanningSession | null> => {
      return planningStore.addContextAttachment(data.sessionId, data.attachment)
    }
  )

  /**
   * Remove a context attachment from a planning session
   */
  ipcMain.handle(
    'planning:removeContextAttachment',
    async (_event, data: RemoveContextAttachmentData): Promise<PlanningSession | null> => {
      return planningStore.removeContextAttachment(data.sessionId, data.attachmentId)
    }
  )

  /**
   * Load content for a context attachment
   */
  ipcMain.handle(
    'planning:loadContextContent',
    async (_event, data: LoadContextContentData): Promise<ContextAttachment> => {
      return loadContextAttachmentContent(data.attachment)
    }
  )

  /**
   * Read a plan markdown file from the project directory
   */
  ipcMain.handle(
    'planning:readPlanFile',
    async (_event, projectId: string, filePath: string): Promise<string> => {
      // Get the project's local path
      const projectPath = await getProjectPath(projectId)
      if (!projectPath) {
        throw new Error(
          `Project path not configured. Please remove and re-add this project to set its local path.`
        )
      }

      // Resolve the file path (normalize to prevent directory traversal)
      const normalizedPath = path.normalize(filePath)

      // Prevent directory traversal attacks
      if (normalizedPath.includes('..')) {
        throw new Error('Invalid file path: directory traversal not allowed')
      }

      // Build the full path
      const fullPath = path.join(projectPath, normalizedPath)

      // Verify the file is within the project directory
      const resolvedPath = path.resolve(fullPath)
      const resolvedProjectPath = path.resolve(projectPath)
      if (!resolvedPath.startsWith(resolvedProjectPath)) {
        throw new Error('File path is outside project directory')
      }

      // Read the file
      try {
        const content = await fs.readFile(fullPath, 'utf-8')
        return content
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new Error(`File not found: ${filePath}`)
        }
        throw new Error(`Failed to read file: ${(error as Error).message}`)
      }
    }
  )
}
