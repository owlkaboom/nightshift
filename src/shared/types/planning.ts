/**
 * Planning session types for Nightshift
 *
 * Planning sessions enable conversational planning with AI agents
 * to develop implementation plans that can be converted to tasks.
 */

/**
 * Role of a message in the planning conversation
 */
export type MessageRole = 'user' | 'assistant' | 'system'

/**
 * Type of planning session
 */
export type PlanningSessionType = 'general' | 'init' | 'claude-md'

/**
 * Status of a planning session
 */
export type PlanningSessionStatus = 'active' | 'completed' | 'converting' | 'converted'

/**
 * Type of context attachment
 */
export type ContextAttachmentType = 'file' | 'url' | 'note' | 'project'

/**
 * A context attachment that provides additional information to the agent
 */
export interface ContextAttachment {
  /** Unique attachment identifier */
  id: string

  /** Type of context */
  type: ContextAttachmentType

  /** Display label for the attachment */
  label: string

  /** Reference to the source (file path, URL, note ID, or project ID) */
  reference: string

  /** When the attachment was added (ISO string) */
  addedAt: string

  /** Cached content for files/URLs (populated before sending to agent) */
  content?: string

  /** Error message if content couldn't be loaded */
  error?: string
}

/**
 * Current activity during streaming (what tool is being used)
 */
export interface StreamingActivity {
  /** Tool name (Read, Edit, Bash, etc.) */
  tool: string

  /** Target of the tool (file path, command, etc.) */
  target: string

  /** When this activity started */
  timestamp: string
}

/**
 * A single message in a planning conversation
 */
export interface PlanningMessage {
  /** Unique message identifier */
  id: string

  /** Role of the message sender */
  role: MessageRole

  /** Message content (may contain markdown) */
  content: string

  /** When the message was created (ISO string) */
  timestamp: string

  /** Whether the message is currently being streamed */
  isStreaming?: boolean

  /** Context attachments for this specific message */
  contextAttachments?: ContextAttachment[]
}

/**
 * An extracted plan item from the conversation
 * These can be converted to tasks
 */
export interface ExtractedPlanItem {
  /** Unique item identifier */
  id: string

  /** Brief title for the plan item */
  title: string

  /** Detailed description (used as task prompt) */
  description: string

  /** Whether this item is selected for task conversion */
  selected: boolean

  /** Order in the plan (0-indexed) */
  order: number
}

/**
 * A planning session containing the full conversation history
 */
export interface PlanningSession {
  /** Unique session identifier (e.g., plan_abc123) */
  id: string

  /** Project this planning session belongs to */
  projectId: string

  /** Session title (usually derived from first user message) */
  title: string

  /** Type of planning session */
  sessionType: PlanningSessionType

  /** Current session status */
  status: PlanningSessionStatus

  /** All messages in the conversation */
  messages: PlanningMessage[]

  /** Extracted plan items (populated when plan is finalized) */
  finalPlan: ExtractedPlanItem[]

  /** Task IDs created from this session */
  createdTaskIds: string[]

  /** When the session was created (ISO string) */
  createdAt: string

  /** When the session was last updated (ISO string) */
  updatedAt: string

  /** Agent ID used for this session */
  agentId: string

  /** Claude Code conversation ID for --resume (multi-turn) */
  conversationId?: string

  /** System prompt for init sessions (describes project context) */
  systemPrompt?: string

  /** Session-level context attachments (persist across all messages) */
  contextAttachments?: ContextAttachment[]
}

/**
 * Data required to create a new planning session
 */
export interface CreatePlanningSessionData {
  /** Project ID to associate with the session */
  projectId: string

  /** Initial message to send (optional) */
  initialMessage?: string

  /** Agent ID to use (uses default if not specified) */
  agentId?: string

  /** Type of planning session (defaults to 'general') */
  sessionType?: PlanningSessionType

  /** Description of what the project should do (for init sessions) */
  projectDescription?: string

  /** Tech stack preferences (for init sessions) */
  techStack?: string
}

/**
 * Generate a unique planning session ID
 */
