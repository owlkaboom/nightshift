/**
 * Type-safe IPC channel definitions
 * Shared between main, preload, and renderer processes
 */

import type { FileFilter } from 'electron'
import type {
  Project,
  TaskManifest,
  AppConfig,
  TaskStatus,
  AgentCapabilities,
  AgentOutputEvent,
  AgentModelInfo,
  PlanningSession,
  ExtractedPlanItem,
  CreatePlanningSessionData,
  ContextAttachment,
  Note,
  NoteStatus,
  CreateNoteData,
  NoteGroup,
  CreateNoteGroupData,
  ClaudeAgent,
  ClaudeCommand,
  ClaudeProjectConfig,
  CreateClaudeAgentData,
  CreateClaudeCommandData,
  ClaudeMdAnalysis,
  ClaudeMdSubFile,
  DocSession,
  CreateDocSessionData,
  DocumentationType,
  DocTemplate,
  ExistingDocAnalysis,
  DocSuggestion,
  ProjectAnalysis,
  DetectedTechnology,
  DetectedPattern,
  SkillRecommendation,
  AnalysisProgress,
  Tag,
  Integration,
  IntegrationConnection,
  IntegrationSource,
  CreateIntegrationData,
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
  JiraProject,
  JiraStatus,
  FetchIssuesResult,
  // Git types
  BranchInfo,
  FileStatus,
  FileDiff,
  CommitInfo,
  CommitResult,
  RemoteStatus,
  FetchResult,
  PullResult,
  PushResult,
  PushOptions,
  StashEntry,
  StashSaveOptions,
  StashSaveResult
} from './types'

// ============ Project Channels ============

export interface AddProjectData {
  name: string
  path: string
  gitUrl?: string | null
  defaultBranch?: string | null
  includeClaudeMd?: boolean
}

export interface ScannedRepo {
  path: string
  gitUrl: string | null
  name: string
  defaultBranch: string | null
  currentBranch: string | null
  alreadyAdded: boolean
  existingProjectId: string | null
  warning: string | null
}

export interface ScanProgress {
  current: number
  total: number
  currentPath: string
}

export interface GitConversionCheck {
  canConvert: boolean
  gitUrl: string | null
  defaultBranch: string | null
  error?: string
}

export interface ProjectHandlers {
  'project:list': () => Promise<Project[]>
  'project:get': (id: string) => Promise<Project | null>
  'project:add': (data: AddProjectData) => Promise<Project>
  'project:update': (id: string, updates: Partial<Project>) => Promise<Project | null>
  'project:remove': (id: string) => Promise<boolean>
  'project:setPath': (id: string, path: string) => Promise<void>
  'project:getPath': (id: string) => Promise<string | null>
  'project:generateDescription': (id: string) => Promise<string>
  'project:scanDirectory': (rootPath: string) => Promise<ScannedRepo[]>
  'project:checkGitConversion': (id: string) => Promise<GitConversionCheck>
  'project:convertToGit': (id: string) => Promise<Project | null>
}

// ============ Task Channels ============

export interface CreateTaskData {
  prompt: string
  projectId: string
  groupId?: string | null
  contextFiles?: string[]
  includeClaudeMd?: boolean
  agentId?: string | null
  model?: string | null
  thinkingMode?: boolean | null
  planFilePath?: string | null
}

export interface ReorderTaskData {
  projectId: string
  taskId: string
  queuePosition: number
}

export interface RetryContextResult {
  /** The generated retry prompt with context */
  prompt: string
  /** Summary of what was attempted */
  summary: string
  /** Number of actions that were taken */
  actionCount: number
  /** Whether any meaningful progress was made */
  hasProgress: boolean
}

export interface FormattedPrompt {
  title: string
  content: string
}

export interface TaskHandlers {
  'task:list': (projectId: string) => Promise<TaskManifest[]>
  'task:listAll': () => Promise<TaskManifest[]>
  'task:listQueued': () => Promise<TaskManifest[]>
  'task:listCompletedByDateRange': (
    startDate: string,
    endDate: string,
    projectId?: string
  ) => Promise<TaskManifest[]>
  'task:get': (projectId: string, taskId: string) => Promise<TaskManifest | null>
  'task:create': (data: CreateTaskData) => Promise<TaskManifest>
  'task:update': (
    projectId: string,
    taskId: string,
    updates: Partial<TaskManifest>
  ) => Promise<TaskManifest | null>
  'task:delete': (projectId: string, taskId: string) => Promise<boolean>
  'task:updateStatus': (
    projectId: string,
    taskId: string,
    status: TaskStatus
  ) => Promise<TaskManifest | null>
  'task:readLog': (projectId: string, taskId: string) => Promise<string | null>
  'task:readIterationLog': (
    projectId: string,
    taskId: string,
    iteration: number
  ) => Promise<string | null>
  'task:readPlanFile': (planFilePath: string) => Promise<string | null>
  'task:accept': (projectId: string, taskId: string) => Promise<TaskManifest | null>
  'task:reject': (projectId: string, taskId: string) => Promise<TaskManifest | null>
  'task:reprompt': (
    projectId: string,
    taskId: string,
    newPrompt: string
  ) => Promise<TaskManifest | null>
  'task:reply': (
    projectId: string,
    taskId: string,
    replyMessage: string
  ) => Promise<TaskManifest | null>
  'task:acceptPlanAndCreateTask': (
    projectId: string,
    taskId: string,
    executionPrompt: string
  ) => Promise<{ planTask: TaskManifest; executionTask: TaskManifest }>
  'task:reorder': (updates: ReorderTaskData[]) => Promise<TaskManifest[]>
  'task:generateRetryContext': (
    projectId: string,
    taskId: string,
    iteration?: number
  ) => Promise<RetryContextResult | null>
  'task:formatVoicePrompt': (rawPrompt: string) => Promise<FormattedPrompt>
}

// ============ Tag Channels ============

export interface TagHandlers {
  'tag:list': () => Promise<Tag[]>
  'tag:get': (id: string) => Promise<Tag | null>
  'tag:create': (name: string, color?: string) => Promise<Tag>
  'tag:update': (id: string, updates: Partial<Omit<Tag, 'id' | 'createdAt'>>) => Promise<Tag | null>
  'tag:delete': (id: string) => Promise<boolean>
  'tag:getByIds': (ids: string[]) => Promise<Tag[]>
  'tag:search': (query: string) => Promise<Tag[]>
}

// ============ Config Channels ============

export interface ConfigHandlers {
  'config:get': () => Promise<AppConfig>
  'config:update': (updates: Partial<AppConfig>) => Promise<AppConfig>
  'config:reset': () => Promise<AppConfig>
  'config:getClaudeCodePath': () => Promise<string>
  'config:setClaudeCodePath': (path: string) => Promise<void>
  'config:getSelectedProjectId': () => Promise<string | null>
  'config:setSelectedProjectId': (projectId: string | null) => Promise<void>
}

// ============ Agent Config Channels ============

