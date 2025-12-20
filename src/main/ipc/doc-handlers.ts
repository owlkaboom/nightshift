/**
 * Documentation IPC handlers
 *
 * Handles IPC communication for documentation generation between
 * main and renderer processes.
 */

import { ipcMain } from 'electron'
import type {
  DocSession,
  CreateDocSessionData,
  DocumentationType,
  DocTemplate,
  ExistingDocAnalysis,
  DocSuggestion
} from '@shared/types'
import { getDefaultDocPath } from '@shared/types'
import * as docSessionStore from '@main/storage/doc-session-store'
import { DocumentationGenerator } from '@main/docs/doc-generator'
import { docManager } from '@main/docs/doc-manager'
import { getProjectPath } from '@main/storage/local-state-store'
import { getProject } from '@main/storage/sqlite/project-store'

/**
 * Register all documentation IPC handlers
 */
export function registerDocHandlers(): void {
  // Session management
  ipcMain.handle('docs:createSession', handleCreateSession)
  ipcMain.handle('docs:getSession', handleGetSession)
  ipcMain.handle('docs:listSessions', handleListSessions)
  ipcMain.handle('docs:listAllSessions', handleListAllSessions)
  ipcMain.handle('docs:deleteSession', handleDeleteSession)
  ipcMain.handle('docs:updateContent', handleUpdateContent)
  ipcMain.handle('docs:generate', handleGenerate)
  ipcMain.handle('docs:refine', handleRefine)
  ipcMain.handle('docs:commit', handleCommit)
  ipcMain.handle('docs:cancel', handleCancel)

  // Templates
  ipcMain.handle('docs:getTemplates', handleGetTemplates)
  ipcMain.handle('docs:getTemplate', handleGetTemplate)

  // Analysis
  ipcMain.handle('docs:analyze', handleAnalyze)
  ipcMain.handle('docs:suggest', handleSuggest)
}

/**
 * Create a new documentation session
 */
async function handleCreateSession(
  _event: Electron.IpcMainInvokeEvent,
  data: CreateDocSessionData
): Promise<DocSession> {
  // Get project info
  const project = await getProject(data.projectId)
  if (!project) {
    throw new Error(`Project not found: ${data.projectId}`)
  }

  const projectPath = await getProjectPath(data.projectId)
  if (!projectPath) {
    throw new Error(
      `Project path not configured. Please remove and re-add this project to set its local path.`
    )
  }

  // Determine target path
  const targetPath = data.outputPath || getDefaultDocPath(data.type, projectPath)

  // Use default agent if not specified
  const agentId = data.agentId || 'claude-code'

  // Create session
  const session = await docSessionStore.createSession(
    data,
    agentId,
    targetPath
  )

  return session
}

/**
 * Get a documentation session by ID
 */
async function handleGetSession(
  _event: Electron.IpcMainInvokeEvent,
  sessionId: string
): Promise<DocSession | null> {
  return docSessionStore.loadDocSession(sessionId)
}

/**
 * List documentation sessions for a project
 */
async function handleListSessions(
  _event: Electron.IpcMainInvokeEvent,
  projectId: string
): Promise<DocSession[]> {
  return docSessionStore.listProjectSessions(projectId)
}

/**
 * List all documentation sessions
 */
async function handleListAllSessions(): Promise<DocSession[]> {
  return docSessionStore.listAllSessions()
}

/**
 * Delete a documentation session
 */
async function handleDeleteSession(
  _event: Electron.IpcMainInvokeEvent,
  sessionId: string
): Promise<boolean> {
  return docSessionStore.deleteDocSession(sessionId)
}

/**
 * Update session edited content
 */
async function handleUpdateContent(
  _event: Electron.IpcMainInvokeEvent,
  sessionId: string,
  content: string
): Promise<void> {
  await docSessionStore.updateEditedContent(sessionId, content)
}

/**
 * Generate documentation
 */
async function handleGenerate(
  _event: Electron.IpcMainInvokeEvent,
  sessionId: string
): Promise<void> {
  const session = await docSessionStore.loadDocSession(sessionId)
  if (!session) {
    throw new Error(`Documentation session not found: ${sessionId}`)
  }

  const project = await getProject(session.projectId)
  if (!project) {
    throw new Error(`Project not found: ${session.projectId}`)
  }

  const projectPath = await getProjectPath(session.projectId)
  if (!projectPath) {
    throw new Error(
      `Project path not configured. Please remove and re-add this project to set its local path.`
    )
  }

  // Build generation prompt
  const prompt = await DocumentationGenerator.buildGenerationPrompt(
    {
      projectId: session.projectId,
      type: session.type,
      updateExisting: session.isUpdate,
      agentId: session.agentId
    },
    projectPath,
    project.name
  )

  // Start generation
  await docManager.generateDoc(sessionId, prompt, projectPath)
}

/**
 * Send refinement message
 */
async function handleRefine(
  _event: Electron.IpcMainInvokeEvent,
  sessionId: string,
  message: string
): Promise<void> {
  const session = await docSessionStore.loadDocSession(sessionId)
  if (!session) {
    throw new Error(`Documentation session not found: ${sessionId}`)
  }

  const projectPath = await getProjectPath(session.projectId)
  if (!projectPath) {
    throw new Error(
      `Project path not configured. Please remove and re-add this project to set its local path.`
    )
  }

  await docManager.sendRefinement(sessionId, message, projectPath)
}

/**
 * Commit documentation to file
 */
async function handleCommit(
  _event: Electron.IpcMainInvokeEvent,
  sessionId: string
): Promise<void> {
  await docManager.commitDoc(sessionId)
}

/**
 * Cancel active generation
 */
async function handleCancel(
  _event: Electron.IpcMainInvokeEvent,
  sessionId: string
): Promise<boolean> {
  return docManager.cancelResponse(sessionId)
}

/**
 * Get all templates
 */
async function handleGetTemplates(): Promise<DocTemplate[]> {
  return DocumentationGenerator.getTemplates()
}

/**
 * Get a specific template
 */
async function handleGetTemplate(
  _event: Electron.IpcMainInvokeEvent,
  type: DocumentationType
): Promise<DocTemplate> {
  return DocumentationGenerator.getTemplate(type)
}

/**
 * Analyze existing documentation
 */
async function handleAnalyze(
  _event: Electron.IpcMainInvokeEvent,
  projectId: string
): Promise<ExistingDocAnalysis> {
  const projectPath = await getProjectPath(projectId)
  if (!projectPath) {
    throw new Error(
      `Project path not configured. Please remove and re-add this project to set its local path.`
    )
  }

  return DocumentationGenerator.analyzeExisting(projectPath)
}

/**
 * Get documentation suggestions
 */
async function handleSuggest(
  _event: Electron.IpcMainInvokeEvent,
  projectId: string
): Promise<DocSuggestion[]> {
  const projectPath = await getProjectPath(projectId)
  if (!projectPath) {
    throw new Error(
      `Project path not configured. Please remove and re-add this project to set its local path.`
    )
  }

  return DocumentationGenerator.suggestImprovements(projectPath)
}
