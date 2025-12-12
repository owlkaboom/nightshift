import { createFileRoute } from '@tanstack/react-router'
import { TagsView } from '@/views'

export const Route = createFileRoute('/tags')({
  component: TagsView
})
