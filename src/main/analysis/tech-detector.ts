/**
 * Technology Detection for Project Analysis
 *
 * Detects technologies used in a project by analyzing:
 * - Package files (package.json, requirements.txt, etc.)
 * - Configuration files (tsconfig.json, .eslintrc, etc.)
 * - File patterns (file extensions, directory structure)
 */

import { promises as fs } from 'fs'
import { join, basename } from 'path'
import type { DetectedTechnology, TechCategory } from '@shared/types'

/**
 * Detection result from a single strategy
 */
interface DetectionResult {
  technology: string
  category: TechCategory
  version?: string
  confidence: number
  signal: string
}

/**
 * Package.json structure (partial)
 */
interface PackageJson {
  name?: string
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  scripts?: Record<string, string>
  engines?: {
    node?: string
    npm?: string
  }
}

/**
 * Technology detection mappings for package.json dependencies
 */
const PACKAGE_MAPPINGS: Array<{
  packages: string[]
  technology: string
  category: TechCategory
  confidence: number
}> = [
  // Frameworks
  { packages: ['react', 'react-dom'], technology: 'React', category: 'framework', confidence: 1.0 },
  { packages: ['next'], technology: 'Next.js', category: 'framework', confidence: 1.0 },
  { packages: ['vue'], technology: 'Vue', category: 'framework', confidence: 1.0 },
  { packages: ['nuxt'], technology: 'Nuxt', category: 'framework', confidence: 1.0 },
  { packages: ['svelte'], technology: 'Svelte', category: 'framework', confidence: 1.0 },
  { packages: ['@sveltejs/kit'], technology: 'SvelteKit', category: 'framework', confidence: 1.0 },
  { packages: ['@angular/core'], technology: 'Angular', category: 'framework', confidence: 1.0 },
  { packages: ['express'], technology: 'Express', category: 'framework', confidence: 1.0 },
  { packages: ['fastify'], technology: 'Fastify', category: 'framework', confidence: 1.0 },
  { packages: ['@nestjs/core'], technology: 'NestJS', category: 'framework', confidence: 1.0 },
  { packages: ['hono'], technology: 'Hono', category: 'framework', confidence: 1.0 },
  { packages: ['koa'], technology: 'Koa', category: 'framework', confidence: 1.0 },
  { packages: ['astro'], technology: 'Astro', category: 'framework', confidence: 1.0 },
  { packages: ['@remix-run/react'], technology: 'Remix', category: 'framework', confidence: 1.0 },

  // Testing
  { packages: ['jest'], technology: 'Jest', category: 'tool', confidence: 1.0 },
  { packages: ['vitest'], technology: 'Vitest', category: 'tool', confidence: 1.0 },
  { packages: ['mocha'], technology: 'Mocha', category: 'tool', confidence: 1.0 },
  { packages: ['playwright', '@playwright/test'], technology: 'Playwright', category: 'tool', confidence: 1.0 },
  { packages: ['cypress'], technology: 'Cypress', category: 'tool', confidence: 1.0 },
  { packages: ['@testing-library/react'], technology: 'React Testing Library', category: 'tool', confidence: 1.0 },

  // State Management
  { packages: ['redux', '@reduxjs/toolkit'], technology: 'Redux', category: 'library', confidence: 1.0 },
  { packages: ['zustand'], technology: 'Zustand', category: 'library', confidence: 1.0 },
  { packages: ['mobx'], technology: 'MobX', category: 'library', confidence: 1.0 },
  { packages: ['recoil'], technology: 'Recoil', category: 'library', confidence: 1.0 },
  { packages: ['jotai'], technology: 'Jotai', category: 'library', confidence: 1.0 },
  { packages: ['pinia'], technology: 'Pinia', category: 'library', confidence: 1.0 },

  // Data Fetching
  { packages: ['@tanstack/react-query', 'react-query'], technology: 'TanStack Query', category: 'library', confidence: 1.0 },
  { packages: ['swr'], technology: 'SWR', category: 'library', confidence: 1.0 },
  { packages: ['@trpc/client', '@trpc/server'], technology: 'tRPC', category: 'library', confidence: 1.0 },
  { packages: ['graphql', '@apollo/client'], technology: 'GraphQL', category: 'library', confidence: 1.0 },

  // ORMs & Databases
  { packages: ['prisma', '@prisma/client'], technology: 'Prisma', category: 'database', confidence: 1.0 },
  { packages: ['drizzle-orm'], technology: 'Drizzle', category: 'database', confidence: 1.0 },
  { packages: ['typeorm'], technology: 'TypeORM', category: 'database', confidence: 1.0 },
  { packages: ['sequelize'], technology: 'Sequelize', category: 'database', confidence: 1.0 },
  { packages: ['mongoose'], technology: 'MongoDB', category: 'database', confidence: 0.9 },
  { packages: ['pg', 'postgres'], technology: 'PostgreSQL', category: 'database', confidence: 0.8 },
  { packages: ['mysql2', 'mysql'], technology: 'MySQL', category: 'database', confidence: 0.8 },
  { packages: ['better-sqlite3', 'sqlite3'], technology: 'SQLite', category: 'database', confidence: 0.9 },
  { packages: ['redis', 'ioredis'], technology: 'Redis', category: 'database', confidence: 0.9 },

  // Build Tools
  { packages: ['vite'], technology: 'Vite', category: 'tool', confidence: 1.0 },
  { packages: ['webpack'], technology: 'Webpack', category: 'tool', confidence: 1.0 },
  { packages: ['esbuild'], technology: 'esbuild', category: 'tool', confidence: 1.0 },
  { packages: ['rollup'], technology: 'Rollup', category: 'tool', confidence: 1.0 },
  { packages: ['parcel'], technology: 'Parcel', category: 'tool', confidence: 1.0 },
  { packages: ['turbo'], technology: 'Turborepo', category: 'tool', confidence: 1.0 },

  // Linting & Formatting
  { packages: ['eslint'], technology: 'ESLint', category: 'tool', confidence: 1.0 },
  { packages: ['prettier'], technology: 'Prettier', category: 'tool', confidence: 1.0 },
  { packages: ['biome', '@biomejs/biome'], technology: 'Biome', category: 'tool', confidence: 1.0 },

  // UI Libraries
  { packages: ['@radix-ui/react-dialog'], technology: 'Radix UI', category: 'library', confidence: 0.9 },
  { packages: ['@shadcn/ui'], technology: 'shadcn/ui', category: 'library', confidence: 1.0 },
  { packages: ['@mui/material'], technology: 'Material UI', category: 'library', confidence: 1.0 },
  { packages: ['@chakra-ui/react'], technology: 'Chakra UI', category: 'library', confidence: 1.0 },
  { packages: ['antd'], technology: 'Ant Design', category: 'library', confidence: 1.0 },
  { packages: ['tailwindcss'], technology: 'Tailwind CSS', category: 'library', confidence: 1.0 },

  // Validation
  { packages: ['zod'], technology: 'Zod', category: 'library', confidence: 1.0 },
  { packages: ['yup'], technology: 'Yup', category: 'library', confidence: 1.0 },
  { packages: ['joi'], technology: 'Joi', category: 'library', confidence: 1.0 },

  // Authentication
  { packages: ['next-auth'], technology: 'NextAuth.js', category: 'library', confidence: 1.0 },
  { packages: ['passport'], technology: 'Passport.js', category: 'library', confidence: 1.0 },

  // Utilities
  { packages: ['lodash'], technology: 'Lodash', category: 'library', confidence: 1.0 },
  { packages: ['date-fns'], technology: 'date-fns', category: 'library', confidence: 1.0 },
  { packages: ['dayjs'], technology: 'Day.js', category: 'library', confidence: 1.0 },
  { packages: ['axios'], technology: 'Axios', category: 'library', confidence: 1.0 },

  // Documentation
  { packages: ['storybook', '@storybook/react'], technology: 'Storybook', category: 'tool', confidence: 1.0 },
  { packages: ['typedoc'], technology: 'TypeDoc', category: 'tool', confidence: 1.0 }
]

