import { createFileRoute } from '@tanstack/react-router'
import { SkillsView } from '@/views'

export const Route = createFileRoute('/skills')({
  component: SkillsView
})
