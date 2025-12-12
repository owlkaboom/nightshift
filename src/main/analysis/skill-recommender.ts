/**
 * Skill Recommender for Project Analysis
 *
 * Maps detected technologies and patterns to skill recommendations
 * using pre-defined templates and AI-enhanced suggestions.
 */

import type {
  DetectedTechnology,
  DetectedPattern,
  SkillRecommendation,
  SkillPriority
} from '@shared/types'
import { generateRecommendationId } from '@shared/types'
import {
  getTemplatesForTechnology,
  getRelatedTemplates,
  hasTechnologyTemplate,
  SKILL_TEMPLATES
} from './skill-templates'

/**
 * Priority boost rules based on technology combinations
 */
const PRIORITY_BOOSTS: Array<{
  technologies: string[]
  skillName: string
  boost: number
}> = [
  // TypeScript + React = high priority for both
  { technologies: ['TypeScript', 'React'], skillName: 'TypeScript Expert', boost: 0.2 },
  { technologies: ['TypeScript', 'React'], skillName: 'React Best Practices', boost: 0.2 },

  // Next.js implies React patterns are important
  { technologies: ['Next.js'], skillName: 'React Best Practices', boost: 0.1 },

  // Testing framework + framework = high priority testing
  { technologies: ['Jest', 'React'], skillName: 'Jest Testing Expert', boost: 0.2 },
  { technologies: ['Vitest', 'Vue'], skillName: 'Vitest Testing', boost: 0.2 },

  // Database + TypeScript = type-safe ORM patterns
  { technologies: ['Prisma', 'TypeScript'], skillName: 'Prisma ORM Expert', boost: 0.2 },

  // Docker + framework = containerization is relevant
  { technologies: ['Docker', 'Node.js'], skillName: 'Docker Best Practices', boost: 0.1 }
]

/**
 * Pattern to skill mappings
 */
const PATTERN_SKILL_MAPPINGS: Array<{
  patternName: string
  skills: Array<{ name: string; priority: SkillPriority; reason: string }>
}> = [
  {
    patternName: 'Test-Driven Development',
    skills: [
      {
        name: 'Test-Driven Development',
        priority: 'high',
        reason: 'Project follows TDD practices with comprehensive test coverage'
      }
    ]
  },
  {
    patternName: 'Component-Driven Development',
    skills: [
      {
        name: 'Component Architecture',
        priority: 'medium',
        reason: 'Project uses component-driven development with reusable UI components'
      }
    ]
  },
  {
    patternName: 'Type-First Development',
    skills: [
      {
        name: 'Type Safety Expert',
        priority: 'high',
        reason: 'Project emphasizes type safety with strict TypeScript configuration'
      }
    ]
  },
  {
    patternName: 'Documentation Focus',
    skills: [
      {
        name: 'Documentation Focus',
        priority: 'medium',
        reason: 'Project values comprehensive documentation'
      }
    ]
  },
  {
    patternName: 'Monorepo Structure',
    skills: [
      {
        name: 'Monorepo Patterns',
        priority: 'medium',
        reason: 'Project uses monorepo structure requiring cross-package awareness'
      }
    ]
  },
  {
    patternName: 'Containerization',
    skills: [
      {
        name: 'Docker Best Practices',
        priority: 'medium',
        reason: 'Project uses containerization for deployment'
      }
    ]
  }
]

/**
 * Custom skill templates for pattern-based recommendations
 */
const PATTERN_SKILL_TEMPLATES: Record<string, { description: string; promptTemplate: string }> = {
  'Component Architecture': {
    description: 'Best practices for component-driven development',
    promptTemplate: `You are a UI/UX expert focused on component architecture. Follow these practices:
- Design components with single responsibility
- Use composition over inheritance
- Create reusable, configurable components
- Document component APIs and usage
- Consider accessibility from the start
- Use consistent naming conventions
- Implement proper prop typing
- Handle edge cases (loading, error, empty states)`
  },
  'Type Safety Expert': {
    description: 'Maximize type safety and type inference',
    promptTemplate: `You are a type safety expert. Follow these practices:
- Use strict TypeScript configuration
- Leverage type inference where possible
- Create precise, narrow types
- Use discriminated unions for state
- Validate at boundaries with runtime checks
- Avoid type assertions (as) when possible
- Use generics for reusable type-safe code
- Document complex types with JSDoc`
  },
  'Monorepo Patterns': {
    description: 'Best practices for monorepo development',
    promptTemplate: `You are a monorepo expert. Follow these practices:
- Maintain clear package boundaries
- Use shared configurations
- Optimize build caching
- Manage dependencies carefully
- Use internal packages for shared code
- Follow consistent versioning strategies
- Consider impact on all packages when making changes
- Use workspace protocols for internal dependencies`
  }
}

