import { createFileRoute } from '@tanstack/react-router'
import { NotesView } from '@/views'

export const Route = createFileRoute('/notes')({
  component: NotesView
})
