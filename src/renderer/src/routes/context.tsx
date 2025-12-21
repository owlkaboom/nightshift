import { createFileRoute } from '@tanstack/react-router'
import { ProjectContextView } from '@/views/ProjectContextView'

export const Route = createFileRoute('/context')({
  component: ProjectContextView
})
