import { createFileRoute } from '@tanstack/react-router'
import { IntegrationView } from '@/views/IntegrationView'

export const Route = createFileRoute('/integrations/$integrationId')({
  component: IntegrationView
})
