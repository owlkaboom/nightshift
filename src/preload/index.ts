import type {
  AddMemoryEntryData,
  AddProjectData,
  AgentAuthState,
  AgentConfigInfo,
  AgentInfo,
  CreateSkillData,
  CreateTaskData,
  FormattedPrompt,
  GitRepoInfo,
  GithubSkillData,
  MemoryStats,
  RendererApi,
  ReorderTaskData,
  RetryContextResult,
  RunningTaskInfo,
  ScannedRepo,
  SecureStorageInfo,
  SendPlanningMessageData,
  TranscriptionResult,
  UsageLimitCheckResult,
  UsageLimitState,
  UsagePercentageState,
  WhisperModelInfo,
  WhisperStatus,
  AddContextAttachmentData,
  RemoveContextAttachmentData,
  LoadContextContentData
} from '@shared/ipc-types';
import type {
  AgentModelInfo,
  AgentOutputEvent,
  AnalysisProgress,
  AppConfig,
  ClaudeAgent,
  ClaudeCommand,
  ClaudeProjectConfig,
  ClaudeSkill,
  CodebaseStructure,
  ContextAttachment,
  CreateClaudeAgentData,
  CreateClaudeCommandData,
  CreateClaudeSkillData,
  CreateDocSessionData,
  CreateNoteData,
  CreatePlanningSessionData,
  DetectedPattern,
  DetectedTechnology,
  DocSession,
  DocSuggestion,
  DocTemplate,
  DocumentationType,
  ExistingDocAnalysis,
  ExtractedPlanItem,
  MemoryEntry,
  Note,
  NoteStatus,
  PlanningSession,
  Project,
  ProjectAnalysis,
  ProjectMemory,
  Skill,
  SkillRecommendation,
  Tag,
  TaskManifest,
  TaskStatus,
  Integration,
  CreateIntegrationData,
  IntegrationConnection,
  IntegrationSource,
  CreateConnectionData,
  CreateSourceData,
  ExternalIssue,
  FetchIssuesOptions,
  CreatePROptions,
  IntegrationTestResult,
  CreatePRResult,
  JiraBoard,
  JiraSprint,
  JiraFilter,
  JiraProject
} from '@shared/types';
import { contextBridge, ipcRenderer } from 'electron';

