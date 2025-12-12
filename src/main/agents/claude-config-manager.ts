/**
 * Claude Config Manager
 *
 * Manages .claude/ directory structure for projects, including:
 * - Sub-agents (.claude/agents/)
 * - Skills (.claude/skills/)
 * - Commands (.claude/commands/)
 * - CLAUDE.md file
 * - Settings (.claude/settings.json)
 */

import { join, parse, basename } from 'path'
import { promises as fs } from 'fs'
import type {
  ClaudeAgent,
  ClaudeSkill,
  ClaudeCommand,
  ClaudeProjectConfig,
  CreateClaudeAgentData,
  CreateClaudeSkillData,
  CreateClaudeCommandData
} from '@shared/types'
import {
  createClaudeAgent,
  createClaudeSkill,
  createClaudeCommand,
  validateClaudeConfigName,
  extractDescriptionFromMarkdown
} from '@shared/types'

/**
 * Check if a path exists
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Ensure directory exists, create if not
 */
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error) {
    // Ignore if already exists
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }
}

/**
 * Read a markdown file and extract its content and metadata
 */
async function readMarkdownFile(filePath: string): Promise<{
  content: string
  stats: {
    createdAt: string
    updatedAt: string
  }
}> {
  const [content, stats] = await Promise.all([
    fs.readFile(filePath, 'utf-8'),
    fs.stat(filePath)
  ])

  return {
    content,
    stats: {
      createdAt: stats.birthtime.toISOString(),
      updatedAt: stats.mtime.toISOString()
    }
  }
}

/**
 * Write content to a markdown file
 */
async function writeMarkdownFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8')
}

/**
 * Format agent/skill/command content as markdown
 */
function formatAsMarkdown(name: string, description: string, prompt: string): string {
  return `# ${name}

${description}

${prompt}
`.trim() + '\n'
}

/**
 * Claude Config Manager Class
 */
export class ClaudeConfigManager {
  /**
   * Scan a project for its Claude configuration
   */
  async scanProject(projectPath: string): Promise<ClaudeProjectConfig> {
    const claudeMdPath = join(projectPath, 'CLAUDE.md')

    // Check if CLAUDE.md exists
    const hasClaudeMd = await pathExists(claudeMdPath)
    let claudeMdContent: string | null = null

    if (hasClaudeMd) {
      claudeMdContent = await fs.readFile(claudeMdPath, 'utf-8')
    }

    // Scan for agents, skills, commands
    const [agents, skills, commands, settings] = await Promise.all([
      this.getAgents(projectPath),
      this.getSkills(projectPath),
      this.getCommands(projectPath),
      this.getSettings(projectPath)
    ])

    return {
      projectPath,
      hasClaudeMd,
      claudeMdPath: hasClaudeMd ? claudeMdPath : null,
      claudeMdContent,
      agents,
      skills,
      commands,
      hasSettings: settings !== null,
      settings,
      lastScanned: new Date().toISOString()
    }
  }

  /**
   * Get all agents for a project
   */
  async getAgents(projectPath: string): Promise<ClaudeAgent[]> {
    const agentsDir = join(projectPath, '.claude', 'agents')

    if (!(await pathExists(agentsDir))) {
      return []
    }

    const files = await fs.readdir(agentsDir)
    const mdFiles = files.filter((f) => f.endsWith('.md'))

    const agents: ClaudeAgent[] = []
    for (const file of mdFiles) {
      const filePath = join(agentsDir, file)
      const name = parse(file).name

      try {
        const { content, stats } = await readMarkdownFile(filePath)
        const description = extractDescriptionFromMarkdown(content)

        agents.push({
          name,
          description,
          prompt: content,
          filePath,
          createdAt: stats.createdAt,
          updatedAt: stats.updatedAt
        })
      } catch (error) {
        console.warn(`[ClaudeConfig] Failed to read agent file ${file}:`, error)
      }
    }

    return agents
  }