/**
 * Calculate priority for a recommendation
 */
function calculatePriority(
  skillName: string,
  basePriority: SkillPriority,
  detectedTechs: string[]
): SkillPriority {
  let priorityValue = basePriority === 'high' ? 3 : basePriority === 'medium' ? 2 : 1

  // Apply boost rules
  for (const boost of PRIORITY_BOOSTS) {
    if (boost.skillName === skillName) {
      const hasAllTechs = boost.technologies.every((t) =>
        detectedTechs.some((dt) => dt.toLowerCase() === t.toLowerCase())
      )
      if (hasAllTechs) {
        priorityValue += boost.boost * 3 // Scale boost to priority range
      }
    }
  }

  // Convert back to priority
  if (priorityValue >= 3) return 'high'
  if (priorityValue >= 2) return 'medium'
  return 'low'
}

/**
 * Generate recommendations from detected technologies
 */
function generateTechnologyRecommendations(
  technologies: DetectedTechnology[]
): SkillRecommendation[] {
  const recommendations: SkillRecommendation[] = []
  const addedSkills = new Set<string>()
  const detectedTechNames = technologies.map((t) => t.name)

  // Get templates for each detected technology
  for (const tech of technologies) {
    // Skip low confidence detections
    if (tech.confidence < 0.5) continue

    const templates = getTemplatesForTechnology(tech.name)

    for (const template of templates) {
      if (addedSkills.has(template.name)) continue

      const priority = calculatePriority(template.name, template.defaultPriority, detectedTechNames)

      recommendations.push({
        id: generateRecommendationId(),
        name: template.name,
        description: template.description,
        reason: `Detected ${tech.name} in project (${tech.signals.slice(0, 2).join(', ')})`,
        priority,
        suggestedPrompt: template.promptTemplate,
        basedOn: [tech.name],
        selected: false
      })

      addedSkills.add(template.name)
    }
  }

  // Add related templates (for technologies that are commonly used together)
  const relatedTemplates = getRelatedTemplates(detectedTechNames)
  for (const template of relatedTemplates) {
    if (addedSkills.has(template.name)) continue

    // Only add if confidence from related technologies is strong enough
    const hasStrongRelation = technologies.some(
      (t) =>
        template.relatedTechnologies?.some((rt) => rt.toLowerCase() === t.name.toLowerCase()) &&
        t.confidence >= 0.8
    )

    if (hasStrongRelation) {
      recommendations.push({
        id: generateRecommendationId(),
        name: template.name,
        description: template.description,
        reason: `Recommended based on related technologies in the project`,
        priority: 'low',
        suggestedPrompt: template.promptTemplate,
        basedOn: template.relatedTechnologies || [],
        selected: false
      })

      addedSkills.add(template.name)
    }
  }

  return recommendations
}

/**
 * Generate recommendations from detected patterns
 */
