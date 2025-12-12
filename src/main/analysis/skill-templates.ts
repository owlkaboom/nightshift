/**
 * Skill templates for project analysis
 *
 * Pre-defined mappings from technologies to skill recommendations.
 * These templates are used to generate skill suggestions based on
 * detected technologies in a project.
 */

import type { SkillTemplate } from '@shared/types'

/**
 * Skill template definition with additional metadata
 */
interface SkillTemplateDefinition extends Omit<SkillTemplate, 'technology'> {
  /** Technologies that this skill applies to */
  technologies: string[]
}

/**
 * Pre-defined skill templates organized by category
 */
export const SKILL_TEMPLATES: SkillTemplateDefinition[] = [
  // ============ Languages ============
  {
    technologies: ['TypeScript'],
    name: 'TypeScript Expert',
    description: 'Enforces TypeScript best practices and type safety',
    promptTemplate: `You are a TypeScript expert. When writing code:
- Use strict TypeScript with proper type annotations
- Prefer interfaces over type aliases for object shapes
- Use discriminated unions for complex state
- Leverage type inference where it's clear
- Avoid 'any' - use 'unknown' when type is truly unknown
- Use generics for reusable type-safe code
- Document complex types with JSDoc comments
- Use const assertions for literal types
- Prefer readonly arrays and objects when mutation isn't needed`,
    defaultPriority: 'high',
    relatedTechnologies: ['JavaScript', 'Node.js']
  },
  {
    technologies: ['Python'],
    name: 'Python Best Practices',
    description: 'Modern Python patterns and conventions',
    promptTemplate: `You are a Python expert. Follow these practices:
- Use type hints for function signatures and variables
- Follow PEP 8 style guidelines
- Use dataclasses or Pydantic for data structures
- Prefer context managers for resource handling
- Use pathlib for file paths instead of os.path
- Write docstrings for public functions using Google or NumPy style
- Use virtual environments for dependency management
- Prefer f-strings for string formatting
- Use list comprehensions and generator expressions appropriately`,
    defaultPriority: 'high',
    relatedTechnologies: ['Django', 'FastAPI', 'Flask']
  },
  {
    technologies: ['Go', 'Golang'],
    name: 'Go Best Practices',
    description: 'Idiomatic Go patterns and conventions',
    promptTemplate: `You are a Go expert. Follow these practices:
- Follow effective Go idioms and conventions
- Use meaningful variable names, especially short ones in small scopes
- Handle errors explicitly - don't ignore them
- Use interfaces for abstraction, keep them small
- Prefer composition over inheritance
- Use goroutines and channels appropriately
- Write table-driven tests
- Document exported functions and types
- Use context for cancellation and timeouts`,
    defaultPriority: 'high'
  },
  {
    technologies: ['Rust'],
    name: 'Rust Best Practices',
    description: 'Safe and idiomatic Rust patterns',
    promptTemplate: `You are a Rust expert. Follow these practices:
- Embrace ownership and borrowing - don't fight the borrow checker
- Use Result and Option for error handling, avoid panic in libraries
- Prefer iterators over manual loops
- Use derive macros for common traits
- Write documentation comments with examples
- Use clippy lints to improve code quality
- Prefer &str over String for function parameters
- Use cargo fmt for consistent formatting
- Write tests alongside implementation`,
    defaultPriority: 'high'
  },

  // ============ Frontend Frameworks ============
  {
    technologies: ['React'],
    name: 'React Best Practices',
    description: 'Modern React patterns and conventions',
    promptTemplate: `You are a React expert. When writing React code:
- Use functional components with hooks
- Follow the Rules of Hooks strictly
- Use proper dependency arrays in useEffect/useMemo/useCallback
- Prefer composition over inheritance
- Keep components small and focused (single responsibility)
- Use proper key props for lists (avoid index as key)
- Handle loading and error states gracefully
- Use React.memo for expensive pure components
- Lift state up when needed, use context sparingly
- Prefer controlled components for forms`,
    defaultPriority: 'high',
    relatedTechnologies: ['TypeScript', 'JavaScript']
  },
  {
    technologies: ['Next.js'],
    name: 'Next.js Expert',
    description: 'Next.js App Router patterns and conventions',
    promptTemplate: `You are a Next.js expert using the App Router. Follow these practices:
- Use Server Components by default, Client Components only when needed
- Implement proper data fetching with fetch and caching strategies
- Use route handlers for API endpoints
- Implement proper error boundaries and loading states
- Use next/image for optimized images
- Follow the recommended folder structure (app directory)
- Use metadata API for SEO
- Leverage parallel routes and intercepting routes when appropriate
- Use server actions for mutations
- Implement proper streaming with Suspense`,
    defaultPriority: 'high',
    relatedTechnologies: ['React', 'TypeScript']
  },
  {
    technologies: ['Vue', 'Vue.js'],
    name: 'Vue Best Practices',
    description: 'Vue 3 Composition API patterns',
    promptTemplate: `You are a Vue.js expert. Follow these practices:
- Use the Composition API with script setup
- Organize code by logical concern, not option type
- Use composables to extract reusable logic
- Prefer ref for primitives, reactive for objects
- Use computed for derived state
- Watch with proper cleanup
- Use provide/inject for dependency injection
- Follow Vue style guide recommendations
- Use defineProps and defineEmits with TypeScript`,
    defaultPriority: 'high',
    relatedTechnologies: ['TypeScript', 'JavaScript']
  },
  {
    technologies: ['Svelte', 'SvelteKit'],
    name: 'Svelte Best Practices',
    description: 'Svelte and SvelteKit patterns',
    promptTemplate: `You are a Svelte expert. Follow these practices:
- Use reactive declarations ($:) for derived values
- Leverage Svelte stores for shared state
- Use component composition effectively
- Implement proper transitions and animations
- Use SvelteKit load functions for data fetching
- Implement proper form actions
- Use TypeScript with Svelte components
- Follow accessibility best practices
- Use slots for flexible component APIs`,
    defaultPriority: 'high'
  },
  {
    technologies: ['Angular'],
    name: 'Angular Best Practices',
    description: 'Modern Angular patterns and conventions',
    promptTemplate: `You are an Angular expert. Follow these practices:
- Use standalone components when possible
- Leverage signals for reactive state
- Use dependency injection effectively
- Follow Angular style guide
- Implement proper lazy loading
- Use TypeScript strict mode
- Implement proper change detection strategies
- Use RxJS operators appropriately
- Write unit tests with TestBed`,
    defaultPriority: 'high',
    relatedTechnologies: ['TypeScript', 'RxJS']
  },

  // ============ Backend Frameworks ============
  {
    technologies: ['Express', 'Express.js'],
    name: 'Express Best Practices',
    description: 'Express.js patterns and middleware',
    promptTemplate: `You are an Express.js expert. Follow these practices:
- Use proper middleware organization
- Implement error handling middleware
- Validate request inputs
- Use async/await with proper error handling
- Structure routes logically
- Implement proper security middleware (helmet, cors)
- Use environment variables for configuration
- Implement proper logging
- Handle graceful shutdown`,
    defaultPriority: 'medium',
    relatedTechnologies: ['Node.js', 'TypeScript']
  },
  {
    technologies: ['NestJS'],
    name: 'NestJS Expert',
    description: 'NestJS patterns and architecture',
    promptTemplate: `You are a NestJS expert. Follow these practices:
- Use decorators and dependency injection properly
- Organize code into modules
- Implement proper DTOs with class-validator
- Use guards for authentication/authorization
- Implement interceptors for cross-cutting concerns
- Use pipes for validation and transformation
- Follow the repository pattern for data access
- Write unit and e2e tests
- Use OpenAPI/Swagger for documentation`,
    defaultPriority: 'high',
    relatedTechnologies: ['TypeScript', 'Node.js']
  },
  {
    technologies: ['FastAPI'],
    name: 'FastAPI Expert',
    description: 'FastAPI patterns and best practices',
    promptTemplate: `You are a FastAPI expert. Follow these practices:
- Use Pydantic models for request/response validation
- Implement proper dependency injection
- Use async/await for I/O operations
- Implement proper error handling with HTTPException
- Use path operations with proper documentation
- Leverage automatic OpenAPI documentation
- Implement background tasks when needed
- Use proper security utilities (OAuth2, JWT)
- Structure the app with routers`,
    defaultPriority: 'high',
    relatedTechnologies: ['Python', 'Pydantic']
  },
  {
    technologies: ['Django'],
    name: 'Django Best Practices',
    description: 'Django patterns and conventions',
    promptTemplate: `You are a Django expert. Follow these practices:
- Follow Django's MTV (Model-Template-View) pattern
- Use class-based views appropriately
- Implement proper model relationships
- Use Django ORM effectively
- Implement proper form validation
- Use signals sparingly
- Follow Django security best practices
- Write tests using Django's test framework
- Use Django REST framework for APIs`,
    defaultPriority: 'high',
    relatedTechnologies: ['Python']
  },

  // ============ Testing ============
  {
    technologies: ['Jest'],
    name: 'Jest Testing Expert',
    description: 'Jest testing patterns and TDD practices',
    promptTemplate: `You are a testing expert using Jest. Follow these practices:
- Write tests before implementation (TDD) when practical
- Use describe/it blocks for clear test organization
- Follow AAA pattern: Arrange, Act, Assert
- Mock external dependencies with jest.mock()
- Use jest.fn() for function mocks
- Aim for high test coverage on critical paths
- Write meaningful test descriptions
- Use beforeEach/afterEach for setup/teardown
- Test edge cases and error conditions
- Use snapshot testing judiciously`,
    defaultPriority: 'medium',
    relatedTechnologies: ['TypeScript', 'JavaScript', 'React']
  },
  {
    technologies: ['Vitest'],
    name: 'Vitest Testing',
    description: 'Vitest testing patterns and practices',
    promptTemplate: `You are a testing expert using Vitest. Follow these practices:
- Leverage Vitest's TypeScript-first approach
- Use vi.mock() for mocking modules
- Use vi.fn() and vi.spyOn() for function mocks
- Leverage snapshot testing for UI components
- Use test.concurrent for parallel tests when appropriate
- Follow AAA pattern: Arrange, Act, Assert
- Use in-source testing when appropriate
- Leverage Vitest's watch mode during development
- Test both happy paths and error conditions`,
    defaultPriority: 'medium',
    relatedTechnologies: ['TypeScript', 'Vue', 'React']
  },
  {
    technologies: ['Playwright'],
    name: 'Playwright E2E Testing',
    description: 'Playwright end-to-end testing patterns',
    promptTemplate: `You are a Playwright expert. Follow these practices:
- Write resilient selectors (prefer data-testid, role, text)
- Use page object model for maintainability
- Implement proper waiting strategies
- Use fixtures for common setup
- Leverage parallel test execution
- Implement visual regression testing
- Test across multiple browsers
- Handle authentication properly
- Use trace viewer for debugging`,
    defaultPriority: 'medium'
  },
  {
    technologies: ['Cypress'],
    name: 'Cypress Testing',
    description: 'Cypress end-to-end testing patterns',
    promptTemplate: `You are a Cypress expert. Follow these practices:
- Use data attributes for test selectors
- Avoid anti-patterns (conditional testing, flaky assertions)
- Use custom commands for reusable actions
- Implement proper waiting with cy.intercept()
- Use fixtures for test data
- Leverage Cypress Dashboard for CI
- Test API endpoints with cy.request()
- Use proper assertions with should()
- Handle authentication with cy.session()`,
    defaultPriority: 'medium'
  },
  {
    technologies: ['pytest'],
    name: 'pytest Testing',
    description: 'pytest testing patterns for Python',
    promptTemplate: `You are a pytest expert. Follow these practices:
- Use fixtures for setup and teardown
- Leverage parametrize for multiple test cases
- Use markers for test categorization
- Follow AAA pattern: Arrange, Act, Assert
- Use conftest.py for shared fixtures
- Mock external dependencies with pytest-mock
- Use plugins like pytest-cov for coverage
- Write clear assertion messages
- Test exceptions with pytest.raises`,
    defaultPriority: 'medium',
    relatedTechnologies: ['Python']
  },

  // ============ Tools ============
  {
    technologies: ['ESLint'],
    name: 'Code Quality Focus',
    description: 'Follow ESLint rules and code quality standards',
    promptTemplate: `This project uses ESLint for code quality. When writing code:
- Follow the project's ESLint configuration
- Fix linting errors before committing
- Use appropriate ESLint disable comments sparingly and with justification
- Prefer auto-fixable patterns when available
- Maintain consistent code style throughout`,
    defaultPriority: 'low'
  },
  {
    technologies: ['Prettier'],
    name: 'Code Formatting',
    description: 'Follow Prettier formatting conventions',
    promptTemplate: `This project uses Prettier for code formatting. When writing code:
- Let Prettier handle formatting decisions
- Don't fight Prettier's output
- Ensure code passes Prettier checks before committing`,
    defaultPriority: 'low'
  },

  // ============ Infrastructure ============
  {
    technologies: ['Docker'],
    name: 'Docker Best Practices',
    description: 'Docker containerization patterns',
    promptTemplate: `You are a Docker expert. When working with containers:
- Use multi-stage builds to reduce image size
- Follow least privilege principle
- Don't run as root in containers
- Use specific image tags, not 'latest'
- Leverage build caching effectively
- Use .dockerignore to exclude unnecessary files
- Keep images minimal and secure
- Use health checks
- Handle signals properly for graceful shutdown`,
    defaultPriority: 'medium'
  },
  {
    technologies: ['Kubernetes', 'k8s'],
    name: 'Kubernetes Best Practices',
    description: 'Kubernetes deployment patterns',
    promptTemplate: `You are a Kubernetes expert. Follow these practices:
- Use declarative configuration (YAML/Helm)
- Implement proper resource limits and requests
- Use namespaces for isolation
- Implement proper health checks (liveness, readiness)
- Use ConfigMaps and Secrets appropriately
- Implement proper RBAC
- Use labels and annotations effectively
- Implement proper networking policies
- Use Helm for complex deployments`,
    defaultPriority: 'medium'
  },
  {
    technologies: ['Terraform'],
    name: 'Terraform Best Practices',
    description: 'Infrastructure as Code with Terraform',
    promptTemplate: `You are a Terraform expert. Follow these practices:
- Use modules for reusable infrastructure
- Implement proper state management
- Use workspaces for environment separation
- Follow naming conventions consistently
- Use data sources when appropriate
- Implement proper variable validation
- Use locals for computed values
- Document modules with README files
- Use terraform fmt for formatting`,
    defaultPriority: 'medium'
  },

  // ============ Databases ============
  {
    technologies: ['PostgreSQL', 'Postgres'],
    name: 'PostgreSQL Expert',
    description: 'PostgreSQL database best practices',
    promptTemplate: `You are a PostgreSQL expert. Follow these practices:
- Design normalized schemas (unless denormalization is justified)
- Use appropriate data types
- Implement proper indexing strategies
- Write efficient queries
- Use transactions appropriately
- Implement proper constraints
- Use EXPLAIN ANALYZE for query optimization
- Handle migrations safely
- Use connection pooling`,
    defaultPriority: 'medium'
  },
  {
    technologies: ['MongoDB'],
    name: 'MongoDB Best Practices',
    description: 'MongoDB database patterns',
    promptTemplate: `You are a MongoDB expert. Follow these practices:
- Design schemas for query patterns
- Use appropriate data modeling (embedding vs referencing)
- Implement proper indexing
- Use aggregation pipeline effectively
- Handle schema migrations properly
- Implement proper validation rules
- Use transactions when needed
- Optimize for read or write as appropriate`,
    defaultPriority: 'medium'
  },
  {
    technologies: ['Prisma'],
    name: 'Prisma ORM Expert',
    description: 'Prisma ORM patterns and best practices',
    promptTemplate: `You are a Prisma expert. Follow these practices:
- Design schemas with proper relations
- Use Prisma Client efficiently
- Implement proper migrations
- Use transactions for complex operations
- Leverage Prisma's type safety
- Use select and include appropriately
- Handle pagination properly
- Use raw queries sparingly
- Implement proper error handling`,
    defaultPriority: 'medium',
    relatedTechnologies: ['TypeScript', 'Node.js']
  },

  // ============ State Management ============
  {
    technologies: ['Redux', 'Redux Toolkit'],
    name: 'Redux Best Practices',
    description: 'Redux state management patterns',
    promptTemplate: `You are a Redux expert. Follow these practices:
- Use Redux Toolkit for modern Redux
- Structure state by feature (slices)
- Use createSlice for reducers
- Use createAsyncThunk for async operations
- Keep state normalized when appropriate
- Use selectors for derived state
- Avoid storing derived data
- Use RTK Query for data fetching`,
    defaultPriority: 'medium',
    relatedTechnologies: ['React', 'TypeScript']
  },
  {
    technologies: ['Zustand'],
    name: 'Zustand State Management',
    description: 'Zustand patterns and best practices',
    promptTemplate: `You are a Zustand expert. Follow these practices:
- Keep stores small and focused
- Use selectors to prevent unnecessary re-renders
- Implement middleware when needed
- Use persist middleware for local storage
- Separate actions from state
- Use immer for complex updates
- Test stores independently`,
    defaultPriority: 'medium',
    relatedTechnologies: ['React', 'TypeScript']
  },

  // ============ API & Data Fetching ============
  {
    technologies: ['GraphQL'],
    name: 'GraphQL Best Practices',
    description: 'GraphQL API design and usage',
    promptTemplate: `You are a GraphQL expert. Follow these practices:
- Design schemas with client needs in mind
- Use proper naming conventions
- Implement proper error handling
- Use fragments for reusable selections
- Implement pagination (cursor-based preferred)
- Use DataLoader for batching
- Implement proper authentication/authorization
- Document the schema
- Use persisted queries in production`,
    defaultPriority: 'medium'
  },
  {
    technologies: ['tRPC'],
    name: 'tRPC Best Practices',
    description: 'Type-safe API patterns with tRPC',
    promptTemplate: `You are a tRPC expert. Follow these practices:
- Organize routers by feature
- Use proper input validation with Zod
- Implement proper error handling
- Use middleware for cross-cutting concerns
- Leverage type inference
- Use batching for multiple queries
- Implement proper authentication
- Use subscriptions for real-time features`,
    defaultPriority: 'medium',
    relatedTechnologies: ['TypeScript', 'React']
  },
  {
    technologies: ['TanStack Query', 'React Query'],
    name: 'TanStack Query Expert',
    description: 'Server state management with TanStack Query',
    promptTemplate: `You are a TanStack Query expert. Follow these practices:
- Use proper query keys for caching
- Configure staleTime and cacheTime appropriately
- Use mutations for data changes
- Implement optimistic updates
- Use query invalidation effectively
- Handle loading and error states
- Use prefetching for better UX
- Configure retry behavior
- Use placeholderData for instant UI`,
    defaultPriority: 'medium',
    relatedTechnologies: ['React', 'TypeScript']
  },

  // ============ CI/CD ============
  {
    technologies: ['GitHub Actions'],
    name: 'GitHub Actions Expert',
    description: 'GitHub Actions CI/CD patterns',
    promptTemplate: `You are a GitHub Actions expert. Follow these practices:
- Use reusable workflows
- Cache dependencies properly
- Use matrix builds for multiple environments
- Implement proper secrets management
- Use environment protection rules
- Optimize workflow run time
- Use composite actions for reusability
- Implement proper artifact handling
- Use concurrency to prevent duplicate runs`,
    defaultPriority: 'low'
  }
]

