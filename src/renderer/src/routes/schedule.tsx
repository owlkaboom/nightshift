import { createFileRoute } from '@tanstack/react-router'
import { ScheduleView } from '@/views'

export const Route = createFileRoute('/schedule')({
  component: ScheduleView
})
