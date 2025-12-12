# Plan: Project Analysis for Skills Suggestion

## Overview

Add the ability to analyze a project's codebase to suggest appropriate Claude Code skills based on the technologies, patterns, and practices detected. This is a **manual action** triggered by the user, and the suggested skills would live in the project's `.claude/skills/` directory.

## Goals

1. **Detect technologies** used in a project (languages, frameworks, libraries)
2. **Suggest relevant skills** based on detected technologies
3. **Generate skill files** with appropriate prompts for each skill
4. **Allow user review** before creating skills
5. **Connect to sub-agent setup** (Plan 01) for skill management

## Architecture

### Technology Detection (`src/main/analysis/tech-detector.ts`)

```typescript
/**
 * Detected technology in a project
 */
export interface DetectedTechnology {
  category: TechCategory
  name: string
  version?: string
  confidence: number  // 0-1, based on signals
  signals: string[]   // What indicated this (package.json, file patterns, etc.)
}

export type TechCategory =
  | 'language'      // TypeScript, Python, Go, Rust
  | 'framework'     // React, Next.js, Express, FastAPI
  | 'library'       // lodash, axios, zod
  | 'tool'          // ESLint, Prettier, Jest, Vitest
  | 'platform'      // Node.js, Deno, Bun
  | 'database'      // PostgreSQL, MongoDB, SQLite
  | 'infrastructure' // Docker, Kubernetes, Terraform
  | 'ci-cd'         // GitHub Actions, CircleCI

/**
 * Project analysis result
 */
export interface ProjectAnalysis {
  projectId: string
  projectPath: string
  analyzedAt: string

  technologies: DetectedTechnology[]
  patterns: DetectedPattern[]
  recommendations: SkillRecommendation[]
}

/**
 * Detected coding patterns/practices
 */
export interface DetectedPattern {
  name: string
  description: string
  confidence: number
  examples: string[]  // File paths or code snippets
}

/**
 * Skill recommendation based on analysis
 */
export interface SkillRecommendation {
  id: string
  name: string
  description: string
  reason: string  // Why this skill is recommended
  priority: 'high' | 'medium' | 'low'
  suggestedPrompt: string
  basedOn: string[]  // Which technologies/patterns triggered this
}
```

### Detection Strategies

#### 1. Package Manager Analysis

```typescript
// package.json, requirements.txt, Cargo.toml, go.mod, etc.
async function analyzePackageFiles(projectPath: string): Promise<DetectedTechnology[]> {
  const techs: DetectedTechnology[] = []

  // Node.js ecosystem
  const packageJson = await readPackageJson(projectPath)
  if (packageJson) {
    techs.push({ category: 'platform', name: 'Node.js', confidence: 1.0 })

    // Detect frameworks
    if (packageJson.dependencies?.['react']) {
      techs.push({ category: 'framework', name: 'React', confidence: 1.0 })
    }
    if (packageJson.dependencies?.['next']) {
      techs.push({ category: 'framework', name: 'Next.js', confidence: 1.0 })
    }
    // ... more detection
  }

  // Python
  const requirementsTxt = await readIfExists(join(projectPath, 'requirements.txt'))
  const pyprojectToml = await readIfExists(join(projectPath, 'pyproject.toml'))
  // ... analyze

  return techs
}
```

#### 2. File Pattern Analysis

```typescript
// Detect based on file extensions and structures
async function analyzeFilePatterns(projectPath: string): Promise<DetectedTechnology[]> {
  const techs: DetectedTechnology[] = []

  const files = await glob('**/*', { cwd: projectPath, ignore: ['node_modules/**'] })

  // Language detection
  const tsFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
  if (tsFiles.length > 0) {
    techs.push({ category: 'language', name: 'TypeScript', confidence: 1.0 })
  }

  // Framework detection by structure
  if (files.some(f => f.includes('pages/') || f.includes('app/'))) {
    // Could be Next.js
  }

  return techs
}
```

#### 3. Config File Analysis

