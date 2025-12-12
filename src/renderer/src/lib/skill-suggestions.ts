/**
 * Utility for suggesting skills based on task title and prompt content
 */

import type { Skill } from '@shared/types'

/**
 * Keywords that suggest specific skills should be selected
 * Maps skill IDs to arrays of keywords/phrases that indicate relevance
 */
const SKILL_KEYWORDS: Record<string, string[]> = {
  // TypeScript Expert
  skill_typescript: [
    'typescript',
    'ts',
    'type',
    'types',
    'typing',
    'interface',
    'generic',
    'generics',
    'strict',
    'any type',
    'type annotation',
    'type-safe',
    'typesafe'
  ],

  // Test-Driven Development
  skill_testing: [
    'test',
    'tests',
    'testing',
    'unit test',
    'integration test',
    'e2e',
    'end-to-end',
    'spec',
    'specs',
    'coverage',
    'jest',
    'vitest',
    'mocha',
    'chai',
    'cypress',
    'playwright',
    'tdd',
    'mock',
    'mocking',
    'stub',
    'assert',
    'expect'
  ],

  // Documentation Focus
  skill_documentation: [
    'document',
    'documentation',
    'docs',
    'readme',
    'jsdoc',
    'comment',
    'comments',
    'docstring',
    'api docs',
    'explain',
    'description'
  ],

  // Security Conscious
  skill_security: [
    'security',
    'secure',
    'auth',
    'authentication',
    'authorization',
    'permission',
    'permissions',
    'sanitize',
    'validate',
    'validation',
    'xss',
    'csrf',
    'injection',
    'sql injection',
    'vulnerability',
    'encrypt',
    'encryption',
    'password',
    'token',
    'jwt',
    'oauth',
    'owasp',
    'safe',
    'unsafe'
  ],

  // Performance Optimization
  skill_performance: [
    'performance',
    'optimize',
    'optimization',
    'fast',
    'faster',
    'slow',
    'speed',
    'efficient',
    'efficiency',
    'memory',
    'cache',
    'caching',
    'lazy',
    'lazy load',
    'bottleneck',
    'profile',
    'profiling',
    'benchmark',
    'render',
    'rerender',
    're-render'
  ],

  // React Best Practices
  skill_react: [
    'react',
    'component',
    'components',
    'hook',
    'hooks',
    'usestate',
    'useeffect',
    'usememo',
    'usecallback',
    'useref',
    'usecontext',
    'context',
    'provider',
    'jsx',
    'tsx',
    'prop',
    'props',
    'state',
    'redux',
    'zustand',
    'recoil'
  ],

  // Systematic Debugging
  skill_debugging: [
    'debug',
    'debugging',
    'bug',
    'bugs',
    'fix',
    'fixing',
    'broken',
    'error',
    'errors',
    'issue',
    'issues',
    'problem',
    'crash',
    'crashes',
    'failing',
    'failure',
    'wrong',
    'incorrect',
    'investigate',
    'troubleshoot'
  ],

  // Clean Code
  skill_clean_code: [
    'refactor',
    'refactoring',
    'clean',
    'cleanup',
    'clean up',
    'readable',
    'readability',
    'maintainable',
    'maintainability',
    'simplify',
    'organize',
    'structure',
    'restructure',
    'improve code',
    'code quality',
    'dry',
    'solid',
    'naming',
    'rename'
  ]
}

/**
 * Suggests skills based on the task title and prompt content
 *
 * @param title - The task title
 * @param prompt - The task prompt/description
 * @param availableSkills - List of skills that can be suggested (should be enabled skills)
 * @returns Array of skill IDs that are suggested for this task
 */
export function suggestSkills(
  title: string,
  prompt: string,
  availableSkills: Skill[]
): string[] {
  const text = `${title} ${prompt}`.toLowerCase()
  const suggestedIds: string[] = []

  // Create a set of available skill IDs for quick lookup
  const availableSkillIds = new Set(availableSkills.map((s) => s.id))

  // Check each skill's keywords
  for (const [skillId, keywords] of Object.entries(SKILL_KEYWORDS)) {
    // Skip if this skill isn't available
    if (!availableSkillIds.has(skillId)) continue

    // Check if any keyword matches
    const hasMatch = keywords.some((keyword) => {
      // Use word boundary matching for short keywords to avoid false positives
      if (keyword.length <= 3) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i')
        return regex.test(text)
      }
      return text.includes(keyword)
    })

    if (hasMatch) {
      suggestedIds.push(skillId)
    }
  }

  // Also check custom skills by matching their name/description against the text
  for (const skill of availableSkills) {
    if (skill.isBuiltIn) continue // Already handled above
    if (suggestedIds.includes(skill.id)) continue

    const skillTerms = `${skill.name} ${skill.description}`.toLowerCase()
    const skillWords = skillTerms.split(/\s+/).filter((w) => w.length > 3)

    // If any significant word from the skill appears in the task text, suggest it
    const hasMatch = skillWords.some((word) => text.includes(word))
    if (hasMatch) {
      suggestedIds.push(skill.id)
    }
  }

  return suggestedIds
}
