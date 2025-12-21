import { createFileRoute } from '@tanstack/react-router'
import { ProjectDetailView } from '@/views/ProjectDetailView'

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectDetailView
})