export interface AgentConfigInfo {
  id: string
  name: string
  enabled: boolean
  available: boolean
  hasApiKey: boolean
  requiresApiKey: boolean
  tier?: string
  customPath?: string
  executablePath: string | null
  capabilities: AgentCapabilities
}

export interface SecureStorageInfo {
  isEncryptionAvailable: boolean
  storageBackend: string
}

export interface AgentConfigHandlers {
  'agentConfig:list': () => Promise<AgentConfigInfo[]>
  'agentConfig:get': (agentId: string) => Promise<AgentConfigInfo | null>
  'agentConfig:getSelected': () => Promise<string>
  'agentConfig:setSelected': (agentId: string) => Promise<void>
  'agentConfig:setEnabled': (agentId: string, enabled: boolean) => Promise<void>
  'agentConfig:setApiKey': (agentId: string, apiKey: string) => Promise<void>
  'agentConfig:deleteApiKey': (agentId: string) => Promise<void>
  'agentConfig:hasApiKey': (agentId: string) => Promise<boolean>
  'agentConfig:setTier': (agentId: string, tier: string) => Promise<void>
  'agentConfig:setCustomPath': (agentId: string, path: string | null) => Promise<void>
  'agentConfig:setSetting': (agentId: string, key: string, value: unknown) => Promise<void>
  'agentConfig:getSetting': (agentId: string, key: string) => Promise<unknown>
  'agentConfig:validateApiKey': (agentId: string, apiKey: string) => Promise<{ valid: boolean; error?: string }>
  'agentConfig:getSecureStorageInfo': () => Promise<SecureStorageInfo>
  'agentConfig:testCli': (agentId: string) => Promise<{ success: boolean; version?: string; error?: string }>
}

// ============ System Channels ============

export interface SystemHandlers {
  'system:selectDirectory': () => Promise<string | null>
  'system:selectFile': (filters?: FileFilter[]) => Promise<string | null>
  'system:openExternal': (url: string) => Promise<void>
  'system:openPath': (path: string) => Promise<void>
  'system:getVersion': () => Promise<string>
  'system:getChangelog': () => Promise<string>
  'system:openChangelog': () => Promise<void>
  'system:getPlatform': () => Promise<NodeJS.Platform>
  'system:getStorageStatus': () => Promise<{
    initialized: boolean
    configLoaded: boolean
    localStateLoaded: boolean
    projectCount: number
    groupCount: number
    error: string | null
  }>
  'system:testNotification': () => Promise<void>
  'system:previewNotificationSound': (soundName: string, customPath?: string) => Promise<void>
  'system:getStartupStatus': () => Promise<{
    stage: string
    message: string
    complete: boolean
  }>
  'system:copyNotificationSound': (sourcePath: string) => Promise<string>
}

// ============ Git Channels ============

export interface GitRepoInfo {
  isRepo: boolean
  rootPath: string | null
  remoteUrl: string | null
  currentBranch: string | null
  defaultBranch: string | null
  isDirty: boolean
  hasRemote: boolean
}

export interface GitHandlers {
  // Existing handlers
  'git:getRepoInfo': (path: string) => Promise<GitRepoInfo>
  'git:extractRepoName': (gitUrl: string) => Promise<string>
  'git:normalizeUrl': (gitUrl: string) => Promise<string>
  'git:getCurrentBranch': (projectId: string) => Promise<string | null>

  // Branch operations
  'git:listBranches': (projectId: string) => Promise<BranchInfo[]>
  'git:createBranch': (projectId: string, name: string, startPoint?: string) => Promise<void>
  'git:checkoutBranch': (projectId: string, name: string) => Promise<void>
  'git:deleteBranch': (projectId: string, name: string, force?: boolean) => Promise<void>

  // Status & staging
  'git:getStatus': (projectId: string) => Promise<FileStatus[]>
  'git:stageFiles': (projectId: string, files: string[]) => Promise<void>
  'git:unstageFiles': (projectId: string, files: string[]) => Promise<void>
  'git:stageAll': (projectId: string) => Promise<void>
  'git:unstageAll': (projectId: string) => Promise<void>
  'git:discardChanges': (projectId: string, file: string) => Promise<void>
  'git:discardAllChanges': (projectId: string) => Promise<void>

  // Diff operations
  'git:getDiff': (projectId: string, options?: { file?: string; staged?: boolean }) => Promise<string>
  'git:getFileDiff': (projectId: string, file: string, staged?: boolean) => Promise<FileDiff>

  // Commit operations
  'git:commit': (projectId: string, message: string) => Promise<CommitResult>
  'git:getRecentCommits': (projectId: string, count?: number) => Promise<CommitInfo[]>
  'git:generateCommitMessage': (projectId: string) => Promise<string>

  // Remote operations
  'git:getRemoteStatus': (projectId: string) => Promise<RemoteStatus>
  'git:fetch': (projectId: string, remote?: string) => Promise<FetchResult>
  'git:pull': (projectId: string, remote?: string, branch?: string) => Promise<PullResult>
  'git:push': (projectId: string, remote?: string, branch?: string, options?: PushOptions) => Promise<PushResult>

  // Stash operations
  'git:stashList': (projectId: string) => Promise<StashEntry[]>
  'git:stashSave': (projectId: string, options?: StashSaveOptions) => Promise<StashSaveResult>
  'git:stashApply': (projectId: string, index?: number) => Promise<void>
  'git:stashPop': (projectId: string, index?: number) => Promise<void>
  'git:stashDrop': (projectId: string, index?: number) => Promise<void>
}

// ============ Agent Channels ============

export interface AgentInfo {
  id: string
  name: string
  available: boolean
  executablePath: string | null
  capabilities: AgentCapabilities
}

export interface RunningTaskInfo {
  processType: 'task'
  taskId: string
  projectId: string
  agentId: string
  pid: number
  state: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'timed_out'
  startedAt: string
  outputLogLength: number
  /** Elapsed runtime in milliseconds */
  elapsedMs: number
  /** Error message if failed or timed out */
  error?: string
}

export interface RunningChatInfo {
  processType: 'chat'
  sessionId: string
  projectId: string
  agentId: string
  pid: number
  state: 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  /** Session type (general, init, claude-md) */
  sessionType: string
  /** Number of messages in the session */
  messageCount: number
  /** Length of currently streaming content */
  streamingContentLength: number
  /** Elapsed runtime in milliseconds */
  elapsedMs: number
  /** Error message if failed */
  error?: string
}

export type RunningProcessInfo = RunningTaskInfo | RunningChatInfo

export interface UsageLimitCheckResult {
  /** Whether we can proceed with the task */
  canProceed: boolean
  /** When the limit resets (ISO string), if known */
  resetAt?: string
  /** Human-readable message about the limit */
  message?: string
}

