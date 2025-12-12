import { createFileRoute } from '@tanstack/react-router'
import { ProjectsView } from '@/views'

export const Route = createFileRoute('/projects')({
  component: ProjectsView
})