```typescript
// Detect from config files
async function analyzeConfigFiles(projectPath: string): Promise<DetectedTechnology[]> {
  const techs: DetectedTechnology[] = []

  // TypeScript config
  if (await exists(join(projectPath, 'tsconfig.json'))) {
    techs.push({ category: 'language', name: 'TypeScript', confidence: 1.0 })
  }

  // ESLint
  const eslintConfigs = ['.eslintrc', '.eslintrc.js', '.eslintrc.json', 'eslint.config.js']
  if (await anyExists(projectPath, eslintConfigs)) {
    techs.push({ category: 'tool', name: 'ESLint', confidence: 1.0 })
  }

  // Testing frameworks
  if (await exists(join(projectPath, 'jest.config.js'))) {
    techs.push({ category: 'tool', name: 'Jest', confidence: 1.0 })
  }
  if (await exists(join(projectPath, 'vitest.config.ts'))) {
    techs.push({ category: 'tool', name: 'Vitest', confidence: 1.0 })
  }

  // Docker
  if (await exists(join(projectPath, 'Dockerfile'))) {
    techs.push({ category: 'infrastructure', name: 'Docker', confidence: 1.0 })
  }

  return techs
}
```

### Skill Mapping

Pre-defined mappings from technologies to skill recommendations:

```typescript
const SKILL_MAPPINGS: Record<string, SkillTemplate> = {
  'TypeScript': {
    name: 'TypeScript Expert',
    description: 'Enforces TypeScript best practices and type safety',
    promptTemplate: `You are a TypeScript expert. When writing code:
- Use strict TypeScript with proper type annotations
- Prefer interfaces over type aliases for object shapes
- Use discriminated unions for complex state
- Leverage type inference where it's clear
- Avoid 'any' - use 'unknown' when type is truly unknown
- Use generics for reusable type-safe code
- Document complex types with JSDoc comments`
  },

  'React': {
    name: 'React Best Practices',
    description: 'Modern React patterns and conventions',
    promptTemplate: `You are a React expert. When writing React code:
- Use functional components with hooks
- Follow the Rules of Hooks
- Use proper dependency arrays in useEffect/useMemo/useCallback
- Prefer composition over inheritance
- Keep components small and focused
- Use proper key props for lists
- Handle loading and error states gracefully`
  },

  'Next.js': {
    name: 'Next.js Expert',
    description: 'Next.js App Router patterns and conventions',
    promptTemplate: `You are a Next.js expert using the App Router. Follow these practices:
- Use Server Components by default, Client Components when needed
- Implement proper data fetching with fetch and caching
- Use route handlers for API endpoints
- Implement proper error boundaries and loading states
- Use next/image for optimized images
- Follow the recommended folder structure
- Use metadata API for SEO`
  },

  'Jest': {
    name: 'Test-Driven Development',
    description: 'Jest testing patterns and TDD practices',
    promptTemplate: `You are a testing expert using Jest. Follow these practices:
- Write tests before implementation (TDD)
- Use describe/it blocks for clear test organization
- Follow AAA pattern: Arrange, Act, Assert
- Mock external dependencies properly
- Aim for high test coverage on critical paths
- Write meaningful test descriptions
- Use beforeEach/afterEach for setup/teardown`
  },

  'Vitest': {
    name: 'Vitest Testing',
    description: 'Vitest testing patterns and practices',
    promptTemplate: `You are a testing expert using Vitest. Follow these practices:
- Leverage Vitest's TypeScript-first approach
- Use vi.mock() for mocking modules
- Use vi.fn() for function mocks
- Leverage snapshot testing for UI components
- Use test.concurrent for parallel tests when appropriate
- Follow AAA pattern: Arrange, Act, Assert`
  },

  'Docker': {
    name: 'Docker Best Practices',
    description: 'Docker containerization patterns',
    promptTemplate: `You are a Docker expert. When working with containers:
