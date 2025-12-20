/**
 * Integration Badge Component
 *
 * Displays the integration source (GitHub/JIRA) on task cards
 */

import { Badge } from '@/components/ui/badge'
import { Github, ExternalLink } from 'lucide-react'
import type { TaskManifest } from '@shared/types'
import { cn } from '@/lib/utils'

interface IntegrationBadgeProps {
  task: TaskManifest
  className?: string
  showLink?: boolean
}

// Icon component for JIRA
function JiraIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0z" />
    </svg>
  )
}

export function IntegrationBadge({ task, className, showLink = false }: IntegrationBadgeProps) {
  // Check if task has integration data
  const integrationSource = task.source !== 'manual' ? task.source : undefined
  const externalIssueId = task.externalIssueId
  const externalIssueUrl = task.externalIssueUrl

  if (!integrationSource || !externalIssueId) {
    return null
  }

  const getIcon = () => {
    switch (integrationSource) {
      case 'github':
        return <Github className="h-3 w-3" />
      case 'jira':
        return <JiraIcon className="h-3 w-3" />
      default:
        return null
    }
  }

  const getLabel = () => {
    return externalIssueId
  }

  const getVariant = () => {
    switch (integrationSource) {
      case 'github':
        return 'secondary'
      case 'jira':
        return 'outline'
      default:
        return 'outline'
    }
  }

  if (showLink && externalIssueUrl) {
    return (
      <a
        href={externalIssueUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("inline-block", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <Badge variant={getVariant()} className="gap-1 cursor-pointer hover:bg-accent">
          {getIcon()}
          <span>{getLabel()}</span>
          <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
        </Badge>
      </a>
    )
  }

  return (
    <Badge variant={getVariant()} className={cn("gap-1", className)}>
      {getIcon()}
      <span>{getLabel()}</span>
    </Badge>
  )
}
