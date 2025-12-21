/**
 * Shared types for Nightshift
 * Re-exports all type definitions for easy importing
 */

// Task types
export type {
  TaskStatus,
  TaskSource,
  TaskManifest,
  TaskSummary,
  TaskIteration
} from './task'
export { createTaskManifest } from './task'

// Project types
export type {
  Project,
  ProjectsRegistry,
  ProjectEcosystemInfo,
  ProjectSkill,
  ScannedRepo
} from './project'
export { createProject, generateProjectId, PROJECT_ICONS } from './project'

// Tag types
export type { Tag, TagsRegistry } from './tag'
export { generateTagId, isValidTagId, isValidTagColor, TAG_COLORS } from './tag'

// Group types
export type { Group, GroupsRegistry, GroupTreeNode } from './group'
export { createGroup, generateGroupId, GROUP_COLORS, GROUP_ICONS, MAX_GROUP_NESTING_DEPTH } from './group'

// Config types
export type {
  Theme,
  NotificationSettings,
  SyncSettings,
  AgentConfig,
  AgentConfigs,
  AppConfig,
  IntegrationCredentials,
  LocalState
} from './config'
export {
  DEFAULT_CONFIG,
  createDefaultLocalState,
  generateMachineId
} from './config'

// Agent types
export type {
  AgentInvokeOptions,
  AgentChatOptions,
  AgentChatEvent,
  AgentProcess,
  AgentOutputEvent,
  AgentCapabilities,
  AgentAdapter,
  AgentRegistry,
  AgentId,
  AgentModelInfo,
  ModelAlias
} from './agent'
export {
  AGENT_IDS,
  CLAUDE_CODE_MODELS,
  GEMINI_MODELS,
  OPENROUTER_DEFAULT_MODELS,
  getAgentModels,
  getAgentDefaultModel
} from './agent'

// Skill types
export type { Skill, SkillCategory, SkillsRegistry } from './skill'
export {
  SKILL_CATEGORIES,
  BUILT_IN_SKILLS,
  generateSkillId,
  createSkill,
  createDefaultSkillsRegistry
} from './skill'

// Project memory types
export type {
  ProjectMemory,
  MemoryEntry,
  MemoryCategory,
  TaskSummary as MemoryTaskSummary,
  CodebaseStructure
} from './project-memory'
export {
  createProjectMemory,
  createMemoryEntry,
  generateMemoryEntryId,
  MAX_RECENT_TASKS,
  MAX_ENTRIES_PER_CATEGORY,
  CONFIDENCE_DECAY_PER_DAY,
  MIN_CONFIDENCE_THRESHOLD
} from './project-memory'

// Claude.md analysis types
export type {
  ClaudeMdAnalysis,
  ClaudeMdSection,
  ClaudeMdSubFile
} from './claude-md-analysis'
export {
  analyzeClaudeMd,
  calculateQualityScore,
  generateRecommendations
} from './claude-md-analysis'

// Planning types
export type {
  MessageRole,
  PlanningSessionType,
  PlanningSessionStatus,
  PlanningMessage,
  ExtractedPlanItem,
  PlanningSession,
  CreatePlanningSessionData,
  ContextAttachmentType,
  ContextAttachment,
  StreamingActivity
} from './planning'
export {
  generatePlanningSessionId,
  generateMessageId,
  generatePlanItemId,
  createPlanningMessage,
  createPlanningSession,
  extractTitleFromMessage,
  generateInitSystemPrompt,
  generateContextAttachmentId,
  createContextAttachment
} from './planning'

// Note types
export type { Note, NoteStatus, CreateNoteData, NoteGroup, CreateNoteGroupData } from './note'
export {
  generateNoteId,
  generateNoteGroupId,
  extractExcerpt,
  extractTitleFromContent,
  countWords,
  extractProjectMentions,
  createNoteGroup,
  extractGroupMentions,
  createNote,
  NOTE_ICONS
} from './note'

// Claude configuration types
export type {
  ClaudeAgent,
  ClaudeSkill,
  ClaudeCommand,
  ClaudeProjectConfig,
  CreateClaudeAgentData,
  CreateClaudeSkillData,
  CreateClaudeCommandData,
  ClaudeAgentSuggestion,
  ClaudeSkillSuggestion,
  ClaudeCommandSuggestion,
  ProjectAnalysisResult
} from './claude-config'
export {
  createClaudeAgent,
  createClaudeSkill,
  createClaudeCommand,
  validateClaudeConfigName,
  extractDescriptionFromMarkdown
} from './claude-config'

// Documentation types
export type {
  DocumentationType,
  DocMessageRole,
  DocSessionStatus,
  DocGenerationRequest,
  GeneratedDoc,
  DocSessionMessage,
  DocSession,
  DocTemplateSection,
  DocTemplate,
  ExistingDocAnalysis,
  DocSuggestion,
  CreateDocSessionData
} from './documentation'
export {
  generateDocSessionId,
  generateDocMessageId,
  createDocMessage,
  createDocSession,
  getDocumentationTypeLabel,
  getDefaultDocPath
} from './documentation'

// Project analysis types
export type {
  TechCategory,
  DetectedTechnology,
  DetectedPattern,
  SkillPriority,
  SkillRecommendation,
  ProjectAnalysis,
  AnalysisStatus,
  AnalysisProgress,
  SkillTemplate,
  PackageAnalysis,
  ConfigFileAnalysis,
  FilePatternAnalysis,
  CreateSkillsFromRecommendationsData
} from './analysis'
export {
  generateAnalysisId,
  generateRecommendationId,
  generatePatternId,
  createProjectAnalysis,
  createSkillRecommendation,
  createDetectedPattern,
  getTechCategoryLabel,
  getSkillPriorityLabel,
  sortTechnologiesByConfidence,
  sortRecommendationsByPriority,
  filterByConfidence,
  groupTechnologiesByCategory
} from './analysis'

// Git types
export type {
  BranchInfo,
  FileStatusType,
  FileStatus,
  DiffLine,
  DiffHunk,
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
} from './git'

// Integration types
export type {
  IntegrationType,
  // Connection + Source types (new)
  IntegrationConnection,
  IntegrationSource,
  GitHubConnectionConfig,
  GitHubSourceConfig,
  JiraConnectionConfig,
  JiraSourceConfig,
  CreateConnectionData,
  CreateSourceData,
  // Jira discovery types
  JiraBoard,
  JiraSprint,
  JiraFilter,
  JiraProject,
  // Legacy types
  Integration,
  GitHubConfig,
  JiraConfig,
  // Common types
  ExternalIssue,
  FetchIssuesOptions,
  CreatePROptions,
  CreateIntegrationData,
  IntegrationTestResult,
  CreatePRResult
} from './integration'
