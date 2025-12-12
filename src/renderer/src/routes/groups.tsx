import { createFileRoute } from '@tanstack/react-router'
import { GroupsView } from '@/views'

export const Route = createFileRoute('/groups')({
  component: GroupsView
})