export function generatePlanningSessionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 7)
  return `plan_${timestamp}${random}`
}

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 7)
  return `msg_${timestamp}${random}`
}

/**
 * Generate a unique plan item ID
 */
export function generatePlanItemId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 7)
  return `item_${timestamp}${random}`
}

/**
 * Create a new planning message
 */
export function createPlanningMessage(
  role: MessageRole,
  content: string,
  options: Partial<PlanningMessage> = {}
): PlanningMessage {
  return {
    id: generateMessageId(),
    role,
    content,
    timestamp: new Date().toISOString(),
    ...options
  }
}

/**
 * Create a new planning session
 */
export function createPlanningSession(
  projectId: string,
  agentId: string,
  options: Partial<PlanningSession> = {}
): PlanningSession {
  const now = new Date().toISOString()
  return {
    id: generatePlanningSessionId(),
    projectId,
    title: 'New Planning Session',
    sessionType: 'general',
    status: 'active',
    messages: [],
    finalPlan: [],
    createdTaskIds: [],
    createdAt: now,
    updatedAt: now,
    agentId,
    ...options
  }
}

/**
 * Generate system prompt for project initialization
 */
export function generateInitSystemPrompt(
  projectDescription: string,
  techStack?: string
): string {
  const techStackPart = techStack
    ? `\n\nPreferred tech stack: ${techStack}`
    : ''

  return `You are helping to plan and initialize a new software project. The user wants to build:

${projectDescription}${techStackPart}

Your role is to:
1. Discuss the project requirements and clarify any ambiguities
2. Propose a directory structure and architecture
3. Identify the key files and components needed
4. Create a comprehensive initialization plan document
5. Help prepare actionable initialization tasks

When proposing directory structures, use clear tree format like:
\`\`\`
project/
├── src/
│   ├── components/
│   └── utils/
├── tests/
└── package.json
\`\`\`

CRITICAL INSTRUCTION: You MUST create a detailed project initialization plan as a markdown file in the \`plans/\` directory at the project root. This is your primary deliverable.

Plan File Requirements:
1. Create your plan in \`plans/\` directory (e.g., \`plans/project-initialization.md\`, \`plans/[project-name]-setup.md\`)
2. Include sections for:
   - Project Overview
   - Architecture & Directory Structure
   - Technology Stack & Dependencies
   - Initial Setup Steps
   - Development Workflow
   - Next Steps/Tasks
3. Make it detailed enough that someone could follow it to initialize the project
4. Write the plan file BEFORE concluding the planning session

MULTI-FILE PLAN ORGANIZATION:
- For complex projects, keep the main plan file concise (<300 lines)
- Create a sub-directory structure for detailed sections: \`plans/[project-name]/\`
- Main file should contain overview and links to detailed sub-files
- Use sub-files for: detailed architecture, setup phases, component specifications, etc.

Example single-file: \`plans/my-project-initialization.md\`
Example multi-file:
\`\`\`
plans/
├── my-project-setup.md              # Main overview + links
└── my-project-setup/
    ├── architecture.md              # Detailed architecture
    ├── setup-steps.md               # Step-by-step setup
    └── component-specs.md           # Component specifications
\`\`\`

Focus on practical, actionable recommendations. Ask clarifying questions when needed, but always conclude by writing the plan file(s).`
}

/**
 * Extract a title from a message content
 * Uses the first line or first N characters
 */
export function extractTitleFromMessage(content: string, maxLength = 50): string {
  const firstLine = content.split('\n')[0].trim()
  if (firstLine.length <= maxLength) {
    return firstLine
  }
  return firstLine.slice(0, maxLength - 3) + '...'
}

/**
 * Generate a unique context attachment ID
 */
export function generateContextAttachmentId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 7)
  return `ctx_${timestamp}${random}`
}

/**
 * Create a new context attachment
 */
export function createContextAttachment(
  type: ContextAttachmentType,
  label: string,
  reference: string,
  options: Partial<ContextAttachment> = {}
): ContextAttachment {
  return {
    id: generateContextAttachmentId(),
    type,
    label,
    reference,
    addedAt: new Date().toISOString(),
    ...options
  }
}
