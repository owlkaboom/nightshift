/**
 * Documentation Generator
 *
 * Analyzes projects and generates documentation using AI agents.
 * Handles project context gathering, template application, and
 * documentation analysis.
 */

import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import type {
  DocGenerationRequest,
  DocumentationType,
  ExistingDocAnalysis,
  DocSuggestion,
  DocTemplate
} from '@shared/types'
import { getDefaultDocPath } from '@shared/types'
import { getAllTemplates, getTemplate } from './templates'
import { fileExists } from '../storage/file-store'

/**
 * Documentation Generator class
 * Provides static methods for documentation analysis and generation
 */
export class DocumentationGenerator {
  /**
   * Analyze existing documentation in a project
   */
  static async analyzeExisting(
    projectPath: string
  ): Promise<ExistingDocAnalysis> {
    const docs: Array<{
      path: string
      type: DocumentationType
      lastModified: string
    }> = []

    // Check for common documentation files
    const checks: Array<{
      path: string
      type: DocumentationType
    }> = [
      { path: 'CLAUDE.md', type: 'claude-md' },
      { path: 'README.md', type: 'readme' },
      { path: '.claude/docs/ARCHITECTURE.md', type: 'architecture' },
      { path: 'ARCHITECTURE.md', type: 'architecture' },
      { path: '.claude/docs/API.md', type: 'api' },
      { path: 'API.md', type: 'api' },
      { path: 'CONTRIBUTING.md', type: 'contributing' },
      { path: 'CHANGELOG.md', type: 'changelog' }
    ]

    for (const check of checks) {
      const fullPath = join(projectPath, check.path)
      if (await fileExists(fullPath)) {
        const stats = await stat(fullPath)
        docs.push({
          path: check.path,
          type: check.type,
          lastModified: stats.mtime.toISOString()
        })
      }
    }

    const analysis: ExistingDocAnalysis = {
      hasClaudeMd: docs.some((d) => d.type === 'claude-md'),
      hasReadme: docs.some((d) => d.type === 'readme'),
      hasArchitectureDocs: docs.some((d) => d.type === 'architecture'),
      hasApiDocs: docs.some((d) => d.type === 'api'),
      docs,
      suggestions: []
    }

    // Generate suggestions based on what's missing
    if (!analysis.hasClaudeMd) {
      analysis.suggestions.push(
        'Add CLAUDE.md to help AI assistants understand your project'
      )
    }
    if (!analysis.hasReadme) {
      analysis.suggestions.push(
        'Add README.md to document your project for users'
      )
    }
    if (!analysis.hasArchitectureDocs) {
      analysis.suggestions.push(
        'Add architecture documentation to explain system design'
      )
    }

    return analysis
  }

  /**
   * Suggest documentation improvements for a project
   */
  static async suggestImprovements(
    projectPath: string
  ): Promise<DocSuggestion[]> {
    const analysis = await this.analyzeExisting(projectPath)
    const suggestions: DocSuggestion[] = []

    // High priority: CLAUDE.md for AI assistance
    if (!analysis.hasClaudeMd) {
      suggestions.push({
        type: 'claude-md',
        reason: 'Help AI assistants work effectively on your codebase',
        priority: 'high',
        isUpdate: false
      })
    }

    // High priority: README for project overview
    if (!analysis.hasReadme) {
      suggestions.push({
        type: 'readme',
        reason: 'Provide an overview for developers discovering your project',
        priority: 'high',
        isUpdate: false
      })
    }

    // Medium priority: Architecture docs
    if (!analysis.hasArchitectureDocs) {
      suggestions.push({
        type: 'architecture',
        reason: 'Document system design and component relationships',
        priority: 'medium',
        isUpdate: false
      })
    }

    // Check for outdated docs (over 90 days old)
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000
    for (const doc of analysis.docs) {
      const lastModified = new Date(doc.lastModified).getTime()
      if (lastModified < ninetyDaysAgo) {
        suggestions.push({
          type: doc.type,
          reason: `${doc.path} hasn't been updated in over 90 days`,
          priority: 'low',
          isUpdate: true
        })
      }
    }

    return suggestions
  }

  /**
   * Get all available templates
   */
  static async getTemplates(): Promise<DocTemplate[]> {
    return getAllTemplates()
  }

  /**
   * Get a specific template
   */
  static async getTemplate(type: DocumentationType): Promise<DocTemplate> {
    return getTemplate(type)
  }

