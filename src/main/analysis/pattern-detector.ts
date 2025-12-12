/**
 * Pattern Detection for Project Analysis
 *
 * Detects coding patterns and practices in a project by analyzing:
 * - Directory structure
 * - Code conventions
 * - Project organization
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import type { DetectedPattern } from '@shared/types'
import { generatePatternId } from '@shared/types'

/**
 * Pattern definition for detection
 */
interface PatternDefinition {
  id: string
  name: string
  description: string
  detect: (projectPath: string) => Promise<{ detected: boolean; confidence: number; examples: string[] }>
}

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Check if a directory exists
 */
async function directoryExists(path: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path)
    return stat.isDirectory()
  } catch {
    return false
  }
}

/**
 * List directories in a path
 */
async function listDirectories(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}

/**
 * Find files matching a pattern (simple glob)
 */
async function findFiles(
  dirPath: string,
  pattern: RegExp,
  maxDepth: number = 3,
  currentDepth: number = 0
): Promise<string[]> {
  if (currentDepth >= maxDepth) return []

  const results: string[] = []

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      // Skip common non-source directories
      if (
        entry.isDirectory() &&
        ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', 'venv', '.venv', 'target'].includes(
          entry.name
        )
      ) {
        continue
      }

      const fullPath = join(dirPath, entry.name)

      if (entry.isFile() && pattern.test(entry.name)) {
        results.push(fullPath)
      } else if (entry.isDirectory()) {
        const subFiles = await findFiles(fullPath, pattern, maxDepth, currentDepth + 1)
        results.push(...subFiles)
      }
    }
  } catch {
    // Ignore errors
  }

  return results
}

/**
 * Read file content safely
 */
async function readFileContent(path: string, maxBytes: number = 10000): Promise<string | null> {
  try {
    const buffer = Buffer.alloc(maxBytes)
    const handle = await fs.open(path, 'r')
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0)
    await handle.close()
    return buffer.toString('utf-8', 0, bytesRead)
  } catch {
    return null
  }
}

/**
 * Pattern definitions
 */