- Use multi-stage builds to reduce image size
- Follow least privilege principle
- Don't run as root in containers
- Use specific image tags, not 'latest'
- Leverage build caching effectively
- Use .dockerignore to exclude unnecessary files
- Keep images minimal and secure`
  },

  'Python': {
    name: 'Python Best Practices',
    description: 'Modern Python patterns and conventions',
    promptTemplate: `You are a Python expert. Follow these practices:
- Use type hints for function signatures
- Follow PEP 8 style guidelines
- Use dataclasses or Pydantic for data structures
- Prefer context managers for resource handling
- Use pathlib for file paths
- Write docstrings for public functions
- Use virtual environments`
  },

  // More mappings...
}
```

### AI-Enhanced Analysis

For more nuanced analysis, use AI to examine the codebase:

```typescript
async function analyzeWithAI(projectPath: string, techs: DetectedTechnology[]): Promise<SkillRecommendation[]> {
  const context = await gatherProjectContext(projectPath)

  const prompt = `Analyze this project and suggest specific skills/instructions that would help an AI coding assistant work effectively in this codebase.

Detected technologies: ${techs.map(t => t.name).join(', ')}

Project context:
${context}

For each skill suggestion, provide:
1. A clear name
2. Why this skill would be helpful for this specific project
3. The actual prompt/instructions for the skill

Focus on project-specific patterns, not just generic best practices. Look for:
- Coding conventions used in this project
- Architectural patterns
- Testing approaches
- Error handling patterns
- Any unique practices`

  // Call AI and parse response
  const response = await invokeClaudeCode(prompt, projectPath)
  return parseSkillSuggestions(response)
}
```

### New Service: Project Analyzer (`src/main/analysis/project-analyzer.ts`)

```typescript
class ProjectAnalyzer {
  // Main analysis
  async analyzeProject(projectId: string): Promise<ProjectAnalysis>
  async detectTechnologies(projectPath: string): Promise<DetectedTechnology[]>
  async detectPatterns(projectPath: string): Promise<DetectedPattern[]>

  // Skill recommendations
  async getSkillRecommendations(projectId: string): Promise<SkillRecommendation[]>
  async generateSkillPrompt(technology: string, projectContext: string): Promise<string>

  // Actions
  async createSkillsFromRecommendations(
    projectId: string,
    recommendations: SkillRecommendation[]
  ): Promise<ClaudeSkill[]>
}
```

### IPC Handlers (`src/main/ipc/analysis-handlers.ts`)

```typescript
'analysis:analyzeProject' → analyzeProject(projectId)
'analysis:detectTechnologies' → detectTechnologies(projectId)
'analysis:getRecommendations' → getSkillRecommendations(projectId)
'analysis:createSkills' → createSkillsFromRecommendations(projectId, recommendations)
```

### UI Components

#### 1. Project Analysis Dialog (`src/renderer/src/components/analysis/ProjectAnalysisDialog.tsx`)

Main interface for analyzing a project:
- "Analyze Project" button in project settings
- Progress indicator during analysis
- Results view with detected technologies
- Skill recommendations with select/deselect
- "Create Selected Skills" action

#### 2. Technology Badges (`src/renderer/src/components/analysis/TechnologyBadges.tsx`)

Visual display of detected technologies:
- Icon + name for each tech
- Category grouping
- Confidence indicator

#### 3. Skill Recommendation Card (`src/renderer/src/components/analysis/SkillRecommendationCard.tsx`)

Card for each recommended skill:
- Skill name and description
- "Why this skill" explanation
- Preview of prompt
- Select checkbox
- Edit before creating option

### Integration Points

#### Project Settings

Add "Analyze for Skills" section:
- Shows last analysis date
- Detected technologies summary
- "Run Analysis" button
- Quick skill creation from recommendations

#### Claude Config Panel (from Plan 01)

Connect analysis to skill management:
- "Suggest Skills" button triggers analysis
- Recommendations appear in skill list as "suggested"
- One-click creation from suggestions

## Implementation Steps