/**
 * Config file detection mappings
 */
const CONFIG_MAPPINGS: Array<{
  files: string[]
  technology: string
  category: TechCategory
  confidence: number
}> = [
  // Languages
  { files: ['tsconfig.json'], technology: 'TypeScript', category: 'language', confidence: 1.0 },

  // Testing
  { files: ['jest.config.js', 'jest.config.ts', 'jest.config.mjs'], technology: 'Jest', category: 'tool', confidence: 1.0 },
  { files: ['vitest.config.js', 'vitest.config.ts', 'vitest.config.mts'], technology: 'Vitest', category: 'tool', confidence: 1.0 },
  { files: ['playwright.config.js', 'playwright.config.ts'], technology: 'Playwright', category: 'tool', confidence: 1.0 },
  { files: ['cypress.config.js', 'cypress.config.ts'], technology: 'Cypress', category: 'tool', confidence: 1.0 },

  // Linting
  { files: ['.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.cjs', 'eslint.config.js', 'eslint.config.mjs'], technology: 'ESLint', category: 'tool', confidence: 1.0 },
  { files: ['.prettierrc', '.prettierrc.js', '.prettierrc.json', 'prettier.config.js'], technology: 'Prettier', category: 'tool', confidence: 1.0 },
  { files: ['biome.json'], technology: 'Biome', category: 'tool', confidence: 1.0 },

  // Build Tools
  { files: ['vite.config.js', 'vite.config.ts', 'vite.config.mts'], technology: 'Vite', category: 'tool', confidence: 1.0 },
  { files: ['webpack.config.js', 'webpack.config.ts'], technology: 'Webpack', category: 'tool', confidence: 1.0 },
  { files: ['rollup.config.js', 'rollup.config.ts'], technology: 'Rollup', category: 'tool', confidence: 1.0 },
  { files: ['turbo.json'], technology: 'Turborepo', category: 'tool', confidence: 1.0 },
  { files: ['nx.json'], technology: 'Nx', category: 'tool', confidence: 1.0 },

  // Frameworks
  { files: ['next.config.js', 'next.config.mjs', 'next.config.ts'], technology: 'Next.js', category: 'framework', confidence: 1.0 },
  { files: ['nuxt.config.js', 'nuxt.config.ts'], technology: 'Nuxt', category: 'framework', confidence: 1.0 },
  { files: ['svelte.config.js'], technology: 'Svelte', category: 'framework', confidence: 1.0 },
  { files: ['astro.config.js', 'astro.config.mjs'], technology: 'Astro', category: 'framework', confidence: 1.0 },
  { files: ['remix.config.js'], technology: 'Remix', category: 'framework', confidence: 1.0 },
  { files: ['angular.json'], technology: 'Angular', category: 'framework', confidence: 1.0 },
  { files: ['nest-cli.json'], technology: 'NestJS', category: 'framework', confidence: 1.0 },

  // Database
  { files: ['prisma/schema.prisma'], technology: 'Prisma', category: 'database', confidence: 1.0 },
  { files: ['drizzle.config.ts'], technology: 'Drizzle', category: 'database', confidence: 1.0 },

  // Styling
  { files: ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs'], technology: 'Tailwind CSS', category: 'library', confidence: 1.0 },
  { files: ['postcss.config.js', 'postcss.config.cjs'], technology: 'PostCSS', category: 'tool', confidence: 0.8 },

  // Infrastructure
  { files: ['Dockerfile'], technology: 'Docker', category: 'infrastructure', confidence: 1.0 },
  { files: ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'], technology: 'Docker Compose', category: 'infrastructure', confidence: 1.0 },
  { files: ['terraform.tf', 'main.tf'], technology: 'Terraform', category: 'infrastructure', confidence: 1.0 },
  { files: ['pulumi.yaml'], technology: 'Pulumi', category: 'infrastructure', confidence: 1.0 },
  { files: ['serverless.yml', 'serverless.yaml'], technology: 'Serverless Framework', category: 'infrastructure', confidence: 1.0 },

  // CI/CD
  { files: ['.github/workflows'], technology: 'GitHub Actions', category: 'ci-cd', confidence: 1.0 },
  { files: ['.circleci/config.yml'], technology: 'CircleCI', category: 'ci-cd', confidence: 1.0 },
  { files: ['.gitlab-ci.yml'], technology: 'GitLab CI', category: 'ci-cd', confidence: 1.0 },
  { files: ['Jenkinsfile'], technology: 'Jenkins', category: 'ci-cd', confidence: 1.0 },

  // Python
  { files: ['pyproject.toml'], technology: 'Python', category: 'language', confidence: 0.9 },
  { files: ['requirements.txt'], technology: 'Python', category: 'language', confidence: 0.9 },
  { files: ['Pipfile'], technology: 'Python', category: 'language', confidence: 0.9 },
  { files: ['setup.py'], technology: 'Python', category: 'language', confidence: 0.8 },

  // Go
  { files: ['go.mod'], technology: 'Go', category: 'language', confidence: 1.0 },

  // Rust
  { files: ['Cargo.toml'], technology: 'Rust', category: 'language', confidence: 1.0 },

  // Ruby
  { files: ['Gemfile'], technology: 'Ruby', category: 'language', confidence: 1.0 },
  { files: ['config/application.rb'], technology: 'Rails', category: 'framework', confidence: 1.0 },

  // Java
  { files: ['pom.xml'], technology: 'Maven', category: 'tool', confidence: 1.0 },
  { files: ['build.gradle', 'build.gradle.kts'], technology: 'Gradle', category: 'tool', confidence: 1.0 },

  // PHP
  { files: ['composer.json'], technology: 'PHP', category: 'language', confidence: 0.9 },

  // .NET
  { files: ['*.csproj'], technology: 'C#', category: 'language', confidence: 1.0 },
  { files: ['*.fsproj'], technology: 'F#', category: 'language', confidence: 1.0 }
]

/**
 * File extension detection mappings
 */
const EXTENSION_MAPPINGS: Array<{
  extensions: string[]
  technology: string
  category: TechCategory
  minFiles: number
  confidence: number
}> = [
  { extensions: ['.ts', '.tsx'], technology: 'TypeScript', category: 'language', minFiles: 1, confidence: 0.9 },
  { extensions: ['.js', '.jsx', '.mjs', '.cjs'], technology: 'JavaScript', category: 'language', minFiles: 3, confidence: 0.8 },
  { extensions: ['.py'], technology: 'Python', category: 'language', minFiles: 1, confidence: 0.9 },
  { extensions: ['.go'], technology: 'Go', category: 'language', minFiles: 1, confidence: 0.9 },
  { extensions: ['.rs'], technology: 'Rust', category: 'language', minFiles: 1, confidence: 0.9 },
  { extensions: ['.rb'], technology: 'Ruby', category: 'language', minFiles: 1, confidence: 0.9 },
  { extensions: ['.java'], technology: 'Java', category: 'language', minFiles: 1, confidence: 0.9 },
  { extensions: ['.kt', '.kts'], technology: 'Kotlin', category: 'language', minFiles: 1, confidence: 0.9 },
  { extensions: ['.cs'], technology: 'C#', category: 'language', minFiles: 1, confidence: 0.9 },
  { extensions: ['.php'], technology: 'PHP', category: 'language', minFiles: 1, confidence: 0.9 },
  { extensions: ['.swift'], technology: 'Swift', category: 'language', minFiles: 1, confidence: 0.9 },
  { extensions: ['.vue'], technology: 'Vue', category: 'framework', minFiles: 1, confidence: 0.9 },
  { extensions: ['.svelte'], technology: 'Svelte', category: 'framework', minFiles: 1, confidence: 0.9 }
]

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
 * Read and parse JSON file
 */
async function readJson<T>(path: string): Promise<T | null> {
  try {
    const content = await fs.readFile(path, 'utf-8')
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

/**
 * List files in a directory (non-recursive)
 */
async function listFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries.filter((e) => e.isFile()).map((e) => e.name)
  } catch {
    return []
  }
}

/**
 * List all files recursively (with depth limit)
 */
async function listFilesRecursive(
  dirPath: string,
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

      if (entry.isFile()) {
        results.push(fullPath)
      } else if (entry.isDirectory()) {
        const subFiles = await listFilesRecursive(fullPath, maxDepth, currentDepth + 1)
        results.push(...subFiles)
      }
    }
  } catch {
    // Ignore errors (permission denied, etc.)
  }

  return results
}

