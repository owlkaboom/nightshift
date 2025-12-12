import { createFileRoute } from '@tanstack/react-router'
import { ProcessesView } from '@/views'

export const Route = createFileRoute('/processes')({
  component: ProcessesView
})
