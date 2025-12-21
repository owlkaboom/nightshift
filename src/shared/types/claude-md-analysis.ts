/**
 * Types for CLAUDE.md analysis
 */

/**
 * Section detected in CLAUDE.md
 */
export interface ClaudeMdSection {
  /** Section title (without ## prefix) */
  title: string
  /** Line number where section starts */
  lineStart: number
  /** Line number where section ends */
  lineEnd: number
  /** Preview of section content (first 100 chars) */
  preview: string
  /** Header level (2 for ##, 3 for ###, etc.) */
  level: number
}

/**
 * Sub-file in .claude/docs/
 */
export interface ClaudeMdSubFile {
  /** Full file path */
  path: string
  /** File name */
  name: string
  /** Description extracted from file (if any) */
  description: string | null
  /** Number of lines in file */
  lineCount: number
  /** File size in bytes */
  sizeBytes: number
  /** Last modified time */
  lastModified: string
}

/**
 * Analysis result for a project's CLAUDE.md file
 */
export interface ClaudeMdAnalysis {
  /** Whether CLAUDE.md exists */
  exists: boolean
  /** Path to CLAUDE.md file (null if doesn't exist) */
  path: string | null
  /** Full content of CLAUDE.md (null if doesn't exist) */
  content: string | null

  // Quality metrics
  /** Number of lines in CLAUDE.md */
  lineCount: number
  /** Number of sections (## headers) */
  sectionCount: number
  /** Whether file has Quick Start section */
  hasQuickStart: boolean
  /** Whether file has Code Conventions section */
  hasCodeConventions: boolean
  /** Whether file has Tech Stack section */
  hasTechStack: boolean
  /** Whether file has Testing Guidelines section */
  hasTestingGuidelines: boolean
  /** Whether file has Architecture Info section */
  hasArchitectureInfo: boolean

  /** Detected sections in CLAUDE.md */
  sections: ClaudeMdSection[]
  /** Sub-files in .claude/docs/ */
  subFiles: ClaudeMdSubFile[]

  /** Quality score (0-100) */
  qualityScore: number
  /** Recommendations for improvement */
  recommendations: string[]

  /** When this analysis was performed */
  analyzedAt: string
}

/**
 * Analyze CLAUDE.md content and extract sections
 */
