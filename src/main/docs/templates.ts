/**
 * Built-in Documentation Templates
 *
 * Provides predefined templates for common documentation types
 * with sections and generation prompts.
 */

import type { DocTemplate, DocumentationType } from '@shared/types'

/**
 * CLAUDE.md template - Agent context documentation
 */
const CLAUDE_MD_TEMPLATE: DocTemplate = {
  id: 'claude-md-default',
  type: 'claude-md',
  name: 'Claude Code Instructions',
  description: 'Project-specific instructions for Claude Code and AI agents',
  defaultPath: 'CLAUDE.md',
  isBuiltIn: true,
  sections: [
    {
      id: 'overview',
      name: 'Project Overview',
      description: 'High-level description of what the project is and its purpose',
      required: true,
      exampleContent: '# My Project\n\nA brief description of what this project does.'
    },
    {
      id: 'quick-start',
      name: 'Quick Start',
      description: 'Commands to get the project running quickly',
      required: true,
      exampleContent:
        '```bash\nnpm install\nnpm run dev\nnpm run build\nnpm run typecheck\n```'
    },
    {
      id: 'architecture',
      name: 'Architecture Overview',
      description: 'System architecture and high-level design',
      required: false,
      exampleContent: 'Diagram or description of the system architecture'
    },
    {
      id: 'project-structure',
      name: 'Project Structure',
      description: 'Directory structure and file organization',
      required: true,
      exampleContent: '```\nsrc/\n├── components/\n├── lib/\n└── utils/\n```'
    },
    {
      id: 'tech-stack',
      name: 'Technology Stack',
      description: 'Technologies, frameworks, and libraries used',
      required: true,
      exampleContent: '- React 18\n- TypeScript 5\n- Vite'
    },
    {
      id: 'conventions',
      name: 'Code Conventions',
      description: 'Coding standards, naming conventions, and best practices',
      required: false,
      exampleContent: '- Use functional components\n- Prefer const over let'
    },
    {
      id: 'important-files',
      name: 'Important Files',
      description: 'Key files and their purposes',
      required: false,
      exampleContent: '| File | Purpose |\n|------|---------|'
    },
    {
      id: 'common-tasks',
      name: 'Common Tasks',
      description: 'Frequently performed development tasks and how to do them',
      required: false,
      exampleContent: '## Adding a new component\n\n1. Create file in src/components/\n2. ...'
    }
  ],
  generationPrompt: `You are generating a CLAUDE.md file for a software project. This file provides
context and instructions for Claude Code (an AI coding assistant).

Analyze the project and create comprehensive documentation that helps an AI
understand:
1. What this project is and its purpose
2. How to run/build/test it
3. The architecture and key components
4. Important conventions and patterns
5. Common tasks and how to perform them

Be specific and include actual paths, commands, and file names from the project.
Use clear markdown formatting with code blocks, tables, and lists.
Focus on information that would help an AI assistant work effectively on this codebase.

The documentation should be thorough but concise, around 200-400 lines.`
}

/**
 * README.md template - User-facing project documentation
 */
const README_TEMPLATE: DocTemplate = {
  id: 'readme-default',
  type: 'readme',
  name: 'Standard README',
  description: 'User-facing project documentation and getting started guide',
  defaultPath: 'README.md',
  isBuiltIn: true,
  sections: [
    {
      id: 'title',
      name: 'Title & Badges',
      description: 'Project name, tagline, and status badges',
      required: true,
      exampleContent: '# Project Name\n\n[![CI](badge-url)](link)'
    },
    {
      id: 'description',
      name: 'Description',
      description: 'What the project does and why it exists',
      required: true,
      exampleContent: 'A brief description of the project purpose and value proposition'
    },
    {
      id: 'features',
      name: 'Features',
      description: 'Key features and capabilities',
      required: false,
      exampleContent: '- Feature 1\n- Feature 2\n- Feature 3'
    },
    {
      id: 'installation',
      name: 'Installation',
      description: 'How to install and set up the project',
      required: true,
      exampleContent: '```bash\nnpm install my-project\n```'
    },
    {
      id: 'usage',
      name: 'Usage',
      description: 'How to use the project with examples',
      required: true,
      exampleContent: '```javascript\nimport { example } from "my-project"\n```'
    },
    {
      id: 'configuration',
      name: 'Configuration',
      description: 'Configuration options and environment variables',
      required: false,
      exampleContent: '| Option | Description | Default |\n|--------|-------------|---------|'
    },
    {
      id: 'api',
      name: 'API Reference',
      description: 'API documentation or link to API docs',
      required: false,
      exampleContent: 'See [API.md](./API.md) for detailed API documentation'
    },
    {
      id: 'contributing',
      name: 'Contributing',
      description: 'How to contribute to the project',
      required: false,
      exampleContent: 'See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines'
    },
    {
      id: 'license',
      name: 'License',
      description: 'Project license information',
      required: true,
      exampleContent: 'MIT License - see [LICENSE](./LICENSE) for details'
    }
  ],
  generationPrompt: `You are generating a README.md file for a software project. The README should
be user-friendly and help developers quickly understand and get started with
the project.

Include:
1. Clear project title and description
2. Key features and capabilities
3. Installation instructions
4. Usage examples with code
5. Configuration options if applicable
6. Link to API docs if applicable
7. Contributing guidelines
8. License information

Write for human developers, not AI. Be concise but thorough.
Use clear markdown formatting with code blocks, tables, and badges where appropriate.
Make it welcoming and easy to navigate.

The README should be around 100-300 lines, depending on project complexity.`
}