export interface AgentHandlers {
  'agent:list': () => Promise<AgentInfo[]>
  'agent:getAvailable': () => Promise<AgentInfo[]>
  'agent:getDefault': () => Promise<AgentInfo>
  'agent:isAvailable': (agentId: string) => Promise<boolean>
  'agent:getModels': (agentId: string) => Promise<AgentModelInfo[]>
  'agent:getDefaultModel': (agentId: string) => Promise<string | null>
  'agent:startTask': (projectId: string, taskId: string) => Promise<boolean>
  'agent:cancelTask': (taskId: string) => Promise<boolean>
  'agent:getRunningTasks': () => Promise<RunningProcessInfo[]>
  'agent:getTaskOutput': (taskId: string) => Promise<AgentOutputEvent[]>
  'agent:getUsageLimitState': () => Promise<UsageLimitState>
  'agent:clearUsageLimit': () => Promise<void>
  'agent:checkUsageLimits': () => Promise<UsageLimitCheckResult>
  'agent:getUsagePercentage': () => Promise<UsagePercentageState>
  'agent:checkAuth': (agentId: string) => Promise<AgentAuthState>
  'agent:getAuthStates': () => Promise<AgentAuthState[]>
  'agent:triggerReauth': (
    agentId: string,
    projectPath?: string
  ) => Promise<{ success: boolean; error?: string }>
}

// ============ Memory Channels ============

import type { ProjectMemory, MemoryCategory, MemoryEntry, CodebaseStructure } from './types'

export interface MemoryStats {
  entryCount: number
  recentTaskCount: number
  hasStructure: boolean
  hasSessionId: boolean
  totalEntriesCreated: number
  totalEntriesExpired: number
  lastUsedAt: string
}

export interface AddMemoryEntryData {
  projectId: string
  category: MemoryCategory
  content: string
  source: string
}

export interface MemoryHandlers {
  'memory:get': (projectId: string) => Promise<ProjectMemory>
  'memory:getContext': (projectId: string) => Promise<string>
  'memory:getStats': (projectId: string) => Promise<MemoryStats>
  'memory:addEntry': (data: AddMemoryEntryData) => Promise<MemoryEntry>
  'memory:updateStructure': (projectId: string, structure: CodebaseStructure) => Promise<void>
  'memory:compact': (projectId: string) => Promise<number>
  'memory:clear': (projectId: string) => Promise<void>
  'memory:hasMemory': (projectId: string) => Promise<boolean>
}

// ============ Planning Channels ============

export interface SendPlanningMessageData {
  sessionId: string
  content: string
  contextAttachments?: ContextAttachment[]
}

export interface UpdatePlanItemData {
  sessionId: string
  itemId: string
  updates: Partial<ExtractedPlanItem>
}

export interface AddContextAttachmentData {
  sessionId: string
  attachment: ContextAttachment
}

export interface RemoveContextAttachmentData {
  sessionId: string
  attachmentId: string
}

export interface LoadContextContentData {
  attachment: ContextAttachment
}

export interface PlanningHandlers {
  'planning:create': (data: CreatePlanningSessionData) => Promise<PlanningSession>
  'planning:get': (sessionId: string) => Promise<PlanningSession | null>
  'planning:list': (projectId: string) => Promise<PlanningSession[]>
  'planning:listAll': () => Promise<PlanningSession[]>
  'planning:delete': (sessionId: string) => Promise<boolean>
  'planning:sendMessage': (data: SendPlanningMessageData) => Promise<void>
  'planning:interruptAndSend': (data: SendPlanningMessageData) => Promise<void>
  'planning:cancelResponse': (sessionId: string) => Promise<boolean>
  'planning:updatePlanItems': (sessionId: string, items: ExtractedPlanItem[]) => Promise<PlanningSession | null>
  'planning:convertToTasks': (sessionId: string, itemIds: string[]) => Promise<TaskManifest[]>
  'planning:addContextAttachment': (data: AddContextAttachmentData) => Promise<PlanningSession | null>
  'planning:removeContextAttachment': (data: RemoveContextAttachmentData) => Promise<PlanningSession | null>
  'planning:loadContextContent': (data: LoadContextContentData) => Promise<ContextAttachment>
  'planning:readPlanFile': (projectId: string, filePath: string) => Promise<string>
}

// ============ Note Channels ============

export interface NoteHandlers {
  'note:list': () => Promise<Note[]>
  'note:get': (noteId: string) => Promise<Note | null>
  'note:create': (data: CreateNoteData) => Promise<Note>
  'note:update': (noteId: string, updates: Partial<Note>) => Promise<Note | null>
  'note:delete': (noteId: string) => Promise<boolean>
  'note:search': (query: string) => Promise<Note[]>
  'note:listByProject': (projectId: string) => Promise<Note[]>
  'note:listReferencingProject': (projectId: string) => Promise<Note[]>
  'note:listReferencingGroup': (groupId: string) => Promise<Note[]>
  'note:listRecent': (limit?: number) => Promise<Note[]>
  'note:listPinned': () => Promise<Note[]>
  'note:listByStatus': (status: NoteStatus) => Promise<Note[]>
  'note:listByTag': (tag: string) => Promise<Note[]>
  'note:togglePin': (noteId: string) => Promise<Note | null>
  'note:archive': (noteId: string) => Promise<Note | null>
  'note:unarchive': (noteId: string) => Promise<Note | null>
  'note:linkToTask': (noteId: string, taskId: string) => Promise<Note | null>
  'note:unlinkFromTask': (noteId: string, taskId: string) => Promise<Note | null>
  'note:linkToPlanning': (noteId: string, planningId: string) => Promise<Note | null>
  'note:unlinkFromPlanning': (noteId: string, planningId: string) => Promise<Note | null>
  'note:getAllTags': () => Promise<string[]>
  'note:reorder': (noteOrders: Array<{ id: string; order: number; groupId?: string | null }>) => Promise<void>
  'note:moveToGroup': (noteId: string, groupId: string | null) => Promise<Note | null>
  'note:listByGroup': (groupId: string | null) => Promise<Note[]>
}

// ============ Note Group Channels ============

export interface NoteGroupHandlers {
  'noteGroup:list': () => Promise<NoteGroup[]>
  'noteGroup:get': (id: string) => Promise<NoteGroup | null>
  'noteGroup:create': (data: CreateNoteGroupData) => Promise<NoteGroup>
  'noteGroup:update': (id: string, updates: Partial<NoteGroup>) => Promise<NoteGroup | null>
  'noteGroup:delete': (id: string) => Promise<boolean>
  'noteGroup:reorder': (groupOrders: Array<{ id: string; order: number }>) => Promise<void>
  'noteGroup:toggleCollapsed': (id: string) => Promise<NoteGroup | null>
}

// ============ Whisper Channels ============

export interface WhisperModelInfo {
  key: string
  id: string
  name: string
  size: string
  description: string
}

export interface WhisperStatus {
  isReady: boolean
  isLoading: boolean
  currentModel: string | null
  error: string | null
  progress: number
}

export interface TranscriptionResult {
  text: string
  chunks?: Array<{
    timestamp: [number, number]
    text: string
  }>
}

