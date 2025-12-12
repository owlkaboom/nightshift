/**
 * Shared constants for Nightshift
 */

/**
 * Application name
 */
export const APP_NAME = 'Nightshift'

/**
 * Application directory name (in user home)
 */
export const APP_DIR_NAME = '.nightshift'

/**
 * File names within ~/.nightshift/
 */
export const FILES = {
  CONFIG: 'config.json',
  LOCAL_STATE: 'local-state.json',
  PROJECTS: 'sync/projects.json',
  GROUPS: 'sync/groups.json',
  TEMPLATES: 'sync/templates.json',
  SKILLS: 'sync/skills.json'
} as const

/**
 * Directory names within ~/.nightshift/
 */
export const DIRS = {
  SYNC: 'sync',
  TASKS: 'tasks',
  SESSIONS: 'sessions',
  MEMORY: 'memory',
  PLANNING: 'planning',
  DOCS: 'docs',
  LOGS: 'logs',
  SOUNDS: 'sounds'
} as const

/**
 * Task status display info
 */
export const TASK_STATUS_INFO = {
  queued: {
    label: 'Queued',
    color: 'bg-slate-500',
    kanbanColumn: 'backlog'
  },
  running: {
    label: 'Running',
    color: 'bg-blue-500',
    kanbanColumn: 'in-progress'
  },
  paused: {
    label: 'Paused',
    color: 'bg-yellow-500',
    kanbanColumn: 'in-progress'
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-slate-400',
    kanbanColumn: 'done'
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-500',
    kanbanColumn: 'done'
  },
  failed: {
    label: 'Failed',
    color: 'bg-red-500',
    kanbanColumn: 'done'
  }
} as const

/**
 * Kanban column definitions
 */
export const KANBAN_COLUMNS = [
  {
    id: 'backlog',
    title: 'Backlog',
    statuses: ['queued']
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    statuses: ['running', 'paused']
  },
  {
    id: 'done',
    title: 'Done',
    statuses: ['completed', 'failed', 'cancelled']
  }
] as const

/**
 * Priority display info
 */
export const PRIORITY_INFO = {
  low: {
    label: 'Low',
    color: 'text-slate-500',
    sortOrder: 3
  },
  medium: {
    label: 'Medium',
    color: 'text-yellow-500',
    sortOrder: 2
  },
  high: {
    label: 'High',
    color: 'text-red-500',
    sortOrder: 1
  }
} as const

/**
 * IPC channel prefixes
 */
export const IPC_CHANNELS = {
  PROJECTS: 'projects',
  TASKS: 'tasks',
  GROUPS: 'groups',
  CONFIG: 'config',
  SCANNER: 'scanner',
  EXECUTION: 'execution',
  REVIEW: 'review'
} as const

/**
 * Rate limit detection patterns (Claude Code specific)
 * AGENT-SPECIFIC: These patterns are for Claude Code
 */
export const RATE_LIMIT_PATTERNS = [
  /rate.?limit/i,
  /429/,
  /too many requests/i,
  /quota exceeded/i
]

/**
 * Generate a unique ID with prefix
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 7)
  return `${prefix}_${timestamp}${random}`
}

/**
 * Generate a task ID
 */
export function generateTaskId(): string {
  return generateId('task')
}

/**
 * Generate a session ID
 */
export function generateSessionId(): string {
  return generateId('sess')
}