/**
 * Architecture documentation template
 */
const ARCHITECTURE_TEMPLATE: DocTemplate = {
  id: 'architecture-default',
  type: 'architecture',
  name: 'Architecture Documentation',
  description: 'System design and architecture documentation',
  defaultPath: '.claude/docs/ARCHITECTURE.md',
  isBuiltIn: true,
  sections: [
    {
      id: 'overview',
      name: 'System Overview',
      description: 'High-level system description and goals',
      required: true,
      exampleContent: '# Architecture Overview\n\nThis system is designed to...'
    },
    {
      id: 'diagram',
      name: 'Architecture Diagram',
      description: 'Visual representation of the system architecture',
      required: false,
      exampleContent:
        '```\n┌─────────┐     ┌─────────┐\n│ Client  │────▶│ Server  │\n└─────────┘     └─────────┘\n```'
    },
    {
      id: 'components',
      name: 'Core Components',
      description: 'Main components and their responsibilities',
      required: true,
      exampleContent: '## Components\n\n### Component A\nResponsible for...'
    },
    {
      id: 'data-flow',
      name: 'Data Flow',
      description: 'How data flows through the system',
      required: false,
      exampleContent: '1. User request\n2. Process data\n3. Return response'
    },
    {
      id: 'integrations',
      name: 'External Integrations',
      description: 'External services and APIs',
      required: false,
      exampleContent: '- Database: PostgreSQL\n- Cache: Redis\n- Auth: Auth0'
    },
    {
      id: 'decisions',
      name: 'Design Decisions',
      description: 'Key architectural decisions and rationale',
      required: false,
      exampleContent: '## Why we chose X over Y\n\nWe chose X because...'
    }
  ],
  generationPrompt: `You are generating architecture documentation for a software project.
The documentation should help developers understand the system design and structure.

Analyze the project and document:
1. High-level system overview and goals
2. Architecture diagram (using ASCII art)
3. Core components and their responsibilities
4. Data flow through the system
5. External integrations and dependencies
6. Key architectural decisions and rationale

Be technical and thorough. Include diagrams using ASCII art or markdown.
Focus on helping developers understand the big picture and how pieces fit together.

The documentation should be around 150-400 lines.`
}

/**
 * API documentation template
 */
const API_TEMPLATE: DocTemplate = {
  id: 'api-default',
  type: 'api',
  name: 'API Documentation',
  description: 'API endpoints and interface documentation',
  defaultPath: '.claude/docs/API.md',
  isBuiltIn: true,
  sections: [
    {
      id: 'overview',
      name: 'API Overview',
      description: 'Introduction to the API',
      required: true,
      exampleContent: '# API Documentation\n\nBase URL: `https://api.example.com/v1`'
    },
    {
      id: 'authentication',
      name: 'Authentication',
      description: 'How to authenticate with the API',
      required: false,
      exampleContent: 'Include `Authorization: Bearer <token>` header'
    },
    {
      id: 'endpoints',
      name: 'Endpoints',
      description: 'List of available endpoints with examples',
      required: true,
      exampleContent:
        '## GET /users\n\nReturns a list of users.\n\n**Response:**\n```json\n{...}\n```'
    },
    {
      id: 'errors',
      name: 'Error Handling',
      description: 'Error codes and responses',
      required: false,
      exampleContent: '| Code | Description |\n|------|-------------|\n| 400 | Bad Request |'
    },
    {
      id: 'rate-limits',
      name: 'Rate Limits',
      description: 'API rate limiting policies',
      required: false,
      exampleContent: '100 requests per minute per API key'
    },
    {
      id: 'examples',
      name: 'Examples',
      description: 'Code examples for common use cases',
      required: false,
      exampleContent: '```javascript\nconst response = await fetch("/api/users")\n```'
    }
  ],
  generationPrompt: `You are generating API documentation for a software project.
The documentation should help developers understand and use the API.

Analyze the project and document:
1. API overview and base URL
2. Authentication requirements
3. All available endpoints with:
   - HTTP method
   - URL path
   - Parameters
   - Request body (if applicable)
   - Response format with examples
   - Error responses
4. Rate limits or usage policies
5. Code examples in common languages

Be precise and include actual code examples.
Format in a clear, scannable way with proper markdown.

The documentation should be around 150-500 lines depending on API complexity.`
}

/**
 * Contributing guide template
 */