### Phase 1: Technology Detection
1. Create technology detection types in `src/shared/types/analysis.ts`
2. Implement package file analyzers (package.json, requirements.txt, etc.)
3. Implement file pattern analyzers
4. Implement config file analyzers
5. Combine into `TechDetector` service

### Phase 2: Skill Mapping
6. Create skill template mappings for common technologies
7. Implement `SkillRecommender` that maps techs to skills
8. Add IPC handlers for analysis

### Phase 3: UI
9. Create `ProjectAnalysisDialog` component
10. Create `TechnologyBadges` component
11. Create `SkillRecommendationCard` component
12. Integrate with project settings

### Phase 4: AI Enhancement
13. Implement AI-powered analysis for nuanced suggestions
14. Add pattern detection (beyond just technology)
15. Generate project-specific skill prompts

### Phase 5: Integration
16. Connect to Claude Config Panel (Plan 01)
17. Add skill creation flow
18. Store analysis results for quick reference

## File Structure

```
src/
├── shared/types/
│   └── analysis.ts               # Analysis types
├── main/
│   ├── analysis/
│   │   ├── project-analyzer.ts   # Main service
│   │   ├── tech-detector.ts      # Technology detection
│   │   ├── pattern-detector.ts   # Pattern detection
│   │   ├── skill-recommender.ts  # Skill mapping
│   │   └── skill-templates.ts    # Pre-defined templates
│   └── ipc/
│       └── analysis-handlers.ts  # IPC handlers
├── preload/
│   └── index.ts                  # Add new API exposure
└── renderer/src/
    ├── components/analysis/
    │   ├── ProjectAnalysisDialog.tsx
    │   ├── TechnologyBadges.tsx
    │   ├── SkillRecommendationCard.tsx
    │   └── index.ts
    └── stores/
        └── analysis-store.ts
```

## Technology Detection Coverage

### Languages
- TypeScript/JavaScript (tsconfig.json, .ts/.js files)
- Python (requirements.txt, pyproject.toml, .py files)
- Go (go.mod, .go files)
- Rust (Cargo.toml, .rs files)
- Java/Kotlin (pom.xml, build.gradle, .java/.kt files)
- C# (.csproj, .cs files)
- Ruby (Gemfile, .rb files)
- PHP (composer.json, .php files)

### Frameworks
- React, Vue, Angular, Svelte (package.json dependencies)
- Next.js, Nuxt, Remix, Astro (config files + dependencies)
- Express, Fastify, NestJS, Hono (package.json)
- Django, FastAPI, Flask (Python packages)
- Rails (Gemfile)
- Spring Boot (Maven/Gradle + packages)

### Tools
- ESLint, Prettier (config files)
- Jest, Vitest, Mocha, pytest (config + dependencies)
- Webpack, Vite, esbuild, Rollup (config files)
- Docker, Kubernetes (Dockerfile, k8s manifests)
- Terraform, Pulumi (config files)
- GitHub Actions, CircleCI (workflow files)

### Databases
- PostgreSQL, MySQL, SQLite (connection strings, ORMs)
- MongoDB (mongoose, mongodb packages)
- Redis (ioredis, redis packages)
- Prisma, Drizzle, TypeORM (config files)

## Open Questions

1. **Analysis caching**: How long to cache analysis results? Re-run on every request?

2. **Incremental analysis**: Detect when project changes significantly enough to re-analyze?

3. **Custom templates**: Allow users to define their own tech → skill mappings?

4. **Confidence thresholds**: What confidence level should trigger a skill recommendation?

5. **Skill conflicts**: What if multiple technologies suggest similar skills?

## Success Criteria

- [ ] Project analysis detects major technologies accurately
- [ ] Skill recommendations are relevant and useful
- [ ] Users can review and select which skills to create
- [ ] Created skills appear in project's `.claude/skills/` directory
- [ ] Analysis integrates smoothly with Claude Config Panel
- [ ] UI clearly explains why each skill is recommended