function generatePatternRecommendations(patterns: DetectedPattern[]): SkillRecommendation[] {
  const recommendations: SkillRecommendation[] = []
  const addedSkills = new Set<string>()

  for (const pattern of patterns) {
    // Skip low confidence patterns
    if (pattern.confidence < 0.5) continue

    // Find matching skill mappings
    const mapping = PATTERN_SKILL_MAPPINGS.find((m) => m.patternName === pattern.name)

    if (mapping) {
      for (const skill of mapping.skills) {
        if (addedSkills.has(skill.name)) continue

        // Get template if exists, otherwise use pattern-based template
        let promptTemplate: string
        let description: string

        // First try to find in skill templates
        const templates = SKILL_TEMPLATES.filter((t) => t.name === skill.name)
        if (templates.length > 0) {
          promptTemplate = templates[0].promptTemplate
          description = templates[0].description
        } else if (PATTERN_SKILL_TEMPLATES[skill.name]) {
          promptTemplate = PATTERN_SKILL_TEMPLATES[skill.name].promptTemplate
          description = PATTERN_SKILL_TEMPLATES[skill.name].description
        } else {
          // Generic template
          promptTemplate = `You are an expert in ${skill.name}. Follow best practices and maintain consistency with the project's established patterns.`
          description = `Best practices for ${skill.name}`
        }

        recommendations.push({
          id: generateRecommendationId(),
          name: skill.name,
          description,
          reason: skill.reason,
          priority: skill.priority,
          suggestedPrompt: promptTemplate,
          basedOn: [pattern.name],
          selected: false
        })

        addedSkills.add(skill.name)
      }
    }
  }

  return recommendations
}

/**
 * Deduplicate and merge recommendations
 */
function mergeRecommendations(
  techRecommendations: SkillRecommendation[],
  patternRecommendations: SkillRecommendation[]
): SkillRecommendation[] {
  const merged = new Map<string, SkillRecommendation>()

  // Add technology recommendations first
  for (const rec of techRecommendations) {
    merged.set(rec.name, rec)
  }

  // Merge pattern recommendations
  for (const rec of patternRecommendations) {
    const existing = merged.get(rec.name)

    if (existing) {
      // Merge: take higher priority, combine basedOn
      const priorityOrder: Record<SkillPriority, number> = { high: 3, medium: 2, low: 1 }

      if (priorityOrder[rec.priority] > priorityOrder[existing.priority]) {
        existing.priority = rec.priority
      }

      // Combine basedOn arrays
      const combined = new Set([...existing.basedOn, ...rec.basedOn])
      existing.basedOn = Array.from(combined)

      // Append reason if different
      if (rec.reason !== existing.reason) {
        existing.reason = `${existing.reason}. Also: ${rec.reason}`
      }
    } else {
      merged.set(rec.name, rec)
    }
  }

  return Array.from(merged.values())
}

/**
 * Sort recommendations by priority and relevance
 */
function sortRecommendations(recommendations: SkillRecommendation[]): SkillRecommendation[] {
  const priorityOrder: Record<SkillPriority, number> = { high: 0, medium: 1, low: 2 }

  return [...recommendations].sort((a, b) => {
    // First by priority
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff !== 0) return priorityDiff

    // Then by number of basedOn (more evidence = more relevant)
    return b.basedOn.length - a.basedOn.length
  })
}

/**
 * Main skill recommendation function
 *
 * Generates skill recommendations based on detected technologies and patterns
 */
export function generateSkillRecommendations(
  technologies: DetectedTechnology[],
  patterns: DetectedPattern[]
): SkillRecommendation[] {
  const techRecommendations = generateTechnologyRecommendations(technologies)
  const patternRecommendations = generatePatternRecommendations(patterns)

  const merged = mergeRecommendations(techRecommendations, patternRecommendations)
  return sortRecommendations(merged)
}

/**
 * Get recommendations with a maximum count
 */
export function getTopRecommendations(
  technologies: DetectedTechnology[],
  patterns: DetectedPattern[],
  maxCount: number = 10
): SkillRecommendation[] {
  const all = generateSkillRecommendations(technologies, patterns)
  return all.slice(0, maxCount)
}

/**
 * Filter recommendations by priority
 */
export function filterRecommendationsByPriority(
  recommendations: SkillRecommendation[],
  minPriority: SkillPriority
): SkillRecommendation[] {
  const priorityOrder: Record<SkillPriority, number> = { high: 0, medium: 1, low: 2 }
  const minOrder = priorityOrder[minPriority]

  return recommendations.filter((r) => priorityOrder[r.priority] <= minOrder)
}

/**
 * Check if a technology has any associated skill recommendations
 */
export function hasSkillsForTechnology(technology: string): boolean {
  return hasTechnologyTemplate(technology)
}
