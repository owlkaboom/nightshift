import { createFileRoute } from '@tanstack/react-router'
import { PlanningView } from '@/views'

// Define search params schema for planning route
type PlanningSearch = {
  sessionId?: string
  projectId?: string
  sessionType?: 'general' | 'init' | 'claude-md'
  initialPrompt?: string
}

export const Route = createFileRoute('/planning')({
  component: PlanningView,
  validateSearch: (search: Record<string, unknown>): PlanningSearch => ({
    sessionId: search.sessionId as string | undefined,
    projectId: search.projectId as string | undefined,
    sessionType: search.sessionType as 'general' | 'init' | 'claude-md' | undefined,
    initialPrompt: search.initialPrompt as string | undefined
  })
})
