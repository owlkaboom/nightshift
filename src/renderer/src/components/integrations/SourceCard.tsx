/**
 * SourceCard component - Displays an integration source (board, filter, repo, etc.)
 */

import { useState } from 'react'
import type { IntegrationSource } from '@shared/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, ExternalLink, MoreVertical, XCircle } from 'lucide-react'

interface SourceCardProps {
  source: IntegrationSource
  onBrowse?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

/**
 * Card component for displaying an integration source
 * Shows source details and provides actions to browse issues or manage the source
 */
export function SourceCard({ source, onBrowse, onEdit, onDelete }: SourceCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!onDelete) return
    setIsDeleting(true)
    try {
      await onDelete()
    } finally {
      setIsDeleting(false)
    }
  }

  /**
   * Get a human-readable description of the source type
   */
  const getSourceDescription = (): string => {
    const config = source.config

    if (config.type === 'github') {
      return `${config.owner}/${config.repo}`
    }

    // Jira sources
    switch (config.sourceType) {
      case 'board':
        return config.boardName ? `Board: ${config.boardName}` : `Board ID: ${config.boardId}`
      case 'sprint':
        return `Sprint (${config.sprintState}) - Board ${config.boardId}`
      case 'backlog':
        return `Backlog - Board ${config.boardId}`
      case 'filter':
        return config.filterName ? `Filter: ${config.filterName}` : `Filter ID: ${config.filterId}`
      case 'jql':
        return `JQL: ${config.jql.substring(0, 50)}${config.jql.length > 50 ? '...' : ''}`
      case 'project':
        return `Project: ${config.projectKey}`
      default:
        return 'Unknown source type'
    }
  }

  /**
   * Get badge variant and label for source type
   */
  const getSourceTypeBadge = () => {
    const config = source.config

    if (config.type === 'github') {
      return {
        label: 'Repository',
        className: 'bg-purple-500/10 text-purple-500 border-purple-500/20'
      }
    }

    // Jira source types
    const badgeMap = {
      board: { label: 'Board', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      sprint: { label: 'Sprint', className: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
      backlog: { label: 'Backlog', className: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
      filter: { label: 'Filter', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
      jql: { label: 'JQL', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
      project: { label: 'Project', className: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' }
    }

    const badge = badgeMap[config.sourceType] || {
      label: 'Unknown',
      className: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    }

    return badge
  }

  const badge = getSourceTypeBadge()

  return (
    <Card className="transition-colors hover:bg-accent/50">
      <CardHeader className="py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-sm truncate">{source.name}</CardTitle>
              <Badge variant="outline" className={badge.className}>
                {badge.label}
              </Badge>
              {source.enabled ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              )}
            </div>
            <CardDescription className="text-xs truncate">
              {getSourceDescription()}
            </CardDescription>
          </div>

          <div className="flex items-center gap-1">
            {/* Browse button */}
            {onBrowse && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={onBrowse}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Actions menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onBrowse && (
                  <DropdownMenuItem onClick={onBrowse}>Browse Issues</DropdownMenuItem>
                )}
                {onEdit && <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="text-destructive focus:text-destructive"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}