export interface WhisperHandlers {
  'whisper:getStatus': () => Promise<WhisperStatus>
  'whisper:getModels': () => Promise<WhisperModelInfo[]>
  'whisper:loadModel': (modelKey: string) => Promise<{ success: boolean; error?: string }>
  'whisper:unloadModel': () => Promise<{ success: boolean }>
  'whisper:transcribe': (
    audioBase64: string,
    options?: { language?: string; returnTimestamps?: boolean }
  ) => Promise<{ success: boolean; result?: TranscriptionResult; error?: string }>
}

// ============ Claude Config Channels ============

export interface ClaudeConfigHandlers {
  // Project scanning
  'claudeConfig:scan': (projectId: string) => Promise<ClaudeProjectConfig>
  'claudeConfig:getAgents': (projectId: string) => Promise<ClaudeAgent[]>
  'claudeConfig:getCommands': (projectId: string) => Promise<ClaudeCommand[]>

  // Agent operations
  'claudeConfig:createAgent': (projectId: string, data: CreateClaudeAgentData) => Promise<ClaudeAgent>
  'claudeConfig:updateAgent': (projectId: string, name: string, updates: Partial<CreateClaudeAgentData>) => Promise<ClaudeAgent>
  'claudeConfig:deleteAgent': (projectId: string, name: string) => Promise<void>

  // Command operations
  'claudeConfig:createCommand': (projectId: string, data: CreateClaudeCommandData) => Promise<ClaudeCommand>
  'claudeConfig:updateCommand': (projectId: string, name: string, updates: Partial<CreateClaudeCommandData>) => Promise<ClaudeCommand>
  'claudeConfig:deleteCommand': (projectId: string, name: string) => Promise<void>

  // CLAUDE.md operations
  'claudeConfig:updateClaudeMd': (projectId: string, content: string) => Promise<void>
  'claudeConfig:deleteClaudeMd': (projectId: string) => Promise<void>

  // CLAUDE.md analysis operations
  'claudeConfig:analyze': (projectId: string) => Promise<ClaudeMdAnalysis>
  'claudeConfig:getSubFiles': (projectId: string) => Promise<ClaudeMdSubFile[]>
  'claudeConfig:createSubFile': (projectId: string, name: string, content: string) => Promise<void>
  'claudeConfig:updateSubFile': (projectId: string, name: string, content: string) => Promise<void>
  'claudeConfig:deleteSubFile': (projectId: string, name: string) => Promise<void>
  'claudeConfig:readSubFile': (projectId: string, name: string) => Promise<string>
}

// ============ Documentation Channels ============

export interface DocHandlers {
  // Session management
  'docs:createSession': (data: CreateDocSessionData) => Promise<DocSession>
  'docs:getSession': (sessionId: string) => Promise<DocSession | null>
  'docs:listSessions': (projectId: string) => Promise<DocSession[]>
  'docs:listAllSessions': () => Promise<DocSession[]>
  'docs:deleteSession': (sessionId: string) => Promise<boolean>
  'docs:updateContent': (sessionId: string, content: string) => Promise<void>
  'docs:generate': (sessionId: string) => Promise<void>
  'docs:refine': (sessionId: string, message: string) => Promise<void>
  'docs:commit': (sessionId: string) => Promise<void>
  'docs:cancel': (sessionId: string) => Promise<boolean>

  // Templates
  'docs:getTemplates': () => Promise<DocTemplate[]>
  'docs:getTemplate': (type: DocumentationType) => Promise<DocTemplate>

  // Analysis
  'docs:analyze': (projectId: string) => Promise<ExistingDocAnalysis>
  'docs:suggest': (projectId: string) => Promise<DocSuggestion[]>
}

// ============ Analysis Channels ============

export interface AnalysisHandlers {
  /** Analyze a project to detect technologies and suggest skills */
  'analysis:analyze': (projectId: string) => Promise<ProjectAnalysis>

  /** Get cached analysis for a project (if available) */
  'analysis:getCached': (projectId: string) => Promise<ProjectAnalysis | null>

  /** Detect technologies in a project */
  'analysis:detectTechnologies': (projectId: string) => Promise<DetectedTechnology[]>

  /** Detect coding patterns in a project */
  'analysis:detectPatterns': (projectId: string) => Promise<DetectedPattern[]>

  /** Get skill recommendations based on analysis */
  'analysis:getRecommendations': (projectId: string) => Promise<SkillRecommendation[]>

  /** Clear cached analysis for a project */
  'analysis:clearCache': (projectId: string) => Promise<void>
}

// ============ Integration Channels (Connection + Source Model) ============

// Connection Handlers
export interface ConnectionHandlers {
  /** List all connections */
  'connection:list': () => Promise<IntegrationConnection[]>

  /** Get a single connection by ID */
  'connection:get': (id: string) => Promise<IntegrationConnection | null>

  /** Create a new connection */
  'connection:create': (data: CreateConnectionData, token: string) => Promise<IntegrationConnection>

  /** Update an existing connection */
  'connection:update': (
    id: string,
    updates: Partial<Omit<IntegrationConnection, 'id' | 'createdAt'>>
  ) => Promise<IntegrationConnection | null>

  /** Delete a connection and all its sources */
  'connection:delete': (id: string) => Promise<boolean>

  /** Test a connection */
  'connection:test': (id: string) => Promise<IntegrationTestResult>

  /** Update connection token */
  'connection:updateToken': (id: string, token: string) => Promise<void>
}

// Source Handlers
export interface SourceHandlers {
  /** List all sources */
  'source:list': () => Promise<IntegrationSource[]>

  /** Get a single source by ID */
  'source:get': (id: string) => Promise<IntegrationSource | null>

  /** Get all sources for a connection */
  'source:listForConnection': (connectionId: string) => Promise<IntegrationSource[]>

  /** Create a new source */
  'source:create': (data: CreateSourceData) => Promise<IntegrationSource>

  /** Update an existing source */
  'source:update': (
    id: string,
    updates: Partial<Omit<IntegrationSource, 'id' | 'createdAt' | 'connectionId'>>
  ) => Promise<IntegrationSource | null>

  /** Delete a source */
  'source:delete': (id: string) => Promise<boolean>

  /** Fetch issues from a source */
  'source:fetchIssues': (
    sourceId: string,
    options?: FetchIssuesOptions
  ) => Promise<FetchIssuesResult>

  /** Import an issue from a source as a task */
  'source:importAsTask': (
    sourceId: string,
    issueId: string,
    projectId: string
  ) => Promise<TaskManifest>

  /** Create a pull request from a source (GitHub only) */
  'source:createPR': (
    sourceId: string,
    taskId: string,
    options: CreatePROptions
  ) => Promise<CreatePRResult>
}

// Jira Discovery Handlers
export interface JiraDiscoveryHandlers {
  /** List boards for a Jira connection */
  'jira:listBoards': (connectionId: string) => Promise<JiraBoard[]>

  /** List sprints for a Jira board */
  'jira:listSprints': (connectionId: string, boardId: number) => Promise<JiraSprint[]>

  /** List filters for a Jira connection */
  'jira:listFilters': (connectionId: string) => Promise<JiraFilter[]>

  /** List projects for a Jira connection */
  'jira:listProjects': (connectionId: string) => Promise<JiraProject[]>