/**
 * Get skill templates for a specific technology
 */
export function getTemplatesForTechnology(technology: string): SkillTemplate[] {
  const normalizedTech = technology.toLowerCase()

  return SKILL_TEMPLATES.filter((template) =>
    template.technologies.some((t) => t.toLowerCase() === normalizedTech)
  ).map((template) => ({
    technology,
    name: template.name,
    description: template.description,
    promptTemplate: template.promptTemplate,
    defaultPriority: template.defaultPriority,
    relatedTechnologies: template.relatedTechnologies
  }))
}

/**
 * Get all unique technologies that have skill templates
 */
export function getSupportedTechnologies(): string[] {
  const technologies = new Set<string>()

  for (const template of SKILL_TEMPLATES) {
    for (const tech of template.technologies) {
      technologies.add(tech)
    }
  }

  return Array.from(technologies).sort()
}

/**
 * Check if a technology has skill templates
 */
export function hasTechnologyTemplate(technology: string): boolean {
  const normalizedTech = technology.toLowerCase()

  return SKILL_TEMPLATES.some((template) =>
    template.technologies.some((t) => t.toLowerCase() === normalizedTech)
  )
}

/**
 * Get template by name
 */
export function getTemplateByName(name: string): SkillTemplateDefinition | undefined {
  return SKILL_TEMPLATES.find((t) => t.name === name)
}

/**
 * Get templates that are related to the given technologies
 */
export function getRelatedTemplates(technologies: string[]): SkillTemplate[] {
  const normalizedTechs = new Set(technologies.map((t) => t.toLowerCase()))
  const results: SkillTemplate[] = []
  const addedNames = new Set<string>()

  for (const template of SKILL_TEMPLATES) {
    // Skip if already added
    if (addedNames.has(template.name)) continue

    // Check if any of the template's related technologies match
    const hasRelated = template.relatedTechnologies?.some((rt) =>
      normalizedTechs.has(rt.toLowerCase())
    )

    if (hasRelated) {
      results.push({
        technology: template.technologies[0],
        name: template.name,
        description: template.description,
        promptTemplate: template.promptTemplate,
        defaultPriority: template.defaultPriority,
        relatedTechnologies: template.relatedTechnologies
      })
      addedNames.add(template.name)
    }
  }

  return results
}