  /**
   * Build generation prompt for a documentation type
   */
  static async buildGenerationPrompt(
    request: DocGenerationRequest,
    projectPath: string,
    projectName: string
  ): Promise<string> {
    const template = getTemplate(request.type)

    // Read project context
    const context = await this.gatherProjectContext(projectPath, request.type)

    // Build the prompt
    let prompt = template.generationPrompt

    // Add project context
    prompt += `\n\n## Project Information\n\n`
    prompt += `**Project Name:** ${projectName}\n`
    prompt += `**Project Path:** ${projectPath}\n\n`

    // Add package.json info if available
    if (context.packageJson) {
      prompt += `**Package.json:**\n\`\`\`json\n${JSON.stringify(context.packageJson, null, 2)}\n\`\`\`\n\n`
    }

    // Add directory structure
    if (context.structure) {
      prompt += `**Directory Structure:**\n\`\`\`\n${context.structure}\n\`\`\`\n\n`
    }

    // Add existing docs reference if updating
    if (request.updateExisting && context.existingContent) {
      prompt += `\n## Existing Documentation\n\n`
      prompt += `You are updating existing documentation. Here is the current content:\n\n`
      prompt += `\`\`\`markdown\n${context.existingContent}\n\`\`\`\n\n`
      prompt += `Please update this documentation while preserving its structure and good parts.\n\n`
    }

    // Add custom instructions
    if (request.customInstructions) {
      prompt += `\n## Additional Requirements\n\n${request.customInstructions}\n\n`
    }

    // Add section focus if specified
    if (request.sections && request.sections.length > 0) {
      prompt += `\n## Focus Sections\n\n`
      prompt += `Please focus on these sections:\n`
      for (const sectionId of request.sections) {
        const section = template.sections.find((s) => s.id === sectionId)
        if (section) {
          prompt += `- **${section.name}**: ${section.description}\n`
        }
      }
      prompt += `\n`
    }

    prompt += `\nGenerate the complete ${getDocumentationTypeLabel(request.type)} documentation now.`

    return prompt
  }

  /**
   * Gather project context for documentation generation
   */
  private static async gatherProjectContext(
    projectPath: string,
    docType: DocumentationType
  ): Promise<ProjectContext> {
    const context: ProjectContext = {}

    // Read package.json if it exists
    const packageJsonPath = join(projectPath, 'package.json')
    if (await fileExists(packageJsonPath)) {
      try {
        const content = await readFile(packageJsonPath, 'utf-8')
        context.packageJson = JSON.parse(content)
      } catch (error) {
        console.error('[DocGenerator] Error reading package.json:', error)
      }
    }

    // Get directory structure (simplified)
    context.structure = await this.getDirectoryTree(projectPath, 2)

    // Read existing doc if updating
    const docPath = getDefaultDocPath(docType, projectPath)
    if (await fileExists(docPath)) {
      try {
        context.existingContent = await readFile(docPath, 'utf-8')
      } catch (error) {
        console.error('[DocGenerator] Error reading existing doc:', error)
      }
    }

    return context
  }

  /**
   * Get a simplified directory tree
   */
  private static async getDirectoryTree(
    dirPath: string,
    maxDepth: number,
    currentDepth = 0
  ): Promise<string> {
    if (currentDepth >= maxDepth) {
      return ''
    }

    const { readdir } = await import('fs/promises')
    const indent = '  '.repeat(currentDepth)
    let tree = ''

    try {
      const entries = await readdir(dirPath, { withFileTypes: true })

      // Filter out common ignore patterns
      const filtered = entries.filter((entry) => {
        const name = entry.name
        return (
          !name.startsWith('.') &&
          name !== 'node_modules' &&
          name !== 'dist' &&
          name !== 'build' &&
          name !== 'coverage'
        )
      })

      for (const entry of filtered.slice(0, 20)) {
        // Limit to 20 items per directory
        if (entry.isDirectory()) {
          tree += `${indent}${entry.name}/\n`
          const subTree = await this.getDirectoryTree(
            join(dirPath, entry.name),
            maxDepth,
            currentDepth + 1
          )
          tree += subTree
        } else {
          tree += `${indent}${entry.name}\n`
        }
      }
    } catch (error) {
      console.error('[DocGenerator] Error reading directory:', error)
    }

    return tree
  }
}

/**
 * Project context gathered for documentation generation
 */
interface ProjectContext {
  packageJson?: Record<string, unknown>
  structure?: string
  existingContent?: string
}

/**
 * Get documentation type label for display
 */
function getDocumentationTypeLabel(type: DocumentationType): string {
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
    default:
      return 'Documentation'
  }
}