  /** List statuses for a Jira connection */
  'jira:listStatuses': (connectionId: string) => Promise<JiraStatus[]>
}

// Legacy Integration Handlers (for backward compatibility)
export interface IntegrationHandlers {
  /** @deprecated List all integrations */
  'integration:list': () => Promise<Integration[]>

  /** @deprecated Get a single integration by ID */
  'integration:get': (id: string) => Promise<Integration | null>

  /** @deprecated Create a new integration */
  'integration:create': (data: CreateIntegrationData) => Promise<Integration>

  /** @deprecated Update an existing integration */
  'integration:update': (
    id: string,
    updates: Partial<Omit<Integration, 'id' | 'createdAt'>>
  ) => Promise<Integration | null>

  /** @deprecated Delete an integration */
  'integration:delete': (id: string) => Promise<boolean>

  /** @deprecated Test integration connection */
  'integration:test': (id: string) => Promise<IntegrationTestResult>

  /** @deprecated Fetch issues from an integration */
  'integration:fetchIssues': (
    integrationId: string,
    options?: FetchIssuesOptions
  ) => Promise<ExternalIssue[]>

  /** @deprecated Get a single issue from an integration */
  'integration:getIssue': (integrationId: string, issueId: string) => Promise<ExternalIssue | null>

  /** @deprecated Import an external issue as a task */
  'integration:importAsTask': (
    integrationId: string,
    issueId: string,
    projectId: string
  ) => Promise<TaskManifest>

  /** @deprecated Create a pull request (GitHub only) */
  'integration:createPR': (
    integrationId: string,
    taskId: string,
    options: CreatePROptions
  ) => Promise<CreatePRResult>

  /** @deprecated Transition a JIRA issue status */
  'integration:transitionIssue': (
    integrationId: string,
    issueId: string,
    transitionId: string
  ) => Promise<boolean>

  /** @deprecated Get integrations for a specific project */
  'integration:listForProject': (projectId: string) => Promise<Integration[]>
}

// ============ Combined Handler Types ============

export type IpcHandlers = ProjectHandlers &
  TaskHandlers &
  TagHandlers &
  ConfigHandlers &
  AgentConfigHandlers &
  SystemHandlers &
  GitHandlers &
  AgentHandlers &
  MemoryHandlers &
  PlanningHandlers &
  NoteHandlers &
  WhisperHandlers &
  ClaudeConfigHandlers &
  DocHandlers &
  AnalysisHandlers &
  ConnectionHandlers &
  SourceHandlers &
  JiraDiscoveryHandlers &
  IntegrationHandlers

export type IpcChannel = keyof IpcHandlers

// Helper type to extract the return type of a handler
export type IpcReturnType<C extends IpcChannel> = Awaited<ReturnType<IpcHandlers[C]>>

// Helper type to extract the parameters of a handler
export type IpcParams<C extends IpcChannel> = Parameters<IpcHandlers[C]>

// ============ Renderer API Type ============

/**
 * The API exposed to the renderer process via contextBridge
 * This type should be used for window.api
 */
export interface RendererApi {
  // Projects
  listProjects: () => Promise<Project[]>
  getProject: (id: string) => Promise<Project | null>
  addProject: (data: AddProjectData) => Promise<Project>
  updateProject: (id: string, updates: Partial<Project>) => Promise<Project | null>
  removeProject: (id: string) => Promise<boolean>
  setProjectPath: (id: string, path: string) => Promise<void>
  getProjectPath: (id: string) => Promise<string | null>
  generateProjectDescription: (id: string) => Promise<string>
  scanDirectory: (rootPath: string) => Promise<ScannedRepo[]>
  checkGitConversion: (id: string) => Promise<GitConversionCheck>
  convertToGit: (id: string) => Promise<Project | null>

  // Tasks
  listTasks: (projectId: string) => Promise<TaskManifest[]>
  listAllTasks: () => Promise<TaskManifest[]>
  listQueuedTasks: () => Promise<TaskManifest[]>
  listCompletedTasksByDateRange: (
    startDate: string,
    endDate: string,
    projectId?: string
  ) => Promise<TaskManifest[]>
  getTask: (projectId: string, taskId: string) => Promise<TaskManifest | null>
  createTask: (data: CreateTaskData) => Promise<TaskManifest>
  updateTask: (
    projectId: string,
    taskId: string,
    updates: Partial<TaskManifest>
  ) => Promise<TaskManifest | null>
  deleteTask: (projectId: string, taskId: string) => Promise<boolean>
  updateTaskStatus: (
    projectId: string,
    taskId: string,
    status: TaskStatus
  ) => Promise<TaskManifest | null>
  readTaskLog: (projectId: string, taskId: string) => Promise<string | null>
  readIterationLog: (
    projectId: string,
    taskId: string,
    iteration: number
  ) => Promise<string | null>
  readPlanFile: (planFilePath: string) => Promise<string | null>
  acceptTask: (projectId: string, taskId: string) => Promise<TaskManifest | null>
  rejectTask: (projectId: string, taskId: string) => Promise<TaskManifest | null>
  repromptTask: (
    projectId: string,
    taskId: string,
    newPrompt: string
  ) => Promise<TaskManifest | null>
  replyToTask: (
    projectId: string,
    taskId: string,
    replyMessage: string
  ) => Promise<TaskManifest | null>
  acceptPlanAndCreateTask: (
    projectId: string,
    taskId: string,
    executionPrompt: string
  ) => Promise<{ planTask: TaskManifest; executionTask: TaskManifest }>
  reorderTasks: (updates: ReorderTaskData[]) => Promise<TaskManifest[]>
  generateRetryContext: (
    projectId: string,
    taskId: string,
    iteration?: number
  ) => Promise<RetryContextResult | null>
  formatVoicePrompt: (rawPrompt: string) => Promise<FormattedPrompt>

  // Tags
  listTags: () => Promise<Tag[]>
  getTag: (id: string) => Promise<Tag | null>
  createTag: (name: string, color?: string) => Promise<Tag>
  updateTag: (id: string, updates: Partial<Omit<Tag, 'id' | 'createdAt'>>) => Promise<Tag | null>
  deleteTag: (id: string) => Promise<boolean>
  getTagsByIds: (ids: string[]) => Promise<Tag[]>
  searchTags: (query: string) => Promise<Tag[]>

  // Config
  getConfig: () => Promise<AppConfig>
  updateConfig: (updates: Partial<AppConfig>) => Promise<AppConfig>
  resetConfig: () => Promise<AppConfig>
  getClaudeCodePath: () => Promise<string>
  setClaudeCodePath: (path: string) => Promise<void>
  getSelectedProjectId: () => Promise<string | null>
  setSelectedProjectId: (projectId: string | null) => Promise<void>

