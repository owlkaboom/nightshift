/**
 * ConnectionCard component - Displays an integration connection with its sources
 */

import { useState } from 'react'
import type { IntegrationConnection } from '@shared/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
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
import { CheckCircle2, ChevronDown, ChevronRight, MoreVertical, XCircle } from 'lucide-react'
import { useIntegrationStore } from '@/stores/integration-store'

interface ConnectionCardProps {
  connection: IntegrationConnection
  isExpanded?: boolean
  onToggleExpand?: () => void
  onEdit?: () => void
  onTest?: () => void
  onDelete?: () => void
  children?: React.ReactNode
}

/**
 * Card component for displaying an integration connection
 * Shows connection details and can be expanded to show nested sources
 */
export function ConnectionCard({
  connection,
  isExpanded = false,
  onToggleExpand,
  onEdit,
  onTest,
  onDelete,
  children
}: ConnectionCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const { testingConnection } = useIntegrationStore()

  const isTesting = testingConnection === connection.id

  const handleDelete = async () => {
    if (!onDelete) return
    setIsDeleting(true)
    try {
      await onDelete()
    } finally {
      setIsDeleting(false)
    }
  }

  const getConnectionTypeBadge = () => {
    const colors = {
      jira: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      github: 'bg-purple-500/10 text-purple-500 border-purple-500/20'
    }
    return (
      <Badge variant="outline" className={colors[connection.type]}>
        {connection.type.toUpperCase()}
      </Badge>
    )
  }

  const getConnectionUrl = () => {
    if (connection.config.type === 'jira') {
      return connection.config.baseUrl
    }
    return 'github.com'
  }

  return (
    <Card className="transition-colors hover:bg-accent/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Expand/collapse button */}
            {onToggleExpand && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 mt-0.5"
                onClick={onToggleExpand}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-base truncate">{connection.name}</CardTitle>
                {getConnectionTypeBadge()}
                {connection.enabled ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
                )}
              </div>
              <CardDescription className="text-xs truncate">
                {getConnectionUrl()}
              </CardDescription>
            </div>
          </div>

          {/* Actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onTest && (
                <DropdownMenuItem onClick={onTest} disabled={isTesting}>
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </DropdownMenuItem>
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
      </CardHeader>

      {/* Nested sources (rendered when expanded) */}
      {isExpanded && children && (
        <CardContent className="pt-0">
          <div className="space-y-2 pl-6 border-l-2 border-border ml-3">{children}</div>
        </CardContent>
      )}
    </Card>
  )
}
