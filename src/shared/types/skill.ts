/**
 * Skill types for Nightshift
 * Skills provide specialized prompts that can be enabled for tasks
 */

/**
 * A skill that provides specialized context/instructions for agent tasks
 */
export interface Skill {
  /** Unique identifier for the skill (e.g., skill_abc123) */
  id: string

  /** Human-readable name */
  name: string

  /** Short description of what this skill provides */
  description: string

  /** The specialized prompt/instructions this skill injects */
  prompt: string

  /** Icon identifier (emoji or icon name) */
  icon: string

  /** Category for organization */
  category: SkillCategory

  /** Whether this skill is currently enabled globally */
  enabled: boolean

  /** When the skill was created */
  createdAt: string

  /** When the skill was last modified */
  updatedAt: string

  /** Whether this is a built-in skill (cannot be deleted) */
  isBuiltIn: boolean
}

/**
 * Skill categories for organization
 */
export type SkillCategory =
  | 'coding'
  | 'testing'
  | 'documentation'
  | 'debugging'
  | 'architecture'
  | 'security'
  | 'performance'
  | 'custom'

/**
 * All available skill categories with display info
 */
export const SKILL_CATEGORIES: Record<SkillCategory, { label: string; description: string }> = {
  coding: { label: 'Coding', description: 'Code style and patterns' },
  testing: { label: 'Testing', description: 'Test writing and quality' },
  documentation: { label: 'Documentation', description: 'Documentation standards' },
  debugging: { label: 'Debugging', description: 'Bug finding and fixing' },
  architecture: { label: 'Architecture', description: 'System design and patterns' },
  security: { label: 'Security', description: 'Security best practices' },
  performance: { label: 'Performance', description: 'Performance optimization' },
  custom: { label: 'Custom', description: 'User-defined skills' }
}

/**
 * Skills registry stored in ~/.nightshift/skills.json
 */
export interface SkillsRegistry {
  skills: Skill[]
  version: number
}

/**
 * Generate a unique skill ID
 */
export function generateSkillId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = 'skill_'
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
}

/**
 * Create a new skill with default values
 */
export function createSkill(
  name: string,
  description: string,
  prompt: string,
  options: Partial<Skill> = {}
): Skill {
  const now = new Date().toISOString()
  return {
    id: generateSkillId(),
    name,
    description,
    prompt,
    icon: '🎯',
    category: 'custom',
    enabled: true,
    createdAt: now,
    updatedAt: now,
    isBuiltIn: false,
    ...options
  }
}

/**
 * Built-in skills that come with Nightshift
 */
export const BUILT_IN_SKILLS: Skill[] = [
  {
    id: 'skill_typescript',
    name: 'TypeScript Expert',
    description: 'Enforces TypeScript best practices and strict typing',
    prompt: `When writing TypeScript code:
- Use strict type annotations, avoid 'any' type unless absolutely necessary
- Prefer interfaces over type aliases for object shapes
- Use discriminated unions for complex state
- Leverage utility types (Partial, Required, Pick, Omit, etc.)
- Use const assertions where appropriate
- Ensure proper null/undefined handling with strict null checks
- Use generics to create reusable, type-safe functions and components`,
    icon: '📘',
    category: 'coding',
    enabled: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isBuiltIn: true
  },
  {
    id: 'skill_testing',
    name: 'Test-Driven Development',
    description: 'Emphasizes writing tests alongside code',
    prompt: `Follow test-driven development practices:
- Write tests before or alongside implementation code
- Aim for high test coverage on critical paths
- Use descriptive test names that explain the expected behavior
- Follow the Arrange-Act-Assert pattern
- Mock external dependencies appropriately
- Include both happy path and edge case tests
- Write integration tests for critical workflows`,
    icon: '🧪',
    category: 'testing',
    enabled: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isBuiltIn: true
  },
  {
    id: 'skill_documentation',
    name: 'Documentation Focus',
    description: 'Ensures code is well-documented',
    prompt: `Prioritize documentation:
- Add JSDoc comments to all public functions and classes
- Document complex algorithms with inline comments
- Update README files when adding new features
- Include usage examples in documentation
- Document any non-obvious design decisions
- Keep documentation in sync with code changes`,
    icon: '📝',
    category: 'documentation',
    enabled: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isBuiltIn: true
  },
  {
    id: 'skill_security',
    name: 'Security Conscious',
    description: 'Follows security best practices',
    prompt: `Apply security best practices:
- Validate and sanitize all user inputs
- Use parameterized queries for database operations
- Implement proper authentication and authorization checks
- Avoid exposing sensitive information in logs or errors
- Use secure defaults for configurations
- Follow the principle of least privilege
- Be aware of common vulnerabilities (OWASP Top 10)`,
    icon: '🔒',
    category: 'security',
    enabled: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isBuiltIn: true
  },
  {
    id: 'skill_performance',
    name: 'Performance Optimization',
    description: 'Focuses on efficient code',
    prompt: `Optimize for performance:
- Consider time and space complexity of algorithms
- Avoid unnecessary re-renders in React components
- Use appropriate data structures for the use case
- Implement caching where beneficial
- Lazy load components and resources when possible
- Profile before optimizing - focus on actual bottlenecks
- Consider memory usage and avoid memory leaks`,
    icon: '⚡',
    category: 'performance',
    enabled: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isBuiltIn: true
  },
  {
    id: 'skill_react',
    name: 'React Best Practices',
    description: 'Modern React patterns and conventions',
    prompt: `Follow modern React best practices:
- Use functional components with hooks
- Keep components small and focused on a single responsibility
- Use custom hooks to extract reusable logic
- Implement proper error boundaries
- Use React.memo, useMemo, and useCallback appropriately
- Follow the container/presentational component pattern when helpful
- Handle loading and error states explicitly`,
    icon: '⚛️',
    category: 'coding',
    enabled: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isBuiltIn: true
  },
  {
    id: 'skill_debugging',
    name: 'Systematic Debugging',
    description: 'Methodical approach to finding and fixing bugs',
    prompt: `Apply systematic debugging practices:
- Reproduce the issue consistently before fixing
- Use console.log strategically or proper debugging tools
- Check recent changes that might have introduced the bug
- Verify assumptions about data and state
- Test the fix thoroughly, including edge cases
- Consider if the bug might exist elsewhere (similar patterns)
- Document the root cause and fix for future reference`,
    icon: '🔍',
    category: 'debugging',
    enabled: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isBuiltIn: true
  },
  {
    id: 'skill_clean_code',
    name: 'Clean Code',
    description: 'Writes readable, maintainable code',
    prompt: `Follow clean code principles:
- Use meaningful, descriptive names for variables and functions
- Keep functions small and focused (single responsibility)
- Avoid deep nesting - extract to helper functions
- Don't repeat yourself (DRY) but don't over-abstract
- Write self-documenting code that's easy to understand
- Handle errors explicitly and gracefully
- Delete dead code, don't comment it out`,
    icon: '✨',
    category: 'coding',
    enabled: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isBuiltIn: true
  }
]

/**
 * Create default skills registry with built-in skills
 */
export function createDefaultSkillsRegistry(): SkillsRegistry {
  return {
    skills: [...BUILT_IN_SKILLS],
    version: 1
  }
}