// Type-safe API for renderer process
const api: RendererApi = {
  // ============ Projects ============
  listProjects: (): Promise<Project[]> => ipcRenderer.invoke('project:list'),

  getProject: (id: string): Promise<Project | null> => ipcRenderer.invoke('project:get', id),

  addProject: (data: AddProjectData): Promise<Project> => ipcRenderer.invoke('project:add', data),

  updateProject: (id: string, updates: Partial<Project>): Promise<Project | null> =>
    ipcRenderer.invoke('project:update', id, updates),

  removeProject: (id: string): Promise<boolean> => ipcRenderer.invoke('project:remove', id),

  setProjectPath: (id: string, localPath: string): Promise<void> =>
    ipcRenderer.invoke('project:setPath', id, localPath),

  getProjectPath: (id: string): Promise<string | null> => ipcRenderer.invoke('project:getPath', id),

  generateProjectDescription: (id: string): Promise<string> =>
    ipcRenderer.invoke('project:generateDescription', id),

  scanDirectory: (rootPath: string): Promise<ScannedRepo[]> =>
    ipcRenderer.invoke('project:scanDirectory', rootPath),

  // ============ Tasks ============
  listTasks: (projectId: string): Promise<TaskManifest[]> =>
    ipcRenderer.invoke('task:list', projectId),

  listAllTasks: (): Promise<TaskManifest[]> => ipcRenderer.invoke('task:listAll'),

  listQueuedTasks: (): Promise<TaskManifest[]> => ipcRenderer.invoke('task:listQueued'),

  listCompletedTasksByDateRange: (
    startDate: string,
    endDate: string,
    projectId?: string
  ): Promise<TaskManifest[]> =>
    ipcRenderer.invoke('task:listCompletedByDateRange', startDate, endDate, projectId),

  getTask: (projectId: string, taskId: string): Promise<TaskManifest | null> =>
    ipcRenderer.invoke('task:get', projectId, taskId),

  createTask: (data: CreateTaskData): Promise<TaskManifest> =>
    ipcRenderer.invoke('task:create', data),

  updateTask: (
    projectId: string,
    taskId: string,
    updates: Partial<TaskManifest>
  ): Promise<TaskManifest | null> => ipcRenderer.invoke('task:update', projectId, taskId, updates),

  deleteTask: (projectId: string, taskId: string): Promise<boolean> =>
    ipcRenderer.invoke('task:delete', projectId, taskId),

  updateTaskStatus: (
    projectId: string,
    taskId: string,
    status: TaskStatus
  ): Promise<TaskManifest | null> =>
    ipcRenderer.invoke('task:updateStatus', projectId, taskId, status),

  readTaskLog: (projectId: string, taskId: string): Promise<string | null> =>
    ipcRenderer.invoke('task:readLog', projectId, taskId),

  readIterationLog: (
    projectId: string,
    taskId: string,
    iteration: number
  ): Promise<string | null> =>
    ipcRenderer.invoke('task:readIterationLog', projectId, taskId, iteration),

  readPlanFile: (planFilePath: string): Promise<string | null> =>
    ipcRenderer.invoke('task:readPlanFile', planFilePath),

  acceptTask: (projectId: string, taskId: string): Promise<TaskManifest | null> =>
    ipcRenderer.invoke('task:accept', projectId, taskId),

  rejectTask: (projectId: string, taskId: string): Promise<TaskManifest | null> =>
    ipcRenderer.invoke('task:reject', projectId, taskId),

  repromptTask: (
    projectId: string,
    taskId: string,
    newPrompt: string
  ): Promise<TaskManifest | null> =>
    ipcRenderer.invoke('task:reprompt', projectId, taskId, newPrompt),

  acceptPlanAndCreateTask: (
    projectId: string,
    taskId: string,
    executionPrompt: string
  ): Promise<{ planTask: TaskManifest; executionTask: TaskManifest }> =>
    ipcRenderer.invoke('task:acceptPlanAndCreateTask', projectId, taskId, executionPrompt),

  reorderTasks: (updates: ReorderTaskData[]): Promise<TaskManifest[]> =>
    ipcRenderer.invoke('task:reorder', updates),

  generateRetryContext: (
    projectId: string,
    taskId: string,
    iteration?: number
  ): Promise<RetryContextResult | null> =>
    ipcRenderer.invoke('task:generateRetryContext', projectId, taskId, iteration),

  formatVoicePrompt: (rawPrompt: string): Promise<FormattedPrompt> =>
    ipcRenderer.invoke('task:formatVoicePrompt', rawPrompt),

  // ============ Tags ============
  listTags: (): Promise<Tag[]> => ipcRenderer.invoke('tag:list'),

  getTag: (id: string): Promise<Tag | null> => ipcRenderer.invoke('tag:get', id),

  createTag: (name: string, color?: string): Promise<Tag> =>
    ipcRenderer.invoke('tag:create', name, color),

  updateTag: (id: string, updates: Partial<Omit<Tag, 'id' | 'createdAt'>>): Promise<Tag | null> =>
    ipcRenderer.invoke('tag:update', id, updates),

  deleteTag: (id: string): Promise<boolean> => ipcRenderer.invoke('tag:delete', id),

  getTagsByIds: (ids: string[]): Promise<Tag[]> => ipcRenderer.invoke('tag:getByIds', ids),

  searchTags: (query: string): Promise<Tag[]> => ipcRenderer.invoke('tag:search', query),

  // ============ Config ============
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('config:get'),

  updateConfig: (updates: Partial<AppConfig>): Promise<AppConfig> =>
    ipcRenderer.invoke('config:update', updates),

  resetConfig: (): Promise<AppConfig> => ipcRenderer.invoke('config:reset'),

  getClaudeCodePath: (): Promise<string> => ipcRenderer.invoke('config:getClaudeCodePath'),

  setClaudeCodePath: (path: string): Promise<void> =>
    ipcRenderer.invoke('config:setClaudeCodePath', path),

  getSelectedProjectId: (): Promise<string | null> =>
    ipcRenderer.invoke('config:getSelectedProjectId'),

  setSelectedProjectId: (projectId: string | null): Promise<void> =>
    ipcRenderer.invoke('config:setSelectedProjectId', projectId),

  // ============ Agent Config ============
  listAgentConfigs: (): Promise<AgentConfigInfo[]> => ipcRenderer.invoke('agentConfig:list'),

  getAgentConfig: (agentId: string): Promise<AgentConfigInfo | null> =>
    ipcRenderer.invoke('agentConfig:get', agentId),

  getSelectedAgent: (): Promise<string> => ipcRenderer.invoke('agentConfig:getSelected'),

  setSelectedAgent: (agentId: string): Promise<void> =>
    ipcRenderer.invoke('agentConfig:setSelected', agentId),

  setAgentEnabled: (agentId: string, enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('agentConfig:setEnabled', agentId, enabled),

  setAgentApiKey: (agentId: string, apiKey: string): Promise<void> =>
    ipcRenderer.invoke('agentConfig:setApiKey', agentId, apiKey),

  deleteAgentApiKey: (agentId: string): Promise<void> =>
    ipcRenderer.invoke('agentConfig:deleteApiKey', agentId),

  hasAgentApiKey: (agentId: string): Promise<boolean> =>
    ipcRenderer.invoke('agentConfig:hasApiKey', agentId),

  setAgentTier: (agentId: string, tier: string): Promise<void> =>
    ipcRenderer.invoke('agentConfig:setTier', agentId, tier),

  setAgentCustomPath: (agentId: string, path: string | null): Promise<void> =>
    ipcRenderer.invoke('agentConfig:setCustomPath', agentId, path),

  setAgentSetting: (agentId: string, key: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke('agentConfig:setSetting', agentId, key, value),

  getAgentSetting: (agentId: string, key: string): Promise<unknown> =>
    ipcRenderer.invoke('agentConfig:getSetting', agentId, key),

  validateAgentApiKey: (
    agentId: string,
    apiKey: string
  ): Promise<{ valid: boolean; error?: string }> =>
    ipcRenderer.invoke('agentConfig:validateApiKey', agentId, apiKey),

  getSecureStorageInfo: (): Promise<SecureStorageInfo> =>
    ipcRenderer.invoke('agentConfig:getSecureStorageInfo'),

  testAgentCli: (agentId: string): Promise<{ success: boolean; version?: string; error?: string }> =>
    ipcRenderer.invoke('agentConfig:testCli', agentId),

  // ============ System ============
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('system:selectDirectory'),

  selectFile: (filters?: Electron.FileFilter[]): Promise<string | null> =>
    ipcRenderer.invoke('system:selectFile', filters),

  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('system:openExternal', url),

  openPath: (path: string): Promise<void> => ipcRenderer.invoke('system:openPath', path),

  getVersion: (): Promise<string> => ipcRenderer.invoke('system:getVersion'),

  getChangelog: (): Promise<string> => ipcRenderer.invoke('system:getChangelog'),

  openChangelog: (): Promise<void> => ipcRenderer.invoke('system:openChangelog'),

  getPlatform: (): Promise<NodeJS.Platform> => ipcRenderer.invoke('system:getPlatform'),

  getStorageStatus: () => ipcRenderer.invoke('system:getStorageStatus'),

  getStartupStatus: (): Promise<{ stage: string; message: string; complete: boolean }> =>
    ipcRenderer.invoke('system:getStartupStatus'),

  testNotification: (): Promise<void> => ipcRenderer.invoke('system:testNotification'),

  previewNotificationSound: (soundName: string, customPath?: string): Promise<void> =>
    ipcRenderer.invoke('system:previewNotificationSound', soundName, customPath),

  copyNotificationSound: (sourcePath: string): Promise<string> =>
    ipcRenderer.invoke('system:copyNotificationSound', sourcePath),

  onStartupProgress: (
    callback: (status: { stage: string; message: string; complete: boolean }) => void
  ): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, status: { stage: string; message: string; complete: boolean }) => callback(status)
    ipcRenderer.on('app:startupProgress', handler)
    return () => ipcRenderer.removeListener('app:startupProgress', handler)
  },

  // ============ Git ============
  getRepoInfo: (path: string): Promise<GitRepoInfo> => ipcRenderer.invoke('git:getRepoInfo', path),

  extractRepoName: (gitUrl: string): Promise<string> =>
    ipcRenderer.invoke('git:extractRepoName', gitUrl),

  normalizeGitUrl: (gitUrl: string): Promise<string> => ipcRenderer.invoke('git:normalizeUrl', gitUrl),

  getCurrentBranch: (projectId: string): Promise<string | null> =>
    ipcRenderer.invoke('git:getCurrentBranch', projectId),

  // ============ Agents ============
  listAgents: (): Promise<AgentInfo[]> => ipcRenderer.invoke('agent:list'),

  getAvailableAgents: (): Promise<AgentInfo[]> => ipcRenderer.invoke('agent:getAvailable'),

  getDefaultAgent: (): Promise<AgentInfo> => ipcRenderer.invoke('agent:getDefault'),

  isAgentAvailable: (agentId: string): Promise<boolean> =>
    ipcRenderer.invoke('agent:isAvailable', agentId),

  getAgentModels: (agentId: string): Promise<AgentModelInfo[]> =>
    ipcRenderer.invoke('agent:getModels', agentId),

  getAgentDefaultModel: (agentId: string): Promise<string | null> =>
    ipcRenderer.invoke('agent:getDefaultModel', agentId),

  startTask: (projectId: string, taskId: string): Promise<boolean> =>
    ipcRenderer.invoke('agent:startTask', projectId, taskId),

  cancelTask: (taskId: string): Promise<boolean> => ipcRenderer.invoke('agent:cancelTask', taskId),

  getRunningTasks: (): Promise<RunningTaskInfo[]> => ipcRenderer.invoke('agent:getRunningTasks'),

  getTaskOutput: (taskId: string): Promise<AgentOutputEvent[]> =>
    ipcRenderer.invoke('agent:getTaskOutput', taskId),

  getUsageLimitState: (): Promise<UsageLimitState> =>
    ipcRenderer.invoke('agent:getUsageLimitState'),

  clearUsageLimit: (): Promise<void> => ipcRenderer.invoke('agent:clearUsageLimit'),

  checkUsageLimits: (): Promise<UsageLimitCheckResult> =>
    ipcRenderer.invoke('agent:checkUsageLimits'),

  getUsagePercentage: (): Promise<UsagePercentageState> =>
    ipcRenderer.invoke('agent:getUsagePercentage'),

  checkAgentAuth: (agentId: string): Promise<AgentAuthState> =>
    ipcRenderer.invoke('agent:checkAuth', agentId),

  getAgentAuthStates: (): Promise<AgentAuthState[]> =>
    ipcRenderer.invoke('agent:getAuthStates'),

  triggerAgentReauth: (
    agentId: string,
    projectPath?: string
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('agent:triggerReauth', agentId, projectPath),

  // ============ Skills ============
  listSkills: (): Promise<Skill[]> => ipcRenderer.invoke('skill:list'),

  getSkill: (id: string): Promise<Skill | null> => ipcRenderer.invoke('skill:get', id),

  getSkillsByIds: (ids: string[]): Promise<Skill[]> => ipcRenderer.invoke('skill:getByIds', ids),

  getEnabledSkills: (): Promise<Skill[]> => ipcRenderer.invoke('skill:getEnabled'),

  createSkill: (data: CreateSkillData): Promise<Skill> => ipcRenderer.invoke('skill:create', data),

  updateSkill: (id: string, updates: Partial<Skill>): Promise<Skill | null> =>
    ipcRenderer.invoke('skill:update', id, updates),

  deleteSkill: (id: string): Promise<boolean> => ipcRenderer.invoke('skill:delete', id),

  toggleSkill: (id: string): Promise<Skill | null> => ipcRenderer.invoke('skill:toggle', id),

  setSkillsEnabled: (ids: string[], enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('skill:setEnabled', ids, enabled),

  buildSkillPrompt: (ids: string[]): Promise<string> => ipcRenderer.invoke('skill:buildPrompt', ids),

  resetSkills: (): Promise<Skill[]> => ipcRenderer.invoke('skill:reset'),

  fetchGithubSkills: (githubUrl: string): Promise<GithubSkillData[]> =>
    ipcRenderer.invoke('skill:fetchFromGithub', githubUrl),

  // ============ Memory ============
  getProjectMemory: (projectId: string): Promise<ProjectMemory> =>
    ipcRenderer.invoke('memory:get', projectId),

  getMemoryContext: (projectId: string): Promise<string> =>
    ipcRenderer.invoke('memory:getContext', projectId),

  getMemoryStats: (projectId: string): Promise<MemoryStats> =>
    ipcRenderer.invoke('memory:getStats', projectId),

  addMemoryEntry: (data: AddMemoryEntryData): Promise<MemoryEntry> =>
    ipcRenderer.invoke('memory:addEntry', data),

  updateMemoryStructure: (projectId: string, structure: CodebaseStructure): Promise<void> =>
    ipcRenderer.invoke('memory:updateStructure', projectId, structure),

  compactMemory: (projectId: string): Promise<number> =>
    ipcRenderer.invoke('memory:compact', projectId),

  clearProjectMemory: (projectId: string): Promise<void> =>
    ipcRenderer.invoke('memory:clear', projectId),

  hasProjectMemory: (projectId: string): Promise<boolean> =>
    ipcRenderer.invoke('memory:hasMemory', projectId),

  // ============ Planning ============
  createPlanningSession: (data: CreatePlanningSessionData): Promise<PlanningSession> =>
    ipcRenderer.invoke('planning:create', data),

  getPlanningSession: (sessionId: string): Promise<PlanningSession | null> =>
    ipcRenderer.invoke('planning:get', sessionId),

  listPlanningSessions: (projectId: string): Promise<PlanningSession[]> =>
    ipcRenderer.invoke('planning:list', projectId),

  listAllPlanningSessions: (): Promise<PlanningSession[]> =>
    ipcRenderer.invoke('planning:listAll'),

  deletePlanningSession: (sessionId: string): Promise<boolean> =>
    ipcRenderer.invoke('planning:delete', sessionId),

  sendPlanningMessage: (data: SendPlanningMessageData): Promise<void> =>
    ipcRenderer.invoke('planning:sendMessage', data),

  cancelPlanningResponse: (sessionId: string): Promise<boolean> =>
    ipcRenderer.invoke('planning:cancelResponse', sessionId),

  updatePlanItems: (sessionId: string, items: ExtractedPlanItem[]): Promise<PlanningSession | null> =>
    ipcRenderer.invoke('planning:updatePlanItems', sessionId, items),

  convertPlanToTasks: (sessionId: string, itemIds: string[]): Promise<TaskManifest[]> =>
    ipcRenderer.invoke('planning:convertToTasks', sessionId, itemIds),

  addPlanningContextAttachment: (data: AddContextAttachmentData): Promise<PlanningSession | null> =>
    ipcRenderer.invoke('planning:addContextAttachment', data),

  removePlanningContextAttachment: (data: RemoveContextAttachmentData): Promise<PlanningSession | null> =>
    ipcRenderer.invoke('planning:removeContextAttachment', data),

  loadPlanningContextContent: (data: LoadContextContentData): Promise<ContextAttachment> =>
    ipcRenderer.invoke('planning:loadContextContent', data),

  readPlanningFile: (projectId: string, filePath: string): Promise<string> =>
    ipcRenderer.invoke('planning:readPlanFile', projectId, filePath),

  // ============ Notes ============
  listNotes: (): Promise<Note[]> => ipcRenderer.invoke('note:list'),

  getNote: (noteId: string): Promise<Note | null> => ipcRenderer.invoke('note:get', noteId),

  createNote: (data: CreateNoteData): Promise<Note> => ipcRenderer.invoke('note:create', data),

  updateNote: (noteId: string, updates: Partial<Note>): Promise<Note | null> =>
    ipcRenderer.invoke('note:update', noteId, updates),

  deleteNote: (noteId: string): Promise<boolean> => ipcRenderer.invoke('note:delete', noteId),

  searchNotes: (query: string): Promise<Note[]> => ipcRenderer.invoke('note:search', query),

  listNotesByProject: (projectId: string): Promise<Note[]> =>
    ipcRenderer.invoke('note:listByProject', projectId),

  listNotesReferencingProject: (projectId: string): Promise<Note[]> =>
    ipcRenderer.invoke('note:listReferencingProject', projectId),

  listRecentNotes: (limit?: number): Promise<Note[]> =>
    ipcRenderer.invoke('note:listRecent', limit),

  listPinnedNotes: (): Promise<Note[]> => ipcRenderer.invoke('note:listPinned'),

  listNotesByStatus: (status: NoteStatus): Promise<Note[]> =>
    ipcRenderer.invoke('note:listByStatus', status),

  listNotesByTag: (tag: string): Promise<Note[]> => ipcRenderer.invoke('note:listByTag', tag),

  toggleNotePin: (noteId: string): Promise<Note | null> =>
    ipcRenderer.invoke('note:togglePin', noteId),

  archiveNote: (noteId: string): Promise<Note | null> =>
    ipcRenderer.invoke('note:archive', noteId),

  unarchiveNote: (noteId: string): Promise<Note | null> =>
    ipcRenderer.invoke('note:unarchive', noteId),

  linkNoteToTask: (noteId: string, taskId: string): Promise<Note | null> =>
    ipcRenderer.invoke('note:linkToTask', noteId, taskId),

  unlinkNoteFromTask: (noteId: string, taskId: string): Promise<Note | null> =>
    ipcRenderer.invoke('note:unlinkFromTask', noteId, taskId),

  linkNoteToPlanning: (noteId: string, planningId: string): Promise<Note | null> =>
    ipcRenderer.invoke('note:linkToPlanning', noteId, planningId),

  unlinkNoteFromPlanning: (noteId: string, planningId: string): Promise<Note | null> =>
    ipcRenderer.invoke('note:unlinkFromPlanning', noteId, planningId),

  getAllNoteTags: (): Promise<string[]> => ipcRenderer.invoke('note:getAllTags'),

  // ============ Whisper ============
  getWhisperStatus: (): Promise<WhisperStatus> => ipcRenderer.invoke('whisper:getStatus'),

  getWhisperModels: (): Promise<WhisperModelInfo[]> => ipcRenderer.invoke('whisper:getModels'),

  loadWhisperModel: (modelKey: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('whisper:loadModel', modelKey),

  unloadWhisperModel: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('whisper:unloadModel'),

  transcribeAudio: (
    audioBase64: string,
    options?: { language?: string; returnTimestamps?: boolean }
  ): Promise<{ success: boolean; result?: TranscriptionResult; error?: string }> =>
    ipcRenderer.invoke('whisper:transcribe', audioBase64, options),

  onWhisperLoadProgress: (
    callback: (data: { modelKey: string; progress: number }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { modelKey: string; progress: number }
    ) => callback(data)
    ipcRenderer.on('whisper:loadProgress', handler)
    return () => ipcRenderer.removeListener('whisper:loadProgress', handler)
  },

  // ============ Claude Config ============
  scanClaudeConfig: (projectId: string): Promise<ClaudeProjectConfig> =>
    ipcRenderer.invoke('claudeConfig:scan', projectId),

  getClaudeAgents: (projectId: string): Promise<ClaudeAgent[]> =>
    ipcRenderer.invoke('claudeConfig:getAgents', projectId),

  getClaudeSkills: (projectId: string): Promise<ClaudeSkill[]> =>
    ipcRenderer.invoke('claudeConfig:getSkills', projectId),

  getClaudeCommands: (projectId: string): Promise<ClaudeCommand[]> =>
    ipcRenderer.invoke('claudeConfig:getCommands', projectId),

  createClaudeAgent: (projectId: string, data: CreateClaudeAgentData): Promise<ClaudeAgent> =>
    ipcRenderer.invoke('claudeConfig:createAgent', projectId, data),

  updateClaudeAgent: (
    projectId: string,
    name: string,
    updates: Partial<CreateClaudeAgentData>
  ): Promise<ClaudeAgent> =>
    ipcRenderer.invoke('claudeConfig:updateAgent', projectId, name, updates),

  deleteClaudeAgent: (projectId: string, name: string): Promise<void> =>
    ipcRenderer.invoke('claudeConfig:deleteAgent', projectId, name),

  createClaudeSkill: (projectId: string, data: CreateClaudeSkillData): Promise<ClaudeSkill> =>
    ipcRenderer.invoke('claudeConfig:createSkill', projectId, data),

  updateClaudeSkill: (
    projectId: string,
    name: string,
    updates: Partial<CreateClaudeSkillData>
  ): Promise<ClaudeSkill> =>
    ipcRenderer.invoke('claudeConfig:updateSkill', projectId, name, updates),

  deleteClaudeSkill: (projectId: string, name: string): Promise<void> =>
    ipcRenderer.invoke('claudeConfig:deleteSkill', projectId, name),

  toggleClaudeSkill: (projectId: string, name: string, enabled: boolean): Promise<ClaudeSkill> =>
    ipcRenderer.invoke('claudeConfig:toggleSkill', projectId, name, enabled),

  createClaudeCommand: (projectId: string, data: CreateClaudeCommandData): Promise<ClaudeCommand> =>
    ipcRenderer.invoke('claudeConfig:createCommand', projectId, data),

  updateClaudeCommand: (
    projectId: string,
    name: string,
    updates: Partial<CreateClaudeCommandData>
  ): Promise<ClaudeCommand> =>
    ipcRenderer.invoke('claudeConfig:updateCommand', projectId, name, updates),

  deleteClaudeCommand: (projectId: string, name: string): Promise<void> =>
    ipcRenderer.invoke('claudeConfig:deleteCommand', projectId, name),

  updateClaudeMd: (projectId: string, content: string): Promise<void> =>
    ipcRenderer.invoke('claudeConfig:updateClaudeMd', projectId, content),

  deleteClaudeMd: (projectId: string): Promise<void> =>
    ipcRenderer.invoke('claudeConfig:deleteClaudeMd', projectId),

  // Event listeners (Main → Renderer)
  onTaskStatusChanged: (callback: (task: TaskManifest) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, task: TaskManifest) => callback(task)
    ipcRenderer.on('task:statusChanged', handler)
    return () => ipcRenderer.removeListener('task:statusChanged', handler)
  },

  onUsageLimitStateChanged: (callback: (state: UsageLimitState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: UsageLimitState) => callback(state)
    ipcRenderer.on('usageLimit:stateChanged', handler)
    return () => ipcRenderer.removeListener('usageLimit:stateChanged', handler)
  },

  onAgentAuthStateChanged: (callback: (state: AgentAuthState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: AgentAuthState) => callback(state)
    ipcRenderer.on('agentAuth:stateChanged', handler)
    return () => ipcRenderer.removeListener('agentAuth:stateChanged', handler)
  },

  onPlanningStreamStart: (callback: (data: { sessionId: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string }) => callback(data)
    ipcRenderer.on('planning:streamStart', handler)
    return () => ipcRenderer.removeListener('planning:streamStart', handler)
  },

  onPlanningChunk: (callback: (data: { sessionId: string; content: string; fullContent: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; content: string; fullContent: string }) => callback(data)
    ipcRenderer.on('planning:chunk', handler)
    return () => ipcRenderer.removeListener('planning:chunk', handler)
  },

  onPlanningComplete: (callback: (data: { sessionId: string; session: PlanningSession }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; session: PlanningSession }) => callback(data)
    ipcRenderer.on('planning:complete', handler)
    return () => ipcRenderer.removeListener('planning:complete', handler)
  },

  onPlanningError: (callback: (data: { sessionId: string; error: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; error: string }) => callback(data)
    ipcRenderer.on('planning:error', handler)
    return () => ipcRenderer.removeListener('planning:error', handler)
  },

  onPlanningCancelled: (callback: (data: { sessionId: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string }) => callback(data)
    ipcRenderer.on('planning:cancelled', handler)
    return () => ipcRenderer.removeListener('planning:cancelled', handler)
  },

  onPlanningSessionUpdate: (callback: (data: { session: PlanningSession }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { session: PlanningSession }) => callback(data)
    ipcRenderer.on('planning:sessionUpdate', handler)
    return () => ipcRenderer.removeListener('planning:sessionUpdate', handler)
  },

  // ============ Documentation ============
  createDocSession: (data: CreateDocSessionData): Promise<DocSession> =>
    ipcRenderer.invoke('docs:createSession', data),

  getDocSession: (sessionId: string): Promise<DocSession | null> =>
    ipcRenderer.invoke('docs:getSession', sessionId),

  listDocSessions: (projectId: string): Promise<DocSession[]> =>
    ipcRenderer.invoke('docs:listSessions', projectId),

  listAllDocSessions: (): Promise<DocSession[]> =>
    ipcRenderer.invoke('docs:listAllSessions'),

  deleteDocSession: (sessionId: string): Promise<boolean> =>
    ipcRenderer.invoke('docs:deleteSession', sessionId),

  updateDocContent: (sessionId: string, content: string): Promise<void> =>
    ipcRenderer.invoke('docs:updateContent', sessionId, content),

  generateDoc: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke('docs:generate', sessionId),

  refineDoc: (sessionId: string, message: string): Promise<void> =>
    ipcRenderer.invoke('docs:refine', sessionId, message),

  commitDoc: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke('docs:commit', sessionId),

  cancelDoc: (sessionId: string): Promise<boolean> =>
    ipcRenderer.invoke('docs:cancel', sessionId),

  getDocTemplates: (): Promise<DocTemplate[]> =>
    ipcRenderer.invoke('docs:getTemplates'),

  getDocTemplate: (type: DocumentationType): Promise<DocTemplate> =>
    ipcRenderer.invoke('docs:getTemplate', type),

  analyzeProjectDocs: (projectId: string): Promise<ExistingDocAnalysis> =>
    ipcRenderer.invoke('docs:analyze', projectId),

  suggestDocs: (projectId: string): Promise<DocSuggestion[]> =>
    ipcRenderer.invoke('docs:suggest', projectId),

  // ============ Project Analysis ============
  analyzeProject: (projectId: string, projectPath: string): Promise<ProjectAnalysis> =>
    ipcRenderer.invoke('analysis:analyze', projectId, projectPath),

  getCachedAnalysis: (projectId: string): Promise<ProjectAnalysis | null> =>
    ipcRenderer.invoke('analysis:getCached', projectId),

  detectTechnologies: (projectPath: string): Promise<DetectedTechnology[]> =>
    ipcRenderer.invoke('analysis:detectTechnologies', projectPath),

  detectPatterns: (projectPath: string): Promise<DetectedPattern[]> =>
    ipcRenderer.invoke('analysis:detectPatterns', projectPath),

  getSkillRecommendations: (projectId: string): Promise<SkillRecommendation[]> =>
    ipcRenderer.invoke('analysis:getRecommendations', projectId),

  createSkillsFromRecommendations: (
    projectId: string,
    projectPath: string,
    recommendationIds: string[]
  ): Promise<ClaudeSkill[]> =>
    ipcRenderer.invoke('analysis:createSkills', projectId, projectPath, recommendationIds),

  clearAnalysisCache: (projectId: string): Promise<void> =>
    ipcRenderer.invoke('analysis:clearCache', projectId),

  onAnalysisProgress: (
    callback: (data: { projectId: string; progress: AnalysisProgress }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { projectId: string; progress: AnalysisProgress }
    ) => callback(data)
    ipcRenderer.on('analysis:progress', handler)
    return () => ipcRenderer.removeListener('analysis:progress', handler)
  },

  // ============ Integrations (Connection + Source Model) ============

  // Connection management
  listConnections: (): Promise<IntegrationConnection[]> =>
    ipcRenderer.invoke('connection:list'),

  getConnection: (id: string): Promise<IntegrationConnection | null> =>
    ipcRenderer.invoke('connection:get', id),

  createConnection: (data: CreateConnectionData, token: string): Promise<IntegrationConnection> =>
    ipcRenderer.invoke('connection:create', data, token),

  updateConnection: (
    id: string,
    updates: Partial<Omit<IntegrationConnection, 'id' | 'createdAt'>>
  ): Promise<IntegrationConnection | null> =>
    ipcRenderer.invoke('connection:update', id, updates),

  deleteConnection: (id: string): Promise<boolean> =>
    ipcRenderer.invoke('connection:delete', id),

  testConnection: (id: string): Promise<IntegrationTestResult> =>
    ipcRenderer.invoke('connection:test', id),

  updateConnectionToken: (id: string, token: string): Promise<void> =>
    ipcRenderer.invoke('connection:updateToken', id, token),

  // Source management
  listSources: (): Promise<IntegrationSource[]> =>
    ipcRenderer.invoke('source:list'),

  getSource: (id: string): Promise<IntegrationSource | null> =>
    ipcRenderer.invoke('source:get', id),

  listSourcesForConnection: (connectionId: string): Promise<IntegrationSource[]> =>
    ipcRenderer.invoke('source:listForConnection', connectionId),

  createSource: (data: CreateSourceData): Promise<IntegrationSource> =>
    ipcRenderer.invoke('source:create', data),

  updateSource: (
    id: string,
    updates: Partial<Omit<IntegrationSource, 'id' | 'createdAt' | 'connectionId'>>
  ): Promise<IntegrationSource | null> =>
    ipcRenderer.invoke('source:update', id, updates),

  deleteSource: (id: string): Promise<boolean> =>
    ipcRenderer.invoke('source:delete', id),

  fetchSourceIssues: (sourceId: string, options?: FetchIssuesOptions): Promise<ExternalIssue[]> =>
    ipcRenderer.invoke('source:fetchIssues', sourceId, options),

  importSourceIssueAsTask: (
    sourceId: string,
    issueId: string,
    projectId: string
  ): Promise<TaskManifest> =>
    ipcRenderer.invoke('source:importAsTask', sourceId, issueId, projectId),

  createSourcePR: (sourceId: string, taskId: string, options: CreatePROptions): Promise<CreatePRResult> =>
    ipcRenderer.invoke('source:createPR', sourceId, taskId, options),

  // Jira discovery
  listJiraBoards: (connectionId: string): Promise<JiraBoard[]> =>
    ipcRenderer.invoke('jira:listBoards', connectionId),

  listJiraSprints: (connectionId: string, boardId: number): Promise<JiraSprint[]> =>
    ipcRenderer.invoke('jira:listSprints', connectionId, boardId),

  listJiraFilters: (connectionId: string): Promise<JiraFilter[]> =>
    ipcRenderer.invoke('jira:listFilters', connectionId),

  listJiraProjects: (connectionId: string): Promise<JiraProject[]> =>
    ipcRenderer.invoke('jira:listProjects', connectionId),

  // ============ Legacy Integrations (Backward Compatibility) ============
  listIntegrations: (): Promise<Integration[]> =>
    ipcRenderer.invoke('integration:list'),

  getIntegration: (id: string): Promise<Integration | null> =>
    ipcRenderer.invoke('integration:get', id),

  createIntegration: (data: CreateIntegrationData): Promise<Integration> =>
    ipcRenderer.invoke('integration:create', data),

  updateIntegration: (
    id: string,
    updates: Partial<Omit<Integration, 'id' | 'createdAt'>>
  ): Promise<Integration | null> =>
    ipcRenderer.invoke('integration:update', id, updates),

  deleteIntegration: (id: string): Promise<boolean> =>
    ipcRenderer.invoke('integration:delete', id),

  testIntegration: (id: string): Promise<IntegrationTestResult> =>
    ipcRenderer.invoke('integration:test', id),

  fetchIntegrationIssues: (
    integrationId: string,
    options?: FetchIssuesOptions
  ): Promise<ExternalIssue[]> =>
    ipcRenderer.invoke('integration:fetchIssues', integrationId, options),

  getIntegrationIssue: (integrationId: string, issueId: string): Promise<ExternalIssue | null> =>
    ipcRenderer.invoke('integration:getIssue', integrationId, issueId),

  importIssueAsTask: (
    integrationId: string,
    issueId: string,
    projectId: string
  ): Promise<TaskManifest> =>
    ipcRenderer.invoke('integration:importAsTask', integrationId, issueId, projectId),

  createPullRequest: (
    integrationId: string,
    taskId: string,
    options: CreatePROptions
  ): Promise<CreatePRResult> =>
    ipcRenderer.invoke('integration:createPR', integrationId, taskId, options),

  transitionJiraIssue: (
    integrationId: string,
    issueId: string,
    transitionId: string
  ): Promise<boolean> =>
    ipcRenderer.invoke('integration:transitionIssue', integrationId, issueId, transitionId),

  listIntegrationsForProject: (projectId: string): Promise<Integration[]> =>
    ipcRenderer.invoke('integration:listForProject', projectId),

  // Documentation event listeners
  onDocStreamStart: (callback: (data: { sessionId: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string }) => callback(data)
    ipcRenderer.on('docs:streamStart', handler)
    return () => ipcRenderer.removeListener('docs:streamStart', handler)
  },

  onDocChunk: (callback: (data: { sessionId: string; content: string; fullContent: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; content: string; fullContent: string }) => callback(data)
    ipcRenderer.on('docs:chunk', handler)
    return () => ipcRenderer.removeListener('docs:chunk', handler)
  },

  onDocComplete: (callback: (data: { sessionId: string; session: DocSession }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; session: DocSession }) => callback(data)
    ipcRenderer.on('docs:complete', handler)
    return () => ipcRenderer.removeListener('docs:complete', handler)
  },

  onDocError: (callback: (data: { sessionId: string; error: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; error: string }) => callback(data)
    ipcRenderer.on('docs:error', handler)
    return () => ipcRenderer.removeListener('docs:error', handler)
  },

  onDocCancelled: (callback: (data: { sessionId: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string }) => callback(data)
    ipcRenderer.on('docs:cancelled', handler)
    return () => ipcRenderer.removeListener('docs:cancelled', handler)
  },

  onDocCommitted: (callback: (data: { sessionId: string; path: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; path: string }) => callback(data)
    ipcRenderer.on('docs:committed', handler)
    return () => ipcRenderer.removeListener('docs:committed', handler)
  }
}

// Expose API to renderer via window.api
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose API:', error)
  }
} else {
  // @ts-ignore (fallback for non-isolated context)
  window.api = api
}