const CONTRIBUTING_TEMPLATE: DocTemplate = {
  id: 'contributing-default',
  type: 'contributing',
  name: 'Contributing Guide',
  description: 'Guidelines for contributing to the project',
  defaultPath: 'CONTRIBUTING.md',
  isBuiltIn: true,
  sections: [
    {
      id: 'overview',
      name: 'Overview',
      description: 'Welcome message and contribution overview',
      required: true,
      exampleContent: '# Contributing\n\nThank you for your interest in contributing!'
    },
    {
      id: 'setup',
      name: 'Development Setup',
      description: 'How to set up the development environment',
      required: true,
      exampleContent: '```bash\ngit clone ...\nnpm install\n```'
    },
    {
      id: 'workflow',
      name: 'Contribution Workflow',
      description: 'Steps for making a contribution',
      required: true,
      exampleContent: '1. Fork the repo\n2. Create a branch\n3. Make changes\n4. Submit PR'
    },
    {
      id: 'standards',
      name: 'Code Standards',
      description: 'Coding standards and style guide',
      required: false,
      exampleContent: '- Follow ESLint rules\n- Write tests\n- Document public APIs'
    },
    {
      id: 'testing',
      name: 'Testing',
      description: 'How to run and write tests',
      required: false,
      exampleContent: '```bash\nnpm test\n```'
    },
    {
      id: 'pull-requests',
      name: 'Pull Request Process',
      description: 'PR guidelines and review process',
      required: true,
      exampleContent: '- Provide clear description\n- Link related issues\n- Ensure CI passes'
    }
  ],
  generationPrompt: `You are generating a CONTRIBUTING.md file for a software project.
The guide should help new contributors get started.

Include:
1. Welcome message
2. Development environment setup
3. Contribution workflow (fork, branch, PR)
4. Code standards and style guide
5. Testing requirements
6. Pull request process
7. Code of conduct (if applicable)

Be welcoming and clear. Include specific commands and examples.
Make it easy for first-time contributors to get involved.

The guide should be around 100-250 lines.`
}

/**
 * Changelog template
 */
const CHANGELOG_TEMPLATE: DocTemplate = {
  id: 'changelog-default',
  type: 'changelog',
  name: 'Changelog',
  description: 'Project change history',
  defaultPath: 'CHANGELOG.md',
  isBuiltIn: true,
  sections: [
    {
      id: 'intro',
      name: 'Introduction',
      description: 'Changelog format explanation',
      required: true,
      exampleContent:
        '# Changelog\n\nAll notable changes to this project will be documented in this file.'
    },
    {
      id: 'unreleased',
      name: 'Unreleased',
      description: 'Changes not yet released',
      required: true,
      exampleContent: '## [Unreleased]\n\n### Added\n- New feature'
    },
    {
      id: 'versions',
      name: 'Version History',
      description: 'Released versions with changes',
      required: true,
      exampleContent:
        '## [1.0.0] - 2024-01-01\n\n### Added\n- Initial release\n\n### Fixed\n- Bug fixes'
    }
  ],
  generationPrompt: `You are generating a CHANGELOG.md file for a software project.
Follow the "Keep a Changelog" format (https://keepachangelog.com/).

Analyze the project's git history and create a changelog with:
1. Introduction explaining the format
2. [Unreleased] section for upcoming changes
3. Version sections with:
   - Version number and date
   - Changes categorized as: Added, Changed, Deprecated, Removed, Fixed, Security
4. Links to version diffs (if applicable)

Use semantic versioning. Be concise but informative.
Focus on user-facing changes.

The changelog should be around 50-200 lines depending on version history.`
}

/**
 * Map of all built-in templates
 */
export const BUILT_IN_TEMPLATES: Record<DocumentationType, DocTemplate> = {
  'claude-md': CLAUDE_MD_TEMPLATE,
  readme: README_TEMPLATE,
  architecture: ARCHITECTURE_TEMPLATE,
  api: API_TEMPLATE,
  contributing: CONTRIBUTING_TEMPLATE,
  changelog: CHANGELOG_TEMPLATE,
  custom: {
    id: 'custom-default',
    type: 'custom',
    name: 'Custom Documentation',
    description: 'Custom documentation with user-defined sections',
    defaultPath: 'DOCUMENTATION.md',
    isBuiltIn: true,
    sections: [],
    generationPrompt: `You are generating custom documentation for a software project.
Analyze the project and create documentation based on the user's requirements.

Be thorough and well-organized. Use clear markdown formatting.`
  }
}

/**
 * Get a template by documentation type
 */
export function getTemplate(type: DocumentationType): DocTemplate {
  return BUILT_IN_TEMPLATES[type]
}

/**
 * Get all built-in templates
 */
export function getAllTemplates(): DocTemplate[] {
  return Object.values(BUILT_IN_TEMPLATES)
}

/**
 * Check if a template exists for a documentation type
 */
export function hasTemplate(type: DocumentationType): boolean {
  return type in BUILT_IN_TEMPLATES
}
