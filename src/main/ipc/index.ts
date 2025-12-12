/**
 * IPC handler registration
 * Registers all IPC handlers for main process
 */

import { registerProjectHandlers } from './project-handlers'
import { registerTaskHandlers } from './task-handlers'
import { registerTagHandlers } from './tag-handlers'
import { registerConfigHandlers } from './config-handlers'
import { registerAgentConfigHandlers, initializeAgentConfig } from './agent-config-handlers'
import { registerSystemHandlers } from './system-handlers'
import { registerGitHandlers } from './git-handlers'
import { registerAgentHandlers } from './agent-handlers'
import { registerSkillHandlers } from './skill-handlers'
import { registerMemoryHandlers } from './memory-handlers'
import { registerPlanningHandlers } from './planning-handlers'
import { registerNoteHandlers } from './note-handlers'
import { registerWhisperHandlers } from './whisper-handlers'
import { registerClaudeConfigHandlers } from './claude-config-handlers'
import { registerDocHandlers } from './doc-handlers'
import { registerAnalysisHandlers } from './analysis-handlers'
import { registerIntegrationHandlers } from './integration-handlers'

/**
 * Register all IPC handlers
 * Call this during app initialization
 */
export async function registerIpcHandlers(): Promise<void> {
  registerProjectHandlers()
  registerTaskHandlers()
  await registerTagHandlers()
  await registerConfigHandlers()
  await registerAgentConfigHandlers()
  await initializeAgentConfig()
  registerSystemHandlers()
  registerGitHandlers()
  registerAgentHandlers()
  registerSkillHandlers()
  registerMemoryHandlers()
  registerPlanningHandlers()
  registerNoteHandlers()
  registerWhisperHandlers()
  registerClaudeConfigHandlers()
  registerDocHandlers()
  registerAnalysisHandlers()
  registerIntegrationHandlers()
}

// Re-export individual registrations for testing
export { registerProjectHandlers }
export { registerTaskHandlers }
export { registerTagHandlers }
export { registerConfigHandlers }
export { registerAgentConfigHandlers, initializeAgentConfig }
export { registerSystemHandlers }
export { registerGitHandlers }
export { registerAgentHandlers }
export { registerSkillHandlers }
export { registerMemoryHandlers }
export { registerPlanningHandlers }
export { registerNoteHandlers }
export { registerWhisperHandlers }
export { registerClaudeConfigHandlers }
export { registerDocHandlers }
export { registerAnalysisHandlers }
export { registerIntegrationHandlers }