export function analyzeClaudeMd(
  content: string | null,
  path: string | null,
  subFiles: ClaudeMdSubFile[]
): ClaudeMdAnalysis {
  if (!content || !path) {
    return {
      exists: false,
      path: null,
      content: null,
      lineCount: 0,
      sectionCount: 0,
      hasQuickStart: false,
      hasCodeConventions: false,
      hasTechStack: false,
      hasTestingGuidelines: false,
      hasArchitectureInfo: false,
      sections: [],
      subFiles: [],
      qualityScore: 0,
      recommendations: [
        'Create CLAUDE.md to provide AI context for your project',
        'Add Quick Start section with essential setup commands',
        'Document your code conventions and architectural decisions'
      ],
      analyzedAt: new Date().toISOString()
    }
  }

  const lines = content.split('\n')
  const sections: ClaudeMdSection[] = []

  // Parse sections
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(/^(#{2,})\s+(.+)$/)

    if (match) {
      const level = match[1].length
      const title = match[2].trim()

      // Find end of section (next header of same or higher level, or end of file)
      let endLine = lines.length - 1
      for (let j = i + 1; j < lines.length; j++) {
        const nextMatch = lines[j].match(/^#{2,}\s+/)
        if (nextMatch && nextMatch[0].length <= level + 1) {
          endLine = j - 1
          break
        }
      }

      // Get preview (first non-empty line after header)
      let preview = ''
      for (let j = i + 1; j <= Math.min(i + 5, endLine); j++) {
        const contentLine = lines[j].trim()
        if (contentLine && !contentLine.startsWith('#')) {
          preview = contentLine.slice(0, 100)
          break
        }
      }

      sections.push({
        title,
        lineStart: i + 1, // 1-indexed for user display
        lineEnd: endLine + 1,
        preview,
        level
      })
    }
  }

  // Detect common sections in CLAUDE.md content
  const sectionTitles = sections.map(s => s.title.toLowerCase())

  // Also check sub-files for these topics
  const subFileNames = subFiles.map(f => f.name.toLowerCase())

  const hasQuickStart = sectionTitles.some(t =>
    t.includes('quick start') || t.includes('getting started') || t.includes('setup')
  )
  const hasCodeConventions = sectionTitles.some(t =>
    t.includes('convention') || t.includes('code style') || t.includes('standards')
  )
  const hasTechStack = sectionTitles.some(t =>
    t.includes('tech') || t.includes('stack') || t.includes('technology')
  )

  /**
   * Check both section titles AND sub-files for testing guidelines
   * Matches various testing-related terms to capture all testing documentation:
   * - test, testing: General test guidelines, TDD practices
   * - spec: Specification files, BDD patterns
   * - qa: Quality assurance processes
   * - quality: Code quality, quality metrics
   * - coverage: Test coverage requirements
   *
   * Examples that would be detected:
   * - CLAUDE.md sections: "## Testing", "## Test Strategy", "## QA Process"
   * - Sub-files: "testing.md", "test-guidelines.md", "qa-checklist.md", "spec-patterns.md"
   */
  const testingKeywords = ['test', 'testing', 'spec', 'qa', 'quality', 'coverage']
  const hasTestingGuidelines =
    sectionTitles.some(t => testingKeywords.some(keyword => t.includes(keyword))) ||
    subFileNames.some(f => testingKeywords.some(keyword => f.includes(keyword)))

  // Check both section titles AND sub-files for architecture info
  const hasArchitectureInfo =
    sectionTitles.some(t => t.includes('architecture') || t.includes('design') || t.includes('structure')) ||
    subFileNames.some(f => f.includes('architecture') || f.includes('arch'))

  const qualityScore = calculateQualityScore({
    exists: true,
    lineCount: lines.length,
    sectionCount: sections.length,
    hasQuickStart,
    hasCodeConventions,
    hasTechStack,
    hasTestingGuidelines,
    hasArchitectureInfo,
    hasSubFiles: subFiles.length > 0
  })

  const recommendations = generateRecommendations({
    hasQuickStart,
    hasCodeConventions,
    hasTechStack,
    hasTestingGuidelines,
    hasArchitectureInfo,
    hasSubFiles: subFiles.length > 0,
    sectionCount: sections.length,
    lineCount: lines.length
  })

  return {
    exists: true,
    path,
    content,
    lineCount: lines.length,
    sectionCount: sections.length,
    hasQuickStart,
    hasCodeConventions,
    hasTechStack,
    hasTestingGuidelines,
    hasArchitectureInfo,
    sections,
    subFiles,
    qualityScore,
    recommendations,
    analyzedAt: new Date().toISOString()
  }
}

/**
 * Calculate quality score for CLAUDE.md
 */
export function calculateQualityScore(params: {
  exists: boolean
  lineCount: number
  sectionCount: number
  hasQuickStart: boolean
  hasCodeConventions: boolean
  hasTechStack: boolean
  hasTestingGuidelines: boolean
  hasArchitectureInfo: boolean
  hasSubFiles: boolean
}): number {
  if (!params.exists) return 0

  let score = 0

  // Base points for existence and content
  if (params.lineCount > 0) score += 20
  if (params.lineCount > 50) score += 5
  if (params.lineCount > 100) score += 5

  // Section diversity
  if (params.sectionCount >= 3) score += 15
  if (params.sectionCount >= 5) score += 5

  // Essential sections
  if (params.hasQuickStart) score += 15
  if (params.hasCodeConventions) score += 15
  if (params.hasArchitectureInfo) score += 15

  // Nice-to-have sections
  if (params.hasTestingGuidelines) score += 10
  if (params.hasTechStack) score += 10

  // Advanced organization
  if (params.hasSubFiles) score += 10

  return Math.min(100, score)
}

/**
 * Generate recommendations for improving CLAUDE.md
 */
export function generateRecommendations(params: {
  hasQuickStart: boolean
  hasCodeConventions: boolean
  hasTechStack: boolean
  hasTestingGuidelines: boolean
  hasArchitectureInfo: boolean
  hasSubFiles: boolean
  sectionCount: number
  lineCount: number
}): string[] {
  const recommendations: string[] = []

  if (!params.hasQuickStart) {
    recommendations.push('Add a Quick Start section with essential setup commands')
  }

  if (!params.hasCodeConventions) {
    recommendations.push('Document your code conventions and style guidelines')
  }

  if (!params.hasArchitectureInfo) {
    recommendations.push('Add an Architecture Overview section to explain system design')
  }

  if (!params.hasTestingGuidelines) {
    recommendations.push('Include testing guidelines and best practices')
  }

  if (!params.hasTechStack) {
    recommendations.push('Document your technology stack and key dependencies')
  }

  // File organization recommendations based on size
  if (params.lineCount > 300 && !params.hasSubFiles) {
    recommendations.push(
      'CLAUDE.md is over 300 lines. Consider restructuring it as an index file with links to focused documentation in .claude/docs/ (e.g., ARCHITECTURE.md, API.md, TESTING.md)'
    )
  } else if (params.lineCount > 250 && !params.hasSubFiles) {
    recommendations.push(
      'CLAUDE.md is approaching 300 lines. Consider moving detailed sections to separate files in .claude/docs/ to keep the main file focused'
    )
  } else if (!params.hasSubFiles && params.sectionCount > 7) {
    recommendations.push(
      'Consider organizing detailed sections into separate files in .claude/docs/ to improve maintainability'
    )
  }

  if (params.sectionCount < 3) {
    recommendations.push('Add more sections to provide comprehensive project context')
  }

  if (recommendations.length === 0) {
    recommendations.push('Your CLAUDE.md is well-structured! Consider adding examples or edge cases.')
  }

  return recommendations
}
