import { createFileRoute } from '@tanstack/react-router'
import { ShortcutsView } from '@/views'

export const Route = createFileRoute('/shortcuts')({
  component: ShortcutsView
})
