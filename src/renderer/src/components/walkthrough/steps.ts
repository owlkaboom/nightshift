/**
 * Walkthrough Steps Configuration
 *
 * Defines the sequence of steps for the main product walkthrough tour.
 */

import type { WalkthroughStep } from '@shared/types/walkthrough'

/**
 * Main walkthrough tour steps
 *
 * Each step highlights a key feature of the application in a logical sequence.
 * Steps include navigation to specific routes and highlighting of UI elements.
 */
export const walkthroughSteps: WalkthroughStep[] = [
  {
    id: 'welcome',
    targetSelector: '.sidebar',
    title: 'Welcome to Nightshift',
    description:
      'Your AI task orchestrator. Let\'s explore the key features and get you started.',
    route: '/board',
    position: 'right',
    spotlightPadding: 8
  },
  {
    id: 'task-board',
    targetSelector: '[data-tour="board"]',
    title: 'Task Board',
    description:
      'This is your command center. View and manage all your AI coding tasks here. Tasks move through columns as they progress.',
    route: '/board',
    position: 'bottom',
    spotlightPadding: 12
  },
  {
    id: 'add-task',
    targetSelector: '[data-tour="add-task"]',
    title: 'Create Tasks',
    description:
      'Click here to create a new task for the AI to work on. You can describe what you want in natural language.',
    route: '/board',
    position: 'bottom',
    spotlightPadding: 8
  },
  {
    id: 'task-board-area',
    targetSelector: '[data-tour="board-content"]',
    title: 'Task Board',
    description:
      'Tasks are organized in columns. Drag cards to reorder priority or move between columns. Click to view details and review AI-generated changes.',
    route: '/board',
    position: 'top',
    spotlightPadding: 16,
    beforeShow: async () => {
      // Wait a bit for the board to render
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  },
  {
    id: 'projects',
    targetSelector: '[data-tour="projects"]',
    title: 'Projects',
    description:
      'Organize your work by project. Each project has its own task queue and can be linked to a git repository.',
    route: '/projects',
    position: 'bottom',
    spotlightPadding: 12
  },
  {
    id: 'planning',
    targetSelector: '[data-tour="planning"]',
    title: 'AI Planning',
    description:
      'Have interactive planning sessions with AI before creating tasks. Break down complex features into actionable steps.',
    route: '/planning',
    position: 'bottom',
    spotlightPadding: 12
  },
  {
    id: 'skills',
    targetSelector: '[data-tour="skills"]',
    title: 'Skills',
    description:
      'Customize AI behavior with skill prompts for different coding styles, frameworks, and best practices.',
    route: '/skills',
    position: 'bottom',
    spotlightPadding: 12
  },
  {
    id: 'settings',
    targetSelector: '[data-tour="settings"]',
    title: 'Settings',
    description:
      'Configure AI agents, themes, integrations, and other preferences here. Set up your API keys to get started.',
    route: '/settings',
    position: 'bottom',
    spotlightPadding: 12
  },
  {
    id: 'complete',
    targetSelector: 'body',
    title: 'You\'re Ready!',
    description:
      'Start by adding a project and creating your first task. Nightshift will handle the rest. Happy coding!',
    route: '/board',
    position: 'auto',
    spotlightPadding: 0
  }
]

/**
 * Get a step by its ID
 */
export const getStepById = (id: string): WalkthroughStep | undefined => {
  return walkthroughSteps.find((step) => step.id === id)
}

/**
 * Get the index of a step by its ID
 */
export const getStepIndex = (id: string): number => {
  return walkthroughSteps.findIndex((step) => step.id === id)
}

/**
 * Get the total number of steps
 */
export const getTotalSteps = (): number => {
  return walkthroughSteps.length
}