  // Agent Config
  listAgentConfigs: () => Promise<AgentConfigInfo[]>
  getAgentConfig: (agentId: string) => Promise<AgentConfigInfo | null>
  getSelectedAgent: () => Promise<string>
  setSelectedAgent: (agentId: string) => Promise<void>
  setAgentEnabled: (agentId: string, enabled: boolean) => Promise<void>
  setAgentApiKey: (agentId: string, apiKey: string) => Promise<void>
  deleteAgentApiKey: (agentId: string) => Promise<void>
  hasAgentApiKey: (agentId: string) => Promise<boolean>
  setAgentTier: (agentId: string, tier: string) => Promise<void>
  setAgentCustomPath: (agentId: string, path: string | null) => Promise<void>
  setAgentSetting: (agentId: string, key: string, value: unknown) => Promise<void>
  getAgentSetting: (agentId: string, key: string) => Promise<unknown>
  validateAgentApiKey: (agentId: string, apiKey: string) => Promise<{ valid: boolean; error?: string }>
  getSecureStorageInfo: () => Promise<SecureStorageInfo>
  testAgentCli: (agentId: string) => Promise<{ success: boolean; version?: string; error?: string }>

  // System
  selectDirectory: () => Promise<string | null>
  selectFile: (filters?: FileFilter[]) => Promise<string | null>
  openExternal: (url: string) => Promise<void>
  openPath: (path: string) => Promise<void>
  getVersion: () => Promise<string>
  getChangelog: () => Promise<string>
  openChangelog: () => Promise<void>
  getPlatform: () => Promise<NodeJS.Platform>
  getStorageStatus: () => Promise<{
    initialized: boolean
    configLoaded: boolean
    localStateLoaded: boolean
    projectCount: number
    groupCount: number
    error: string | null
  }>
  getStartupStatus: () => Promise<{ stage: string; message: string; complete: boolean }>
  testNotification: () => Promise<void>
  previewNotificationSound: (soundName: string, customPath?: string) => Promise<void>
  copyNotificationSound: (sourcePath: string) => Promise<string>
  openLogsFolder: () => Promise<void>
  getDebugLogging: () => Promise<boolean>
  setDebugLogging: (enabled: boolean) => Promise<void>
  onStartupProgress: (
    callback: (status: { stage: string; message: string; complete: boolean }) => void
  ) => () => void

  // Git - existing
  getRepoInfo: (path: string) => Promise<GitRepoInfo>
  extractRepoName: (gitUrl: string) => Promise<string>
  normalizeGitUrl: (gitUrl: string) => Promise<string>
  getCurrentBranch: (projectId: string) => Promise<string | null>

  // Git - branch operations
  listBranches: (projectId: string) => Promise<BranchInfo[]>
  createBranch: (projectId: string, name: string, startPoint?: string) => Promise<void>
  checkoutBranch: (projectId: string, name: string) => Promise<void>
  deleteBranch: (projectId: string, name: string, force?: boolean) => Promise<void>

  // Git - status & staging
  getGitStatus: (projectId: string) => Promise<FileStatus[]>
  stageFiles: (projectId: string, files: string[]) => Promise<void>
  unstageFiles: (projectId: string, files: string[]) => Promise<void>
  stageAll: (projectId: string) => Promise<void>
  unstageAll: (projectId: string) => Promise<void>
  discardChanges: (projectId: string, file: string) => Promise<void>
  discardAllChanges: (projectId: string) => Promise<void>

  // Git - diff operations
  getDiff: (projectId: string, options?: { file?: string; staged?: boolean }) => Promise<string>
  getFileDiff: (projectId: string, file: string, staged?: boolean) => Promise<FileDiff>

  // Git - commit operations
  gitCommit: (projectId: string, message: string) => Promise<CommitResult>
  getRecentCommits: (projectId: string, count?: number) => Promise<CommitInfo[]>
  generateCommitMessage: (projectId: string) => Promise<string>

  // Git - remote operations
  getRemoteStatus: (projectId: string) => Promise<RemoteStatus>
  gitFetch: (projectId: string, remote?: string) => Promise<FetchResult>
  gitPull: (projectId: string, remote?: string, branch?: string) => Promise<PullResult>
  gitPush: (projectId: string, remote?: string, branch?: string, options?: PushOptions) => Promise<PushResult>

  // Git - stash operations
  stashList: (projectId: string) => Promise<StashEntry[]>
  stashSave: (projectId: string, options?: StashSaveOptions) => Promise<StashSaveResult>
  stashApply: (projectId: string, index?: number) => Promise<void>
  stashPop: (projectId: string, index?: number) => Promise<void>
  stashDrop: (projectId: string, index?: number) => Promise<void>

  // Agents
  listAgents: () => Promise<AgentInfo[]>
  getAvailableAgents: () => Promise<AgentInfo[]>
  getDefaultAgent: () => Promise<AgentInfo>
  isAgentAvailable: (agentId: string) => Promise<boolean>
  getAgentModels: (agentId: string) => Promise<AgentModelInfo[]>
  getAgentDefaultModel: (agentId: string) => Promise<string | null>
  startTask: (projectId: string, taskId: string) => Promise<boolean>
  cancelTask: (taskId: string) => Promise<boolean>
  getRunningTasks: () => Promise<RunningProcessInfo[]>
  getTaskOutput: (taskId: string) => Promise<AgentOutputEvent[]>
  getUsageLimitState: () => Promise<UsageLimitState>
  clearUsageLimit: () => Promise<void>
  checkUsageLimits: () => Promise<UsageLimitCheckResult>
  getUsagePercentage: () => Promise<UsagePercentageState>
  checkAgentAuth: (agentId: string) => Promise<AgentAuthState>
  getAgentAuthStates: () => Promise<AgentAuthState[]>
  triggerAgentReauth: (
    agentId: string,
    projectPath?: string
  ) => Promise<{ success: boolean; error?: string }>

  // Memory
  getProjectMemory: (projectId: string) => Promise<ProjectMemory>
  getMemoryContext: (projectId: string) => Promise<string>
  getMemoryStats: (projectId: string) => Promise<MemoryStats>
  addMemoryEntry: (data: AddMemoryEntryData) => Promise<MemoryEntry>
  updateMemoryStructure: (projectId: string, structure: CodebaseStructure) => Promise<void>
  compactMemory: (projectId: string) => Promise<number>
  clearProjectMemory: (projectId: string) => Promise<void>
  hasProjectMemory: (projectId: string) => Promise<boolean>

  // Planning
  createPlanningSession: (data: CreatePlanningSessionData) => Promise<PlanningSession>
  getPlanningSession: (sessionId: string) => Promise<PlanningSession | null>
  listPlanningSessions: (projectId: string) => Promise<PlanningSession[]>
  listAllPlanningSessions: () => Promise<PlanningSession[]>
  deletePlanningSession: (sessionId: string) => Promise<boolean>
  sendPlanningMessage: (data: SendPlanningMessageData) => Promise<void>
  interruptAndSendPlanningMessage: (data: SendPlanningMessageData) => Promise<void>
  cancelPlanningResponse: (sessionId: string) => Promise<boolean>
  updatePlanItems: (sessionId: string, items: ExtractedPlanItem[]) => Promise<PlanningSession | null>
  convertPlanToTasks: (sessionId: string, itemIds: string[]) => Promise<TaskManifest[]>
  addPlanningContextAttachment: (data: AddContextAttachmentData) => Promise<PlanningSession | null>
  removePlanningContextAttachment: (data: RemoveContextAttachmentData) => Promise<PlanningSession | null>
  loadPlanningContextContent: (data: LoadContextContentData) => Promise<ContextAttachment>
  readPlanningFile: (projectId: string, filePath: string) => Promise<string>

