import { createFileRoute } from '@tanstack/react-router'
import { PlanningView } from '@/views'

export const Route = createFileRoute('/planning')({
  component: PlanningView
})
