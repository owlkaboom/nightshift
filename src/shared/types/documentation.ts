/**
 * Documentation types for Nightshift
 *
 * Provides types for generating and managing project documentation
 * including CLAUDE.md, README.md, architecture docs, and API documentation.
 */

/**
 * Types of documentation that can be generated
 */
export type DocumentationType =
  | 'claude-md' // CLAUDE.md - Agent instructions
  | 'readme' // README.md - Project overview
  | 'architecture' // ARCHITECTURE.md - System design
  | 'api' // API.md - API documentation
  | 'contributing' // CONTRIBUTING.md
  | 'changelog' // CHANGELOG.md
  | 'custom' // User-defined

/**
 * Role of a message in the documentation conversation
 */
export type DocMessageRole = 'user' | 'assistant' | 'system'

/**
 * Status of a documentation session
 */
export type DocSessionStatus =
  | 'generating' // AI is generating content
  | 'reviewing' // User is reviewing generated content
  | 'editing' // User is editing/refining content
  | 'committed' // Documentation has been written to file
  | 'cancelled' // Session was cancelled

/**
 * Documentation generation request
 */
export interface DocGenerationRequest {
  /** Project to generate documentation for */
  projectId: string

  /** Type of documentation to generate */
  type: DocumentationType

  /** Override default output path */
  outputPath?: string

  /** Merge with existing doc if present */
  updateExisting?: boolean

  /** Specific sections to generate/update */
  sections?: string[]

  /** Additional instructions for generation */
  customInstructions?: string

  /** Agent ID to use for generation (uses default if not specified) */
  agentId?: string
}

/**
 * Generated documentation result
 */
export interface GeneratedDoc {
  /** Type of documentation */
  type: DocumentationType

  /** Generated markdown content */
  content: string

  /** Suggested file path for the documentation */
  suggestedPath: string

  /** Existing content if updating */
  existingContent?: string

  /** Visual diff if updating */
  diff?: string

  /** Metadata about the generation */
  metadata: {
    generatedAt: string
    projectId: string
    projectName: string
    sections: string[]
  }
}

/**
 * A single message in a documentation conversation
 */
export interface DocSessionMessage {
  /** Unique message identifier */
  id: string

  /** Role of the message sender */
  role: DocMessageRole

  /** Message content (may contain markdown) */
  content: string

  /** When the message was created (ISO string) */
  timestamp: string

  /** Whether the message is currently being streamed */
  isStreaming?: boolean
}

/**
 * Documentation session - like planning but for docs
 * Enables interactive AI-assisted documentation generation
 */
export interface DocSession {
  /** Unique session identifier (e.g., doc_abc123) */
  id: string

  /** Project this session belongs to */
  projectId: string

  /** Type of documentation being generated */
  type: DocumentationType

  /** Title of the session */
  title: string

  /** Current session status */
  status: DocSessionStatus

  /** Initially generated content */
  generatedContent: string

  /** User-edited content (starts as copy of generatedContent) */
  editedContent: string

  /** Target file path where doc will be written */
  targetPath: string

  /** Conversation history for refinements */
  messages: DocSessionMessage[]

  /** When the session was created (ISO string) */
  createdAt: string

  /** When the session was last updated (ISO string) */
  updatedAt: string

  /** Agent ID used for this session */
  agentId: string

  /** Claude Code conversation ID for --resume (multi-turn) */
  conversationId?: string

  /** Whether this is updating existing documentation */
  isUpdate: boolean

  /** Original content if updating */
  originalContent?: string
}

/**
 * Documentation template section definition
 */
export interface DocTemplateSection {
  /** Unique section identifier */
  id: string

  /** Display name of the section */
  name: string

  /** Description of what should be in this section */
  description: string

  /** Whether this section is required */
  required: boolean

  /** Example content for this section */
  exampleContent?: string
}

/**
 * Documentation template
 */
export interface DocTemplate {
  /** Unique template identifier */
  id: string

  /** Type of documentation this template is for */
  type: DocumentationType

  /** Template name */
  name: string

  /** Template description */
  description: string

  /** Sections that should be in this documentation */
  sections: DocTemplateSection[]