  // Notes
  listNotes: () => Promise<Note[]>
  getNote: (noteId: string) => Promise<Note | null>
  createNote: (data: CreateNoteData) => Promise<Note>
  updateNote: (noteId: string, updates: Partial<Note>) => Promise<Note | null>
  deleteNote: (noteId: string) => Promise<boolean>
  searchNotes: (query: string) => Promise<Note[]>
  listNotesByProject: (projectId: string) => Promise<Note[]>
  listNotesReferencingProject: (projectId: string) => Promise<Note[]>
  listRecentNotes: (limit?: number) => Promise<Note[]>
  listPinnedNotes: () => Promise<Note[]>
  listNotesByStatus: (status: NoteStatus) => Promise<Note[]>
  listNotesByTag: (tag: string) => Promise<Note[]>
  toggleNotePin: (noteId: string) => Promise<Note | null>
  archiveNote: (noteId: string) => Promise<Note | null>
  unarchiveNote: (noteId: string) => Promise<Note | null>
  linkNoteToTask: (noteId: string, taskId: string) => Promise<Note | null>
  unlinkNoteFromTask: (noteId: string, taskId: string) => Promise<Note | null>
  linkNoteToPlanning: (noteId: string, planningId: string) => Promise<Note | null>
  unlinkNoteFromPlanning: (noteId: string, planningId: string) => Promise<Note | null>
  getAllNoteTags: () => Promise<string[]>
  reorderNotes: (noteOrders: Array<{ id: string; order: number; groupId?: string | null }>) => Promise<void>
  moveNoteToGroup: (noteId: string, groupId: string | null) => Promise<Note | null>
  listNotesByGroup: (groupId: string | null) => Promise<Note[]>

  // Note Groups
  listNoteGroups: () => Promise<NoteGroup[]>
  getNoteGroup: (id: string) => Promise<NoteGroup | null>
  createNoteGroup: (data: CreateNoteGroupData) => Promise<NoteGroup>
  updateNoteGroup: (id: string, updates: Partial<NoteGroup>) => Promise<NoteGroup | null>
  deleteNoteGroup: (id: string) => Promise<boolean>
  reorderNoteGroups: (groupOrders: Array<{ id: string; order: number }>) => Promise<void>
  toggleNoteGroupCollapsed: (id: string) => Promise<NoteGroup | null>

  // Whisper
  getWhisperStatus: () => Promise<WhisperStatus>
  getWhisperModels: () => Promise<WhisperModelInfo[]>
  loadWhisperModel: (modelKey: string) => Promise<{ success: boolean; error?: string }>
  unloadWhisperModel: () => Promise<{ success: boolean }>
  transcribeAudio: (
    audioBase64: string,
    options?: { language?: string; returnTimestamps?: boolean }
  ) => Promise<{ success: boolean; result?: TranscriptionResult; error?: string }>
  onWhisperLoadProgress: (
    callback: (data: { modelKey: string; progress: number }) => void
  ) => () => void

  // Claude Config
  scanClaudeConfig: (projectId: string) => Promise<ClaudeProjectConfig>
  getClaudeAgents: (projectId: string) => Promise<ClaudeAgent[]>
  getClaudeCommands: (projectId: string) => Promise<ClaudeCommand[]>
  createClaudeAgent: (projectId: string, data: CreateClaudeAgentData) => Promise<ClaudeAgent>
  updateClaudeAgent: (projectId: string, name: string, updates: Partial<CreateClaudeAgentData>) => Promise<ClaudeAgent>
  deleteClaudeAgent: (projectId: string, name: string) => Promise<void>
  createClaudeCommand: (projectId: string, data: CreateClaudeCommandData) => Promise<ClaudeCommand>
  updateClaudeCommand: (projectId: string, name: string, updates: Partial<CreateClaudeCommandData>) => Promise<ClaudeCommand>
  deleteClaudeCommand: (projectId: string, name: string) => Promise<void>
  updateClaudeMd: (projectId: string, content: string) => Promise<void>
  deleteClaudeMd: (projectId: string) => Promise<void>
  analyzeClaudeMd: (projectId: string) => Promise<ClaudeMdAnalysis>
  getClaudeMdSubFiles: (projectId: string) => Promise<ClaudeMdSubFile[]>
  createClaudeMdSubFile: (projectId: string, name: string, content: string) => Promise<void>
  updateClaudeMdSubFile: (projectId: string, name: string, content: string) => Promise<void>
  deleteClaudeMdSubFile: (projectId: string, name: string) => Promise<void>
  readClaudeMdSubFile: (projectId: string, name: string) => Promise<string>

  // Documentation
  createDocSession: (data: CreateDocSessionData) => Promise<DocSession>
  getDocSession: (sessionId: string) => Promise<DocSession | null>
  listDocSessions: (projectId: string) => Promise<DocSession[]>
  listAllDocSessions: () => Promise<DocSession[]>
  deleteDocSession: (sessionId: string) => Promise<boolean>
  updateDocContent: (sessionId: string, content: string) => Promise<void>
  generateDoc: (sessionId: string) => Promise<void>
  refineDoc: (sessionId: string, message: string) => Promise<void>
  commitDoc: (sessionId: string) => Promise<void>
  cancelDoc: (sessionId: string) => Promise<boolean>
  getDocTemplates: () => Promise<DocTemplate[]>
  getDocTemplate: (type: DocumentationType) => Promise<DocTemplate>
  analyzeProjectDocs: (projectId: string) => Promise<ExistingDocAnalysis>
  suggestDocs: (projectId: string) => Promise<DocSuggestion[]>

  // Project Analysis
  analyzeProject: (projectId: string, projectPath: string) => Promise<ProjectAnalysis>
  getCachedAnalysis: (projectId: string) => Promise<ProjectAnalysis | null>
  detectTechnologies: (projectPath: string) => Promise<DetectedTechnology[]>
  detectPatterns: (projectPath: string) => Promise<DetectedPattern[]>
  getSkillRecommendations: (projectId: string) => Promise<SkillRecommendation[]>
  clearAnalysisCache: (projectId: string) => Promise<void>
  onAnalysisProgress: (
    callback: (data: { projectId: string; progress: AnalysisProgress }) => void
  ) => () => void

  // Connections (new integration model)
  listConnections: () => Promise<IntegrationConnection[]>
  getConnection: (id: string) => Promise<IntegrationConnection | null>
  createConnection: (data: CreateConnectionData, token: string) => Promise<IntegrationConnection>
  updateConnection: (
    id: string,
    updates: Partial<Omit<IntegrationConnection, 'id' | 'createdAt'>>
  ) => Promise<IntegrationConnection | null>
  deleteConnection: (id: string) => Promise<boolean>
  testConnection: (id: string) => Promise<IntegrationTestResult>
  updateConnectionToken: (id: string, token: string) => Promise<void>