  /**
   * Get all skills for a project
   */
  async getSkills(projectPath: string): Promise<ClaudeSkill[]> {
    const skillsDir = join(projectPath, '.claude', 'skills')

    if (!(await pathExists(skillsDir))) {
      return []
    }

    const files = await fs.readdir(skillsDir)
    const mdFiles = files.filter((f) => f.endsWith('.md'))

    const skills: ClaudeSkill[] = []
    for (const file of mdFiles) {
      const filePath = join(skillsDir, file)
      const name = parse(file).name

      try {
        const { content, stats } = await readMarkdownFile(filePath)
        const description = extractDescriptionFromMarkdown(content)

        // Skills are enabled by default unless filename starts with underscore
        const enabled = !name.startsWith('_')

        skills.push({
          name,
          description,
          prompt: content,
          filePath,
          enabled,
          createdAt: stats.createdAt,
          updatedAt: stats.updatedAt
        })
      } catch (error) {
        console.warn(`[ClaudeConfig] Failed to read skill file ${file}:`, error)
      }
    }

    return skills
  }

  /**
   * Get all commands for a project
   */
  async getCommands(projectPath: string): Promise<ClaudeCommand[]> {
    const commandsDir = join(projectPath, '.claude', 'commands')

    if (!(await pathExists(commandsDir))) {
      return []
    }

    const files = await fs.readdir(commandsDir)
    const mdFiles = files.filter((f) => f.endsWith('.md'))

    const commands: ClaudeCommand[] = []
    for (const file of mdFiles) {
      const filePath = join(commandsDir, file)
      const name = parse(file).name

      try {
        const { content, stats } = await readMarkdownFile(filePath)
        const description = extractDescriptionFromMarkdown(content)

        commands.push({
          name,
          description,
          prompt: content,
          filePath,
          createdAt: stats.createdAt,
          updatedAt: stats.updatedAt
        })
      } catch (error) {
        console.warn(`[ClaudeConfig] Failed to read command file ${file}:`, error)
      }
    }

    return commands
  }

