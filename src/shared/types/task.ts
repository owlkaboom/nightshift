/**
 * Task-related types for Nightshift
 */

/**
 * Task Status Lifecycle:
 * backlog → queued → awaiting_agent → running → needs_review (success) or failed
 *                                   ↘ paused (manual or rate-limited)
 *                                   ↘ cancelled (user aborted)
 *
 * backlog: Task is shelved/deferred, not in the active queue
 *
 * awaiting_agent: Task has been picked up and is waiting for the agent process
 *                 to spawn. This prevents race conditions in auto-play where
 *                 multiple cycles could pick up the same task before the agent
 *                 process is fully started.
 *
 * From needs_review:
 *   → completed (terminal - user approved the work)
 *   → rejected (terminal - user rejected the work)
 *   → queued (re-prompt - start new iteration)
 */
export type TaskStatus =
  | 'backlog'
  | 'queued'
  | 'awaiting_agent'
  | 'running'
  | 'paused'
  | 'cancelled'
  | 'needs_review'
  | 'rejected'
  | 'completed'
  | 'failed'

/**
 * Record of a single task iteration/run
 */
export interface TaskIteration {
  /** Iteration number (1-indexed) */
  iteration: number

  /** Prompt used for this iteration */
  prompt: string

  /** When this iteration started */
  startedAt: string

  /** When this iteration completed */
  completedAt: string | null

  /** Exit code for this iteration */
  exitCode: number | null

  /** Runtime in milliseconds for this iteration */
  runtimeMs: number

  /** Error message if this iteration failed */
  errorMessage: string | null

  /** Status this iteration ended with */
  finalStatus: 'needs_review' | 'failed' | 'cancelled'

  /** Whether this iteration completed in plan mode (ExitPlanMode was used) */
  isPlanMode?: boolean

  /** Path to the plan file (if plan mode) - e.g., ~/.claude/plans/xyz.md */
  planFilePath?: string | null
}

/**
 * Source of task creation
 */
export type TaskSource = 'manual' | 'jira' | 'github' | 'gitlab' | 'template'

/**
 * Task manifest stored in ~/.nightshift/tasks/<project-id>/<task-id>/manifest.json
 */
export interface TaskManifest {
  /** Unique task identifier (e.g., task_abc123) */
  id: string

  /** Prompt/instructions for the AI agent */
  prompt: string

  /** Project this task belongs to */
  projectId: string

  /** Optional group association (deprecated - use tagIds) */
  groupId: string | null

  /** Tag associations */
  tagIds: string[]

  /** Current task status */
  status: TaskStatus

  /** Position in the task queue (lower = earlier) */
  queuePosition: number

  /** How this task was created */
  source: TaskSource

  /** Reference to external source (e.g., Jira issue key) */
  sourceRef: string | null

  /** External issue ID (e.g., "PROJ-123" or "GH-456") */
  externalIssueId: string | null

  /** Link to original issue */
  externalIssueUrl: string | null

  /** Which integration this came from */
  integrationId: string | null

  /** Additional context files to include */
  contextFiles: string[]

  /** Whether to include project's CLAUDE.md */
  includeClaudeMd: boolean

  /** Skills to enable for this task (future) */
  enabledSkills: string[]

  /** Agent ID to use for this task (if not set, uses global default) */
  agentId: string | null

  /** Model to use for this task (agent-specific, if not set, uses agent default) */
  model: string | null

  /** Whether to use thinking/extended thinking mode for this task (null = use global default) */
  thinkingMode: boolean | null

  /** When the task was created */
  createdAt: string

  /** When the task started running */
  startedAt: string | null

  /** When the task completed/failed */
  completedAt: string | null

  /** Agent process exit code */
  exitCode: number | null

  /** Error message if task failed */
  errorMessage: string | null

  /** Estimated cost (if available from agent) */
  costEstimate: number | null

  /** Accumulated runtime in milliseconds (survives pause/resume) */
  runtimeMs: number

  /** Timestamp when current running session started (for calculating live runtime) */
  runningSessionStartedAt: string | null

  /** Current iteration number (1-indexed, starts at 1) */
  currentIteration: number

  /** History of all completed iterations */
  iterations: TaskIteration[]

  /** Whether the current iteration completed in plan mode */
  isPlanMode?: boolean

  /** Path to the plan file for current iteration (if plan mode) */
  planFilePath?: string | null

  /** Whether the agent indicated additional work is needed (incomplete work detection) */
  needsContinuation?: boolean

  /** Reason why continuation is needed */
  continuationReason?: 'multi-phase' | 'todo-items' | 'continuation-signal' | 'approval-needed' | 'token-limit'

  /** Details about what work remains */
  continuationDetails?: string

  /** Suggested next steps from the agent */
  suggestedNextSteps?: string[]
}

/**
 * Minimal task data for list views
 */
export interface TaskSummary {
  id: string
  prompt: string
  projectId: string
  status: TaskStatus
  queuePosition: number
  createdAt: string
}

/**
 * Create a new task with default values
 */
export function createTaskManifest(
  id: string,
  prompt: string,
  projectId: string,
  options: Partial<TaskManifest> = {}
): TaskManifest {
  return {
    id,
    prompt,
    projectId,
    groupId: null,
    tagIds: [],
    status: 'queued',
    queuePosition: Date.now(), // Use timestamp for default ordering
    source: 'manual',
    sourceRef: null,
    externalIssueId: null,
    externalIssueUrl: null,
    integrationId: null,
    contextFiles: [],
    includeClaudeMd: true,
    enabledSkills: [],
    agentId: null,
    model: null,
    thinkingMode: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    exitCode: null,
    errorMessage: null,
    costEstimate: null,
    runtimeMs: 0,
    runningSessionStartedAt: null,
    currentIteration: 1,
    iterations: [],
    isPlanMode: false,
    planFilePath: null,
    ...options
  }
}