  // Sources (new integration model)
  listSources: () => Promise<IntegrationSource[]>
  getSource: (id: string) => Promise<IntegrationSource | null>
  listSourcesForConnection: (connectionId: string) => Promise<IntegrationSource[]>
  createSource: (data: CreateSourceData) => Promise<IntegrationSource>
  updateSource: (
    id: string,
    updates: Partial<Omit<IntegrationSource, 'id' | 'createdAt' | 'connectionId'>>
  ) => Promise<IntegrationSource | null>
  deleteSource: (id: string) => Promise<boolean>
  fetchSourceIssues: (sourceId: string, options?: FetchIssuesOptions) => Promise<FetchIssuesResult>
  importSourceIssueAsTask: (sourceId: string, issueId: string, projectId: string) => Promise<TaskManifest>
  createSourcePR: (sourceId: string, taskId: string, options: CreatePROptions) => Promise<CreatePRResult>

  // Jira Discovery
  listJiraBoards: (connectionId: string) => Promise<JiraBoard[]>
  listJiraSprints: (connectionId: string, boardId: number) => Promise<JiraSprint[]>
  listJiraFilters: (connectionId: string) => Promise<JiraFilter[]>
  listJiraProjects: (connectionId: string) => Promise<JiraProject[]>
  listJiraStatuses: (connectionId: string) => Promise<JiraStatus[]>

  // Integrations (legacy - deprecated)
  listIntegrations: () => Promise<Integration[]>
  getIntegration: (id: string) => Promise<Integration | null>
  createIntegration: (data: CreateIntegrationData) => Promise<Integration>
  updateIntegration: (
    id: string,
    updates: Partial<Omit<Integration, 'id' | 'createdAt'>>
  ) => Promise<Integration | null>
  deleteIntegration: (id: string) => Promise<boolean>
  testIntegration: (id: string) => Promise<IntegrationTestResult>
  fetchIntegrationIssues: (
    integrationId: string,
    options?: FetchIssuesOptions
  ) => Promise<ExternalIssue[]>
  getIntegrationIssue: (integrationId: string, issueId: string) => Promise<ExternalIssue | null>
  importIssueAsTask: (
    integrationId: string,
    issueId: string,
    projectId: string
  ) => Promise<TaskManifest>
  createPullRequest: (
    integrationId: string,
    taskId: string,
    options: CreatePROptions
  ) => Promise<CreatePRResult>
  transitionJiraIssue: (
    integrationId: string,
    issueId: string,
    transitionId: string
  ) => Promise<boolean>
  listIntegrationsForProject: (projectId: string) => Promise<Integration[]>

  // Event listeners (Main → Renderer)
  onTaskStatusChanged: (callback: (task: TaskManifest) => void) => () => void
  onUsageLimitStateChanged: (callback: (state: UsageLimitState) => void) => () => void
  onAgentAuthStateChanged: (callback: (state: AgentAuthState) => void) => () => void
  onPlanningStreamStart: (callback: (data: { sessionId: string }) => void) => () => void
  onPlanningChunk: (callback: (data: { sessionId: string; content: string; fullContent: string }) => void) => () => void
  onPlanningActivity: (callback: (data: { sessionId: string; tool: string; target: string }) => void) => () => void
  onPlanningComplete: (callback: (data: { sessionId: string; session: PlanningSession }) => void) => () => void
  onPlanningError: (callback: (data: { sessionId: string; error: string }) => void) => () => void
  onPlanningCancelled: (callback: (data: { sessionId: string }) => void) => () => void
  onPlanningSessionUpdate: (callback: (data: { session: PlanningSession }) => void) => () => void
  onDocStreamStart: (callback: (data: { sessionId: string }) => void) => () => void
  onDocChunk: (callback: (data: { sessionId: string; content: string; fullContent: string }) => void) => () => void
  onDocComplete: (callback: (data: { sessionId: string; session: DocSession }) => void) => () => void
  onDocError: (callback: (data: { sessionId: string; error: string }) => void) => () => void
  onDocCancelled: (callback: (data: { sessionId: string }) => void) => () => void
  onDocCommitted: (callback: (data: { sessionId: string; path: string }) => void) => () => void
}

// ============ Agent Auth State ============

export interface AgentAuthState {
  /** Agent identifier */
  agentId: string
  /** Whether authentication is currently valid */
  isAuthenticated: boolean
  /** When auth was last checked (ISO string) */
  lastCheckedAt: string | null
  /** Error message if auth check failed */
  error: string | null
  /** Whether re-authentication is required */
  requiresReauth: boolean
  /** Optional project path for context-aware re-authentication */
  projectPath?: string
}

// ============ Usage Limit State ============

export interface UsageLimitState {
  /** Whether the queue is paused due to usage limits */
  isPaused: boolean

  /** When the usage limit was detected */
  pausedAt: string | null

  /** When the usage limit is expected to reset (if known) */
  resumeAt: string | null

  /** The task that triggered the usage limit */
  triggeredByTaskId: string | null
}

// ============ Usage Percentage State ============

export interface UsageWindow {
  /** Utilization percentage (0-100) */
  utilization: number

  /** When this window resets (ISO string) */
  resetsAt: string
}

export interface UsagePercentageState {
  /** 5-hour rolling window usage */
  fiveHour: UsageWindow | null

  /** 7-day weekly window usage */
  sevenDay: UsageWindow | null

  /** When this data was last fetched (ISO string) */
  lastCheckedAt: string | null

  /** Error message if the check failed */
  error: string | null
}

// ============ IPC Events (Main → Renderer) ============

export interface IpcEvents {
  'task:statusChanged': (task: TaskManifest) => void
  'usageLimit:stateChanged': (state: UsageLimitState) => void
  'agentAuth:stateChanged': (state: AgentAuthState) => void
  'planning:streamStart': (data: { sessionId: string }) => void
  'planning:chunk': (data: { sessionId: string; content: string; fullContent: string }) => void
  'planning:complete': (data: { sessionId: string; session: PlanningSession }) => void
  'planning:error': (data: { sessionId: string; error: string }) => void
  'planning:cancelled': (data: { sessionId: string }) => void
  'planning:sessionUpdate': (data: { session: PlanningSession }) => void
  'docs:streamStart': (data: { sessionId: string }) => void
  'docs:chunk': (data: { sessionId: string; content: string; fullContent: string }) => void
  'docs:complete': (data: { sessionId: string; session: DocSession }) => void
  'docs:error': (data: { sessionId: string; error: string }) => void
  'docs:cancelled': (data: { sessionId: string }) => void
  'docs:committed': (data: { sessionId: string; path: string }) => void
  'analysis:progress': (data: { projectId: string; progress: AnalysisProgress }) => void
}

// Declare the window.api type globally
declare global {
  interface Window {
    api: RendererApi
  }
}
