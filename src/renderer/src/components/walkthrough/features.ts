/**
 * Feature Highlights Configuration
 *
 * Defines feature highlights that appear as "New" badges and spotlights
 * for features added in recent versions.
 *
 * CUSTOM CONTENT SUPPORT:
 * You can add custom content to feature highlights using the `content` property:
 *
 * 1. Markdown:
 *    content: { type: 'markdown', source: '**Bold** and _italic_ text' }
 *
 * 2. Images/GIFs:
 *    content: {
 *      type: 'image',
 *      source: '/path/to/image.gif',
 *      alt: 'Description',
 *      maxWidth: 400,
 *      maxHeight: 300
 *    }
 *
 * 3. Videos:
 *    content: {
 *      type: 'video',
 *      source: '/path/to/video.mp4',
 *      alt: 'Description',
 *      maxWidth: 400,
 *      maxHeight: 300
 *    }
 */

import type { FeatureHighlight } from '@shared/types/walkthrough'

/**
 * Feature highlights registry
 *
 * Add new entries here when releasing features that should be highlighted.
 * Users who haven't seen these features will see a badge and spotlight.
 */
export const featureHighlights: FeatureHighlight[] = [
  {
    id: 'voice-task-input',
    targetSelector: '[data-feature="voice-task-input"]',
    title: 'Voice Task Input',
    description:
      'Create tasks using your voice! Click the microphone icon when adding a task to dictate your requirements.',
    route: '/board',
    badgeText: 'New',
    priority: 10,
    // Example of using custom content - you can add markdown, images, or GIFs
    content: {
      type: 'markdown',
      source: `
**How to use:**
1. Click the **Add Task** button
2. Look for the microphone icon
3. Click it to start recording
4. Speak your task description
5. Click again to stop and transcribe
      `.trim()
    }
  },
  {
    id: 'planning-sessions',
    targetSelector: '[data-feature="planning-sessions"]',
    title: 'Planning Sessions',
    description:
      'Have interactive AI planning sessions to break down complex features before creating tasks.',
    route: '/planning',
    badgeText: 'New',
    priority: 20,
    content: {
      type: 'markdown',
      source: `
**Why use Planning Sessions?**

Break down complex features into actionable tasks through an AI-guided conversation.

**How it works:**
1. Navigate to the **Planning** tab
2. Describe your feature or project
3. Have a back-and-forth conversation with the AI
4. Review the generated plan items
5. Convert plan items directly into tasks with one click

**Best for:**
- Complex features that need breaking down
- Exploring implementation approaches
- Creating detailed task lists
- Getting AI input before coding
      `.trim()
    }
  },
  {
    id: 'skills-system',
    targetSelector: '[data-feature="skills-system"]',
    title: 'Skills System',
    description:
      'Customize AI behavior with reusable skill prompts. Create your own or use built-in skills for common patterns.',
    route: '/skills',
    badgeText: 'New',
    priority: 30,
    content: {
      type: 'markdown',
      source: `
**What are Skills?**

Skills are reusable prompt templates that customize how the AI agent approaches tasks.

**Getting Started:**
1. Go to the **Skills** tab
2. Browse built-in skills (TypeScript Expert, React Best Practices, etc.)
3. Create your own custom skills with specific instructions
4. Select skills when creating or editing tasks

**Examples:**
- "Focus on performance optimization"
- "Follow TDD with comprehensive tests"
- "Prioritize accessibility and semantic HTML"
- "Use functional programming patterns"

**Pro Tip:** Combine multiple skills on a single task for specialized behavior!
      `.trim()
    }
  },
  {
    id: 'rich-text-editor',
    targetSelector: '[data-feature="rich-text-editor"]',
    title: 'Rich Text Editing',
    description:
      'Task prompts and notes now support markdown formatting with a rich text editor.',
    route: ['/board/add-task', '/board/add-voice-task'],
    badgeText: 'New',
    priority: 50,
    content: {
      type: 'markdown',
      source: `
**Rich Text Everywhere**

Format your task descriptions and notes with full markdown support.

**Available Formatting:**
- **Bold**, _italic_, and \`code\` text
- Headers (H1, H2, H3)
- Bulleted and numbered lists
- Code blocks with syntax highlighting
- Blockquotes for important notes
- Links to documentation

**Keyboard Shortcuts:**
- **Cmd/Ctrl + B** - Bold
- **Cmd/Ctrl + I** - Italic
- **Cmd/Ctrl + K** - Code
- Or use the formatting toolbar!

**Pro Tip:** Write detailed technical requirements with code examples right in your task prompts!
      `.trim()
    }
  },
  {
    id: 'integrations-panel',
    targetSelector: '[data-feature="integrations-panel"]',
    title: 'Integrations',
    description:
      'Connect to GitHub and JIRA to import issues directly as tasks. Manage all your integrations in one place.',
    route: '/settings',
    badgeText: 'New',
    priority: 60,
    content: {
      type: 'markdown',
      source: `
**Connect Your Workflow**

Import issues and tickets directly from GitHub and JIRA as Nightshift tasks.

**Supported Integrations:**
- **GitHub** - Import issues, PRs, and discussions
- **JIRA** - Sync tickets and epics from your projects

**Getting Started:**
1. Go to **Settings** → **Integrations**
2. Click **Add Integration**
3. Choose GitHub or JIRA
4. Enter your credentials (stored securely)
5. Browse and import issues as tasks

**Features:**
- Two-way sync (coming soon)
- Automatic status updates
- Link tasks back to original issues
- Filter by labels, milestones, and assignees

**Pro Tip:** Set up integrations once and never manually copy issue descriptions again!
      `.trim()
    }
  }
]

/**
 * Get feature highlights for a specific route
 */
export const getFeaturesForRoute = (route: string): FeatureHighlight[] => {
  return featureHighlights.filter((feature) => {
    if (!feature.route) return false

    // Handle single route or array of routes
    const routes = Array.isArray(feature.route) ? feature.route : [feature.route]

    // Check if current route matches any of the feature's routes
    return routes.some((featureRoute) => {
      return featureRoute === route || route.startsWith(featureRoute)
    })
  })
}

/**
 * Get a feature highlight by ID
 */
export const getFeatureById = (id: string): FeatureHighlight | undefined => {
  return featureHighlights.find((feature) => feature.id === id)
}

/**
 * Get unseen features for a route based on seen features list and spotlight settings
 * @param route - The current route
 * @param seenFeatureIds - Array of feature IDs the user has already seen
 * @param spotlightsEnabled - Whether feature spotlights are enabled
 * @returns Array of unseen features for the route, sorted by priority
 */
export const getUnseenFeaturesForRoute = (
  route: string,
  seenFeatureIds: string[],
  spotlightsEnabled: boolean
): FeatureHighlight[] => {
  if (!spotlightsEnabled) return []

  const routeFeatures = getFeaturesForRoute(route)
  return routeFeatures
    .filter((feature) => !seenFeatureIds.includes(feature.id))
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
}