/**
 * Analyze package.json for technology detection
 */
async function analyzePackageJson(projectPath: string): Promise<DetectionResult[]> {
  const results: DetectionResult[] = []
  const packageJsonPath = join(projectPath, 'package.json')

  const packageJson = await readJson<PackageJson>(packageJsonPath)
  if (!packageJson) return results

  // Add Node.js platform detection
  results.push({
    technology: 'Node.js',
    category: 'platform',
    confidence: 1.0,
    signal: 'package.json exists'
  })

  // Check dependencies
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  }

  for (const mapping of PACKAGE_MAPPINGS) {
    for (const pkg of mapping.packages) {
      if (allDeps[pkg]) {
        results.push({
          technology: mapping.technology,
          category: mapping.category,
          version: allDeps[pkg].replace(/[\^~]/, ''),
          confidence: mapping.confidence,
          signal: `package.json dependency: ${pkg}`
        })
        break // Only add once per mapping
      }
    }
  }

  return results
}

/**
 * Analyze Python project files
 */
async function analyzePythonProject(projectPath: string): Promise<DetectionResult[]> {
  const results: DetectionResult[] = []

  // Check requirements.txt
  const requirementsPath = join(projectPath, 'requirements.txt')
  if (await fileExists(requirementsPath)) {
    try {
      const content = await fs.readFile(requirementsPath, 'utf-8')
      const lines = content.split('\n')

      // Python frameworks
      const pythonMappings = [
        { packages: ['django', 'Django'], technology: 'Django', category: 'framework' as TechCategory },
        { packages: ['fastapi', 'FastAPI'], technology: 'FastAPI', category: 'framework' as TechCategory },
        { packages: ['flask', 'Flask'], technology: 'Flask', category: 'framework' as TechCategory },
        { packages: ['pytest'], technology: 'pytest', category: 'tool' as TechCategory },
        { packages: ['pydantic'], technology: 'Pydantic', category: 'library' as TechCategory },
        { packages: ['sqlalchemy', 'SQLAlchemy'], technology: 'SQLAlchemy', category: 'database' as TechCategory },
        { packages: ['celery', 'Celery'], technology: 'Celery', category: 'library' as TechCategory }
      ]

      for (const line of lines) {
        const pkgMatch = line.match(/^([a-zA-Z0-9_-]+)/)
        if (pkgMatch) {
          const pkg = pkgMatch[1].toLowerCase()
          for (const mapping of pythonMappings) {
            if (mapping.packages.some((p) => p.toLowerCase() === pkg)) {
              results.push({
                technology: mapping.technology,
                category: mapping.category,
                confidence: 1.0,
                signal: `requirements.txt: ${pkg}`
              })
            }
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  // Check pyproject.toml
  const pyprojectPath = join(projectPath, 'pyproject.toml')
  if (await fileExists(pyprojectPath)) {
    try {
      const content = await fs.readFile(pyprojectPath, 'utf-8')

      // Check for Poetry
      if (content.includes('[tool.poetry]')) {
        results.push({
          technology: 'Poetry',
          category: 'tool',
          confidence: 1.0,
          signal: 'pyproject.toml: [tool.poetry]'
        })
      }

      // Check for common dependencies
      if (content.includes('fastapi') || content.includes('FastAPI')) {
        results.push({
          technology: 'FastAPI',
          category: 'framework',
          confidence: 0.9,
          signal: 'pyproject.toml mentions FastAPI'
        })
      }
      if (content.includes('django') || content.includes('Django')) {
        results.push({
          technology: 'Django',
          category: 'framework',
          confidence: 0.9,
          signal: 'pyproject.toml mentions Django'
        })
      }
    } catch {
      // Ignore read errors
    }
  }

  return results
}

/**
 * Analyze configuration files
 */
async function analyzeConfigFiles(projectPath: string): Promise<DetectionResult[]> {
  const results: DetectionResult[] = []
  const rootFiles = await listFiles(projectPath)

  for (const mapping of CONFIG_MAPPINGS) {
    for (const file of mapping.files) {
      // Handle directory paths (like .github/workflows)
      if (file.includes('/')) {
        const fullPath = join(projectPath, file)
        if (await fileExists(fullPath)) {
          results.push({
            technology: mapping.technology,
            category: mapping.category,
            confidence: mapping.confidence,
            signal: `Config file: ${file}`
          })
          break
        }
      } else if (file.includes('*')) {
        // Handle glob patterns (like *.csproj)
        const pattern = file.replace('*', '')
        if (rootFiles.some((f) => f.endsWith(pattern))) {
          results.push({
            technology: mapping.technology,
            category: mapping.category,
            confidence: mapping.confidence,
            signal: `Config file pattern: ${file}`
          })
          break
        }
      } else if (rootFiles.includes(file)) {
        results.push({
          technology: mapping.technology,
          category: mapping.category,
          confidence: mapping.confidence,
          signal: `Config file: ${file}`
        })
        break
      }
    }
  }

  return results
}

/**
 * Analyze file extensions
 */
async function analyzeFileExtensions(projectPath: string): Promise<DetectionResult[]> {
  const results: DetectionResult[] = []
  const files = await listFilesRecursive(projectPath)

  // Count files by extension
  const extensionCounts: Record<string, number> = {}
  for (const file of files) {
    const ext = '.' + basename(file).split('.').pop()
    extensionCounts[ext] = (extensionCounts[ext] || 0) + 1
  }

  for (const mapping of EXTENSION_MAPPINGS) {
    let totalCount = 0
    for (const ext of mapping.extensions) {
      totalCount += extensionCounts[ext] || 0
    }

    if (totalCount >= mapping.minFiles) {
      results.push({
        technology: mapping.technology,
        category: mapping.category,
        confidence: Math.min(mapping.confidence, 0.5 + totalCount * 0.05),
        signal: `File extensions: ${mapping.extensions.join(', ')} (${totalCount} files)`
      })
    }
  }

  return results
}

/**
 * Consolidate detection results into unique technologies
 */
function consolidateResults(results: DetectionResult[]): DetectedTechnology[] {
  const techMap = new Map<string, DetectedTechnology>()

  for (const result of results) {
    const existing = techMap.get(result.technology)

    if (existing) {
      // Update with higher confidence if found again
      if (result.confidence > existing.confidence) {
        existing.confidence = result.confidence
      }
      if (result.version && !existing.version) {
        existing.version = result.version
      }
      existing.signals.push(result.signal)
    } else {
      techMap.set(result.technology, {
        category: result.category,
        name: result.technology,
        version: result.version,
        confidence: result.confidence,
        signals: [result.signal]
      })
    }
  }

  return Array.from(techMap.values())
}

/**
 * Main technology detection function
 *
 * Analyzes a project directory and returns detected technologies
 */
export async function detectTechnologies(projectPath: string): Promise<DetectedTechnology[]> {
  const allResults: DetectionResult[] = []

  // Run all detection strategies
  const [packageResults, pythonResults, configResults, extensionResults] = await Promise.all([
    analyzePackageJson(projectPath),
    analyzePythonProject(projectPath),
    analyzeConfigFiles(projectPath),
    analyzeFileExtensions(projectPath)
  ])

  allResults.push(...packageResults, ...pythonResults, ...configResults, ...extensionResults)

  // Consolidate and return unique technologies
  return consolidateResults(allResults)
}

/**
 * Detect technologies with confidence threshold
 */
export async function detectTechnologiesWithThreshold(
  projectPath: string,
  minConfidence: number = 0.5
): Promise<DetectedTechnology[]> {
  const technologies = await detectTechnologies(projectPath)
  return technologies.filter((t) => t.confidence >= minConfidence)
}
