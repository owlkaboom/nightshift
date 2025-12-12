import { createFileRoute } from '@tanstack/react-router'
import { SettingsView } from '@/views'

export const Route = createFileRoute('/settings')({
  component: SettingsView,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      section: (search.section as string) || undefined
    }
  }
})