  /**
   * Get settings for a project
   */
  async getSettings(projectPath: string): Promise<Record<string, unknown> | null> {
    const settingsPath = join(projectPath, '.claude', 'settings.json')

    if (!(await pathExists(settingsPath))) {
      return null
    }

    try {
      const content = await fs.readFile(settingsPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      console.warn(`[ClaudeConfig] Failed to read settings.json:`, error)
      return null
    }
  }

  // ============ Agent CRUD Operations ============

  /**
   * Create a new agent
   */
  async createAgent(
    projectPath: string,
    data: CreateClaudeAgentData
  ): Promise<ClaudeAgent> {
    // Validate name
    const validation = validateClaudeConfigName(data.name)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    // Ensure agents directory exists
    const agentsDir = join(projectPath, '.claude', 'agents')
    await ensureDir(agentsDir)

    // Create file path
    const filePath = join(agentsDir, `${data.name}.md`)

    // Check if file already exists
    if (await pathExists(filePath)) {
      throw new Error(`Agent '${data.name}' already exists`)
    }

    // Format content
    const content = formatAsMarkdown(data.name, data.description, data.prompt)

    // Write file
    await writeMarkdownFile(filePath, content)

    // Create agent object
    return createClaudeAgent(data.name, data.description, data.prompt, filePath)
  }

  /**
   * Update an existing agent
   */
  async updateAgent(
    projectPath: string,
    name: string,
    updates: Partial<CreateClaudeAgentData>
  ): Promise<ClaudeAgent> {
    const agentsDir = join(projectPath, '.claude', 'agents')
    const filePath = join(agentsDir, `${name}.md`)

    // Check if file exists
    if (!(await pathExists(filePath))) {
      throw new Error(`Agent '${name}' not found`)
    }

    // Read current content
    const { content: currentContent } = await readMarkdownFile(filePath)

    // If renaming, validate and move file
    if (updates.name && updates.name !== name) {
      const validation = validateClaudeConfigName(updates.name)
      if (!validation.valid) {
        throw new Error(validation.error)
      }

      const newFilePath = join(agentsDir, `${updates.name}.md`)
      if (await pathExists(newFilePath)) {
        throw new Error(`Agent '${updates.name}' already exists`)
      }

      // Update file path
      await fs.rename(filePath, newFilePath)
    }

    // Determine final values
    const finalName = updates.name || name
    const finalDescription = updates.description || extractDescriptionFromMarkdown(currentContent)
    const finalPrompt = updates.prompt || currentContent

    // Format and write updated content
    const content = formatAsMarkdown(finalName, finalDescription, finalPrompt)
    const finalPath = updates.name
      ? join(agentsDir, `${updates.name}.md`)
      : filePath

    await writeMarkdownFile(finalPath, content)

    return createClaudeAgent(finalName, finalDescription, finalPrompt, finalPath)
  }

  /**
   * Delete an agent
   */
  async deleteAgent(projectPath: string, name: string): Promise<void> {
    const agentsDir = join(projectPath, '.claude', 'agents')
    const filePath = join(agentsDir, `${name}.md`)

    // Check if file exists
    if (!(await pathExists(filePath))) {
      throw new Error(`Agent '${name}' not found`)
    }

    // Delete file
    await fs.unlink(filePath)
  }

  // ============ Skill CRUD Operations ============

  /**
   * Create a new skill
   */
  async createSkill(
    projectPath: string,
    data: CreateClaudeSkillData
  ): Promise<ClaudeSkill> {
    // Validate name
    const validation = validateClaudeConfigName(data.name)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    // Ensure skills directory exists
    const skillsDir = join(projectPath, '.claude', 'skills')
    await ensureDir(skillsDir)

    // Prefix with underscore if disabled
    const fileName = data.enabled === false ? `_${data.name}` : data.name
    const filePath = join(skillsDir, `${fileName}.md`)

    // Check if file already exists
    if (await pathExists(filePath)) {
      throw new Error(`Skill '${data.name}' already exists`)
    }

    // Format content
    const content = formatAsMarkdown(data.name, data.description, data.prompt)

    // Write file
    await writeMarkdownFile(filePath, content)

    // Create skill object
    return createClaudeSkill(data.name, data.description, data.prompt, filePath, data.enabled !== false)
  }

  /**
   * Update an existing skill
   */
  async updateSkill(
    projectPath: string,
    name: string,
    updates: Partial<CreateClaudeSkillData>
  ): Promise<ClaudeSkill> {
    const skillsDir = join(projectPath, '.claude', 'skills')

    // Find the current file (might be prefixed with underscore)
    const currentFileName = name.startsWith('_') ? name : name
    let filePath = join(skillsDir, `${currentFileName}.md`)

    // Try with underscore if not found
    if (!(await pathExists(filePath))) {
      filePath = join(skillsDir, `_${name}.md`)
    }

    // Check if file exists
    if (!(await pathExists(filePath))) {
      throw new Error(`Skill '${name}' not found`)
    }

    // Read current content
    const { content: currentContent } = await readMarkdownFile(filePath)
    const currentEnabled = !basename(filePath).startsWith('_')

    // Determine final values
    const finalName = updates.name || name
    const finalDescription = updates.description || extractDescriptionFromMarkdown(currentContent)
    const finalPrompt = updates.prompt || currentContent
    const finalEnabled = updates.enabled !== undefined ? updates.enabled : currentEnabled

    // If renaming, validate
    if (updates.name && updates.name !== name) {
      const validation = validateClaudeConfigName(updates.name)
      if (!validation.valid) {
        throw new Error(validation.error)
      }
    }

    // Format content
    const content = formatAsMarkdown(finalName, finalDescription, finalPrompt)

    // Determine final file path (with or without underscore)
    const finalFileName = finalEnabled ? `${finalName}.md` : `_${finalName}.md`
    const finalPath = join(skillsDir, finalFileName)

    // If path changed, rename
    if (finalPath !== filePath) {
      if (await pathExists(finalPath)) {
        throw new Error(`Skill '${finalName}' already exists`)
      }
      await fs.rename(filePath, finalPath)
    }

    // Write updated content
    await writeMarkdownFile(finalPath, content)

    return createClaudeSkill(finalName, finalDescription, finalPrompt, finalPath, finalEnabled)
  }

  /**
   * Delete a skill
   */
  async deleteSkill(projectPath: string, name: string): Promise<void> {
    const skillsDir = join(projectPath, '.claude', 'skills')

    // Try both with and without underscore
    let filePath = join(skillsDir, `${name}.md`)
    if (!(await pathExists(filePath))) {
      filePath = join(skillsDir, `_${name}.md`)
    }

    // Check if file exists
    if (!(await pathExists(filePath))) {
      throw new Error(`Skill '${name}' not found`)
    }

    // Delete file
    await fs.unlink(filePath)
  }

  /**
   * Toggle a skill's enabled state
   */
  async toggleSkill(projectPath: string, name: string, enabled: boolean): Promise<ClaudeSkill> {
    return this.updateSkill(projectPath, name, { enabled })
  }

  // ============ Command CRUD Operations ============

  /**
   * Create a new command
   */
  async createCommand(
    projectPath: string,
    data: CreateClaudeCommandData
  ): Promise<ClaudeCommand> {
    // Validate name
    const validation = validateClaudeConfigName(data.name)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    // Ensure commands directory exists
    const commandsDir = join(projectPath, '.claude', 'commands')
    await ensureDir(commandsDir)

    // Create file path
    const filePath = join(commandsDir, `${data.name}.md`)

    // Check if file already exists
    if (await pathExists(filePath)) {
      throw new Error(`Command '${data.name}' already exists`)
    }

    // Format content
    const content = formatAsMarkdown(data.name, data.description, data.prompt)

    // Write file
    await writeMarkdownFile(filePath, content)

    // Create command object
    return createClaudeCommand(data.name, data.description, data.prompt, filePath)
  }

  /**
   * Update an existing command
   */
  async updateCommand(
    projectPath: string,
    name: string,
    updates: Partial<CreateClaudeCommandData>
  ): Promise<ClaudeCommand> {
    const commandsDir = join(projectPath, '.claude', 'commands')
    const filePath = join(commandsDir, `${name}.md`)

    // Check if file exists
    if (!(await pathExists(filePath))) {
      throw new Error(`Command '${name}' not found`)
    }

    // Read current content
    const { content: currentContent } = await readMarkdownFile(filePath)

    // If renaming, validate and move file
    if (updates.name && updates.name !== name) {
      const validation = validateClaudeConfigName(updates.name)
      if (!validation.valid) {
        throw new Error(validation.error)
      }

      const newFilePath = join(commandsDir, `${updates.name}.md`)
      if (await pathExists(newFilePath)) {
        throw new Error(`Command '${updates.name}' already exists`)
      }

      // Update file path
      await fs.rename(filePath, newFilePath)
    }

    // Determine final values
    const finalName = updates.name || name
    const finalDescription = updates.description || extractDescriptionFromMarkdown(currentContent)
    const finalPrompt = updates.prompt || currentContent

    // Format and write updated content
    const content = formatAsMarkdown(finalName, finalDescription, finalPrompt)
    const finalPath = updates.name
      ? join(commandsDir, `${updates.name}.md`)
      : filePath

    await writeMarkdownFile(finalPath, content)

    return createClaudeCommand(finalName, finalDescription, finalPrompt, finalPath)
  }

  /**
   * Delete a command
   */
  async deleteCommand(projectPath: string, name: string): Promise<void> {
    const commandsDir = join(projectPath, '.claude', 'commands')
    const filePath = join(commandsDir, `${name}.md`)

    // Check if file exists
    if (!(await pathExists(filePath))) {
      throw new Error(`Command '${name}' not found`)
    }

    // Delete file
    await fs.unlink(filePath)
  }

  // ============ CLAUDE.md Operations ============

  /**
   * Create or update CLAUDE.md file
   */
  async updateClaudeMd(projectPath: string, content: string): Promise<void> {
    const claudeMdPath = join(projectPath, 'CLAUDE.md')
    await writeMarkdownFile(claudeMdPath, content)
  }

  /**
   * Delete CLAUDE.md file
   */
  async deleteClaudeMd(projectPath: string): Promise<void> {
    const claudeMdPath = join(projectPath, 'CLAUDE.md')
    if (await pathExists(claudeMdPath)) {
      await fs.unlink(claudeMdPath)
    }
  }
}

/**
 * Singleton instance
 */
export const claudeConfigManager = new ClaudeConfigManager()