const PATTERN_DEFINITIONS: PatternDefinition[] = [
  // Monorepo Pattern
  {
    id: 'monorepo',
    name: 'Monorepo Structure',
    description: 'Project uses a monorepo structure with multiple packages',
    detect: async (projectPath) => {
      const examples: string[] = []
      let detected = false
      let confidence = 0

      // Check for packages/ or apps/ directory
      const packagesDir = join(projectPath, 'packages')
      const appsDir = join(projectPath, 'apps')

      if (await directoryExists(packagesDir)) {
        detected = true
        confidence += 0.4
        examples.push('packages/')
      }

      if (await directoryExists(appsDir)) {
        detected = true
        confidence += 0.4
        examples.push('apps/')
      }

      // Check for workspaces in package.json
      const packageJsonPath = join(projectPath, 'package.json')
      const content = await readFileContent(packageJsonPath)
      if (content && content.includes('"workspaces"')) {
        detected = true
        confidence += 0.3
        examples.push('package.json workspaces')
      }

      // Check for pnpm-workspace.yaml
      if (await fileExists(join(projectPath, 'pnpm-workspace.yaml'))) {
        detected = true
        confidence += 0.3
        examples.push('pnpm-workspace.yaml')
      }

      // Check for turbo.json or nx.json
      if (await fileExists(join(projectPath, 'turbo.json'))) {
        detected = true
        confidence += 0.2
        examples.push('turbo.json')
      }

      if (await fileExists(join(projectPath, 'nx.json'))) {
        detected = true
        confidence += 0.2
        examples.push('nx.json')
      }

      return { detected, confidence: Math.min(confidence, 1.0), examples }
    }
  },

  // Feature-Based Organization
  {
    id: 'feature-based',
    name: 'Feature-Based Organization',
    description: 'Code is organized by features/domains rather than technical layers',
    detect: async (projectPath) => {
      const examples: string[] = []
      let detected = false
      let confidence = 0

      // Common feature directories
      const srcDir = join(projectPath, 'src')
      const featureIndicators = ['features', 'modules', 'domains', 'pages']

      for (const indicator of featureIndicators) {
        const dir = join(srcDir, indicator)
        if (await directoryExists(dir)) {
          detected = true
          confidence += 0.3
          examples.push(`src/${indicator}/`)

          // Check if subdirectories have common structure
          const subdirs = await listDirectories(dir)
          const hasColocated = subdirs.some(
            async (subdir) =>
              (await fileExists(join(dir, subdir, 'index.ts'))) ||
              (await fileExists(join(dir, subdir, 'index.tsx')))
          )
          if (hasColocated) {
            confidence += 0.2
          }
        }
      }

      return { detected, confidence: Math.min(confidence, 1.0), examples }
    }
  },

  // Component-Driven Development
  {
    id: 'component-driven',
    name: 'Component-Driven Development',
    description: 'UI is built with reusable, self-contained components',
    detect: async (projectPath) => {
      const examples: string[] = []
      let detected = false
      let confidence = 0

      // Check for components directory
      const componentDirs = ['src/components', 'components', 'src/ui']
      for (const dir of componentDirs) {
        const fullPath = join(projectPath, dir)
        if (await directoryExists(fullPath)) {
          detected = true
          confidence += 0.4
          examples.push(dir)

          // Check for nested component structure
          const subdirs = await listDirectories(fullPath)
          if (subdirs.length > 3) {
            confidence += 0.2
          }
        }
      }

      // Check for Storybook
      if (await fileExists(join(projectPath, '.storybook/main.js'))) {
        detected = true
        confidence += 0.3
        examples.push('.storybook/')
      }

      // Check for component files
      const componentFiles = await findFiles(projectPath, /\.(tsx|jsx|vue|svelte)$/, 2)
      if (componentFiles.length > 5) {
        detected = true
        confidence += 0.2
      }

      return { detected, confidence: Math.min(confidence, 1.0), examples }
    }
  },

  // Test-Driven Development
  {
    id: 'tdd',
    name: 'Test-Driven Development',
    description: 'Project has comprehensive test coverage alongside source code',
    detect: async (projectPath) => {
      const examples: string[] = []
      let detected = false
      let confidence = 0

      // Check for test directories
      const testDirs = ['__tests__', 'tests', 'test', 'spec']
      for (const dir of testDirs) {
        if (await directoryExists(join(projectPath, dir))) {
          detected = true
          confidence += 0.2
          examples.push(dir + '/')
        }
        if (await directoryExists(join(projectPath, 'src', dir))) {
          detected = true
          confidence += 0.2
          examples.push('src/' + dir + '/')
        }
      }

      // Check for colocated tests
      const testFiles = await findFiles(projectPath, /\.(test|spec)\.(ts|tsx|js|jsx)$/, 3)
      if (testFiles.length > 0) {
        detected = true
        confidence += 0.3
        if (testFiles.length > 10) {
          confidence += 0.2
        }
        examples.push(`${testFiles.length} test files found`)
      }

      // Check for test configuration
      const testConfigs = ['jest.config.js', 'vitest.config.ts', 'playwright.config.ts', 'cypress.config.ts']
      for (const config of testConfigs) {
        if (await fileExists(join(projectPath, config))) {
          confidence += 0.1
        }
      }

      return { detected, confidence: Math.min(confidence, 1.0), examples }
    }
  },

  // API Layer Separation
  {
    id: 'api-layer',
    name: 'API Layer Separation',
    description: 'Clear separation between API/service layer and UI',
    detect: async (projectPath) => {
      const examples: string[] = []
      let detected = false
      let confidence = 0

      // Check for API directories
      const apiDirs = ['src/api', 'src/services', 'src/lib/api', 'api', 'src/queries']
      for (const dir of apiDirs) {
        if (await directoryExists(join(projectPath, dir))) {
          detected = true
          confidence += 0.3
          examples.push(dir)
        }
      }

      // Check for pages/api (Next.js) or app/api (Next.js App Router)
      if (await directoryExists(join(projectPath, 'pages/api'))) {
        detected = true
        confidence += 0.3
        examples.push('pages/api/')
      }
      if (await directoryExists(join(projectPath, 'app/api'))) {
        detected = true
        confidence += 0.3
        examples.push('app/api/')
      }

      // Check for route handlers
      const routeFiles = await findFiles(projectPath, /route\.(ts|js)$/, 3)
      if (routeFiles.length > 0) {
        detected = true
        confidence += 0.2
        examples.push(`${routeFiles.length} route handlers`)
      }

      return { detected, confidence: Math.min(confidence, 1.0), examples }
    }
  },

  // Type-First Development
  {
    id: 'type-first',
    name: 'Type-First Development',
    description: 'Strong emphasis on type definitions and type safety',
    detect: async (projectPath) => {
      const examples: string[] = []
      let detected = false
      let confidence = 0

      // Check for types directory
      const typeDirs = ['src/types', 'types', 'src/@types']
      for (const dir of typeDirs) {
        if (await directoryExists(join(projectPath, dir))) {
          detected = true
          confidence += 0.3
          examples.push(dir)
        }
      }

      // Check for .d.ts files
      const dtsFiles = await findFiles(projectPath, /\.d\.ts$/, 3)
      if (dtsFiles.length > 0) {
        detected = true
        confidence += 0.2
        examples.push(`${dtsFiles.length} type definition files`)
      }

      // Check tsconfig strict mode
      const tsconfigPath = join(projectPath, 'tsconfig.json')
      const content = await readFileContent(tsconfigPath)
      if (content) {
        if (content.includes('"strict": true') || content.includes('"strict":true')) {
          detected = true
          confidence += 0.3
          examples.push('tsconfig.json: strict mode enabled')
        }
      }

      // Check for Zod or similar validation
      const packageJsonPath = join(projectPath, 'package.json')
      const pkgContent = await readFileContent(packageJsonPath)
      if (pkgContent) {
        if (pkgContent.includes('"zod"') || pkgContent.includes('"yup"') || pkgContent.includes('"io-ts"')) {
          detected = true
          confidence += 0.2
          examples.push('Schema validation library detected')
        }
      }

      return { detected, confidence: Math.min(confidence, 1.0), examples }
    }
  },

  // Configuration Management
  {
    id: 'config-management',
    name: 'Environment Configuration',
    description: 'Uses environment variables and configuration files for settings',
    detect: async (projectPath) => {
      const examples: string[] = []
      let detected = false
      let confidence = 0

      // Check for .env files
      const envFiles = ['.env', '.env.local', '.env.example', '.env.development', '.env.production']
      for (const file of envFiles) {
        if (await fileExists(join(projectPath, file))) {
          detected = true
          confidence += 0.15
          examples.push(file)
        }
      }

      // Check for config directory
      if (await directoryExists(join(projectPath, 'config'))) {
        detected = true
        confidence += 0.2
        examples.push('config/')
      }

      // Check for dotenv in package.json
      const packageJsonPath = join(projectPath, 'package.json')
      const content = await readFileContent(packageJsonPath)
      if (content && content.includes('dotenv')) {
        detected = true
        confidence += 0.2
        examples.push('dotenv dependency')
      }

      return { detected, confidence: Math.min(confidence, 1.0), examples }
    }
  },

  // Documentation-First
  {
    id: 'documentation-first',
    name: 'Documentation Focus',
    description: 'Project has comprehensive documentation',
    detect: async (projectPath) => {
      const examples: string[] = []
      let detected = false
      let confidence = 0

      // Check for documentation files
      const docFiles = ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'CLAUDE.md', 'ARCHITECTURE.md']
      for (const file of docFiles) {
        if (await fileExists(join(projectPath, file))) {
          detected = true
          confidence += 0.15
          examples.push(file)
        }
      }

      // Check for docs directory
      const docDirs = ['docs', '.claude/docs', 'documentation']
      for (const dir of docDirs) {
        if (await directoryExists(join(projectPath, dir))) {
          detected = true
          confidence += 0.2
          examples.push(dir + '/')
        }
      }

      // Check for JSDoc in source files
      const tsFiles = await findFiles(projectPath, /\.(ts|tsx)$/, 2)
      if (tsFiles.length > 0) {
        // Check first few files for JSDoc comments
        let jsdocCount = 0
        for (const file of tsFiles.slice(0, 5)) {
          const content = await readFileContent(file)
          if (content && (content.includes('/**') || content.includes('@param') || content.includes('@returns'))) {
            jsdocCount++
          }
        }
        if (jsdocCount > 2) {
          detected = true
          confidence += 0.2
          examples.push('JSDoc comments in source files')
        }
      }

      return { detected, confidence: Math.min(confidence, 1.0), examples }
    }
  },

  // CI/CD Integration
  {
    id: 'cicd',
    name: 'CI/CD Integration',
    description: 'Project has automated CI/CD pipelines',
    detect: async (projectPath) => {
      const examples: string[] = []
      let detected = false
      let confidence = 0

      // GitHub Actions
      if (await directoryExists(join(projectPath, '.github/workflows'))) {
        detected = true
        confidence += 0.4
        examples.push('.github/workflows/')
      }

      // GitLab CI
      if (await fileExists(join(projectPath, '.gitlab-ci.yml'))) {
        detected = true
        confidence += 0.4
        examples.push('.gitlab-ci.yml')
      }

      // CircleCI
      if (await fileExists(join(projectPath, '.circleci/config.yml'))) {
        detected = true
        confidence += 0.4
        examples.push('.circleci/config.yml')
      }

      // Jenkins
      if (await fileExists(join(projectPath, 'Jenkinsfile'))) {
        detected = true
        confidence += 0.4
        examples.push('Jenkinsfile')
      }

      // Azure Pipelines
      if (await fileExists(join(projectPath, 'azure-pipelines.yml'))) {
        detected = true
        confidence += 0.4
        examples.push('azure-pipelines.yml')
      }

      return { detected, confidence: Math.min(confidence, 1.0), examples }
    }
  },

  // Containerization
  {
    id: 'containerization',
    name: 'Containerization',
    description: 'Project uses container-based deployment',
    detect: async (projectPath) => {
      const examples: string[] = []
      let detected = false
      let confidence = 0

      // Dockerfile
      if (await fileExists(join(projectPath, 'Dockerfile'))) {
        detected = true
        confidence += 0.4
        examples.push('Dockerfile')
      }

      // Docker Compose
      const composeFiles = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']
      for (const file of composeFiles) {
        if (await fileExists(join(projectPath, file))) {
          detected = true
          confidence += 0.3
          examples.push(file)
        }
      }

      // .dockerignore
      if (await fileExists(join(projectPath, '.dockerignore'))) {
        confidence += 0.1
      }

      // Kubernetes manifests
      if (await directoryExists(join(projectPath, 'k8s'))) {
        detected = true
        confidence += 0.3
        examples.push('k8s/')
      }

      return { detected, confidence: Math.min(confidence, 1.0), examples }
    }
  }
]

/**
 * Main pattern detection function
 *
 * Analyzes a project directory and returns detected patterns
 */
export async function detectPatterns(projectPath: string): Promise<DetectedPattern[]> {
  const results: DetectedPattern[] = []

  // Run all pattern detectors in parallel
  const detectionPromises = PATTERN_DEFINITIONS.map(async (definition) => {
    const result = await definition.detect(projectPath)

    if (result.detected && result.confidence > 0.3) {
      return {
        id: generatePatternId(),
        name: definition.name,
        description: definition.description,
        confidence: result.confidence,
        examples: result.examples
      }
    }
    return null
  })

  const detections = await Promise.all(detectionPromises)

  for (const detection of detections) {
    if (detection) {
      results.push(detection)
    }
  }

  // Sort by confidence
  results.sort((a, b) => b.confidence - a.confidence)

  return results
}

/**
 * Detect patterns with confidence threshold
 */
export async function detectPatternsWithThreshold(
  projectPath: string,
  minConfidence: number = 0.5
): Promise<DetectedPattern[]> {
  const patterns = await detectPatterns(projectPath)
  return patterns.filter((p) => p.confidence >= minConfidence)
}