  /** Default file path for this documentation type */
  defaultPath: string

  /** Whether this is a built-in template */
  isBuiltIn: boolean

  /** Generation prompt for the AI */
  generationPrompt: string
}

/**
 * Analysis of existing documentation in a project
 */
export interface ExistingDocAnalysis {
  /** Whether CLAUDE.md exists */
  hasClaudeMd: boolean

  /** Whether README.md exists */
  hasReadme: boolean

  /** Whether architecture docs exist */
  hasArchitectureDocs: boolean

  /** Whether API docs exist */
  hasApiDocs: boolean

  /** List of found documentation files */
  docs: Array<{
    path: string
    type: DocumentationType
    lastModified: string
  }>

  /** Suggestions for missing or outdated docs */
  suggestions: string[]
}

/**
 * Documentation suggestion
 */
export interface DocSuggestion {
  /** Type of documentation to create/update */
  type: DocumentationType

  /** Reason for the suggestion */
  reason: string

  /** Priority level */
  priority: 'high' | 'medium' | 'low'

  /** Whether this would update existing doc */
  isUpdate: boolean
}

/**
 * Data required to create a new documentation session
 */
export interface CreateDocSessionData {
  /** Project ID to generate docs for */
  projectId: string

  /** Type of documentation to generate */
  type: DocumentationType

  /** Override default path */
  outputPath?: string

  /** Whether to update existing doc */
  updateExisting?: boolean

  /** Custom instructions */
  customInstructions?: string

  /** Agent ID to use (uses default if not specified) */
  agentId?: string

  /** Specific sections to generate */
  sections?: string[]
}

/**
 * Generate a unique documentation session ID
 */
export function generateDocSessionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 7)
  return `doc_${timestamp}${random}`
}

/**
 * Generate a unique message ID
 */
export function generateDocMessageId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 7)
  return `docmsg_${timestamp}${random}`
}

/**
 * Create a new documentation message
 */
export function createDocMessage(
  role: DocMessageRole,
  content: string,
  options: Partial<DocSessionMessage> = {}
): DocSessionMessage {
  return {
    id: generateDocMessageId(),
    role,
    content,
    timestamp: new Date().toISOString(),
    ...options
  }
}

/**
 * Create a new documentation session
 */
export function createDocSession(
  projectId: string,
  type: DocumentationType,
  agentId: string,
  targetPath: string,
  options: Partial<DocSession> = {}
): DocSession {
  const now = new Date().toISOString()
  return {
    id: generateDocSessionId(),
    projectId,
    type,
    title: `Generate ${getDocumentationTypeLabel(type)}`,
    status: 'generating',
    generatedContent: '',
    editedContent: '',
    targetPath,
    messages: [],
    createdAt: now,
    updatedAt: now,
    agentId,
    isUpdate: false,
    ...options
  }
}

/**
 * Get a human-readable label for a documentation type
 */
export function getDocumentationTypeLabel(type: DocumentationType): string {
  switch (type) {
    case 'claude-md':
      return 'CLAUDE.md'
    case 'readme':
      return 'README.md'
    case 'architecture':
      return 'Architecture Documentation'
    case 'api':
      return 'API Documentation'
    case 'contributing':
      return 'Contributing Guide'
    case 'changelog':
      return 'Changelog'
    case 'custom':
      return 'Custom Documentation'
    default:
      return type
  }
}

/**
 * Get the default file path for a documentation type
 */
export function getDefaultDocPath(type: DocumentationType, projectPath: string): string {
  const basePath = projectPath
  switch (type) {
    case 'claude-md':
      return `${basePath}/CLAUDE.md`
    case 'readme':
      return `${basePath}/README.md`
    case 'architecture':
      return `${basePath}/.claude/docs/ARCHITECTURE.md`
    case 'api':
      return `${basePath}/.claude/docs/API.md`
    case 'contributing':
      return `${basePath}/CONTRIBUTING.md`
    case 'changelog':
      return `${basePath}/CHANGELOG.md`
    case 'custom':
      return `${basePath}/DOCUMENTATION.md`
    default:
      return `${basePath}/DOCUMENTATION.md`
  }
}
