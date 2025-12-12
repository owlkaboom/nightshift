/**
 * Claude Code configuration types
 *
 * These types represent the .claude/ directory structure that Claude Code uses
 * for project-specific configuration, sub-agents, skills, and commands.
 */

/**
 * Claude Code sub-agent definition
 * Stored in .claude/agents/{name}.md
 */
export interface ClaudeAgent {
  /** Agent name (filename without extension) */
  name: string

  /** Short description of the agent's role */
  description: string

  /** The markdown content defining the agent's behavior */
  prompt: string

  /** Full path to the agent file */
  filePath: string

  /** When the file was created */
  createdAt: string

  /** When the file was last modified */
  updatedAt: string
}

/**
 * Claude Code skill definition
 * Stored in .claude/skills/{name}.md
 */
export interface ClaudeSkill {
  /** Skill name (filename without extension) */
  name: string

  /** Short description of what the skill provides */
  description: string

  /** The markdown content with skill instructions */
  prompt: string

  /** Full path to the skill file */
  filePath: string

  /** Whether this skill is enabled by default */
  enabled: boolean

  /** When the file was created */
  createdAt: string

  /** When the file was last modified */
  updatedAt: string
}

/**
 * Claude Code command definition
 * Stored in .claude/commands/{name}.md
 */
export interface ClaudeCommand {
  /** Command name (used as /command-name) */
  name: string

  /** Short description of what the command does */
  description: string

  /** The prompt that gets executed when command is invoked */
  prompt: string

  /** Full path to the command file */
  filePath: string

  /** When the file was created */
  createdAt: string

  /** When the file was last modified */
  updatedAt: string
}

/**
 * Complete Claude configuration for a project
 */
export interface ClaudeProjectConfig {
  /** Path to the project root */
  projectPath: string

  /** Whether CLAUDE.md exists */
  hasClaudeMd: boolean

  /** Path to CLAUDE.md if it exists */
  claudeMdPath: string | null

  /** Content of CLAUDE.md if it exists */
  claudeMdContent: string | null

  /** Detected sub-agents */
  agents: ClaudeAgent[]

  /** Detected skills */
  skills: ClaudeSkill[]

  /** Detected commands */
  commands: ClaudeCommand[]

  /** Whether .claude/settings.json exists */
  hasSettings: boolean

  /** Content of settings.json if it exists */
  settings: Record<string, unknown> | null

  /** When this configuration was last scanned */
  lastScanned: string
}

/**
 * Data for creating a new Claude agent
 */
export interface CreateClaudeAgentData {
  name: string
  description: string
  prompt: string
}

/**
 * Data for creating a new Claude skill
 */
export interface CreateClaudeSkillData {
  name: string
  description: string
  prompt: string
  enabled?: boolean
}

/**
 * Data for creating a new Claude command
 */
export interface CreateClaudeCommandData {
  name: string
  description: string
  prompt: string
}

/**
 * AI-generated suggestion for a Claude agent
 */
export interface ClaudeAgentSuggestion {
  name: string
  description: string
  prompt: string
  reasoning: string // Why this agent would be useful for the project
}

/**
 * AI-generated suggestion for a Claude skill
 */
export interface ClaudeSkillSuggestion {
  name: string
  description: string
  prompt: string
  reasoning: string
}

/**
 * AI-generated suggestion for a Claude command
 */
export interface ClaudeCommandSuggestion {
  name: string
  description: string
  prompt: string
  reasoning: string
}

/**
 * Result from AI analysis of a project
 */
export interface ProjectAnalysisResult {
  /** Suggested agents for the project */
  agents: ClaudeAgentSuggestion[]

  /** Suggested skills for the project */
  skills: ClaudeSkillSuggestion[]

  /** Suggested commands for the project */
  commands: ClaudeCommandSuggestion[]

  /** Overall project summary */
  summary: string
}

/**
 * Create a new Claude agent with default values
 */
export function createClaudeAgent(
  name: string,
  description: string,
  prompt: string,
  filePath: string
): ClaudeAgent {
  const now = new Date().toISOString()
  return {
    name,
    description,
    prompt,
    filePath,
    createdAt: now,
    updatedAt: now
  }
}

/**
 * Create a new Claude skill with default values
 */
export function createClaudeSkill(
  name: string,
  description: string,
  prompt: string,
  filePath: string,
  enabled = true
): ClaudeSkill {
  const now = new Date().toISOString()
  return {
    name,
    description,
    prompt,
    filePath,
    enabled,
    createdAt: now,
    updatedAt: now
  }
}

/**
 * Create a new Claude command with default values
 */
export function createClaudeCommand(
  name: string,
  description: string,
  prompt: string,
  filePath: string
): ClaudeCommand {
  const now = new Date().toISOString()
  return {
    name,
    description,
    prompt,
    filePath,
    createdAt: now,
    updatedAt: now
  }
}

/**
 * Validate agent name (must be valid filename)
 */
export function validateClaudeConfigName(name: string): {
  valid: boolean
  error?: string
} {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Name cannot be empty' }
  }

  // Check for invalid filename characters
  const invalidChars = /[<>:"/\\|?*\x00-\x1F]/
  if (invalidChars.test(name)) {
    return { valid: false, error: 'Name contains invalid characters' }
  }

  // Check for reserved names
  const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'LPT1', 'LPT2']
  if (reserved.includes(name.toUpperCase())) {
    return { valid: false, error: 'Name is reserved' }
  }

  // Check length
  if (name.length > 255) {
    return { valid: false, error: 'Name is too long (max 255 characters)' }
  }

  return { valid: true }
}

/**
 * Extract description from markdown content
 * Looks for the first paragraph after the title
 */
export function extractDescriptionFromMarkdown(content: string): string {
  const lines = content.split('\n')
  let foundTitle = false
  let description = ''

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines
    if (!trimmed) continue

    // Skip title (first # heading)
    if (trimmed.startsWith('#') && !foundTitle) {
      foundTitle = true
      continue
    }

    // First non-empty, non-title line is the description
    if (foundTitle && !trimmed.startsWith('#')) {
      description = trimmed
      break
    }
  }

  // Limit description length
  if (description.length > 200) {
    description = description.substring(0, 197) + '...'
  }

  return description || 'No description available'
}
