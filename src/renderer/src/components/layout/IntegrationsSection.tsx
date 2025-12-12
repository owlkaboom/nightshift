/**
 * IntegrationsSection - Sidebar section showing connections with nested sources
 */

import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useIntegrationStore } from '@/stores/integration-store'
import { cn } from '@/lib/utils'
import { Plug, ChevronRight, ChevronDown, Github, Settings } from 'lucide-react'

interface IntegrationsSectionProps {
  collapsed: boolean
}

/**
 * Displays connections as expandable headers with nested sources
 */
export function IntegrationsSection({ collapsed }: IntegrationsSectionProps) {
  const navigate = useNavigate()
  const { connections, sources, fetchConnections, fetchSources } = useIntegrationStore()

  // Track which connections are expanded
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchConnections()
    fetchSources()
  }, [fetchConnections, fetchSources])

  const activeConnections = connections.filter((c) => c.enabled)
  const hasActiveConnections = activeConnections.length > 0

  const toggleConnection = (connectionId: string) => {
    setExpandedConnections((prev) => {
      const next = new Set(prev)
      if (next.has(connectionId)) {
        next.delete(connectionId)
      } else {
        next.add(connectionId)
      }
      return next
    })
  }

  const handleSourceClick = (sourceId: string) => {
    // Navigate to source view (browse issues)
    navigate({ to: '/integrations/$integrationId', params: { integrationId: sourceId } })
  }

  const handleSetupClick = () => {
    // Navigate to settings integrations section
    navigate({ to: '/settings', search: { section: 'integrations' } })
  }

  if (collapsed) {
    return (
      <div className="border-t">
        <button
          onClick={handleSetupClick}
          className={cn(
            'flex w-full items-center justify-center p-4 transition-colors',
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
          title={hasActiveConnections ? 'Integrations' : 'Set up integrations'}
        >
          <Plug className="h-5 w-5 shrink-0" />
        </button>
      </div>
    )
  }

  return (
    <div className="border-t">
      <div className="p-2">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Integrations
          </span>
          <button
            onClick={handleSetupClick}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Manage integrations"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>

        {hasActiveConnections ? (
          <div className="space-y-1">
            {activeConnections.map((connection) => {
              const connectionSources = sources.filter(
                (s) => s.connectionId === connection.id && s.enabled
              )
              const isExpanded = expandedConnections.has(connection.id)
              const Icon = connection.type === 'github' ? Github : Plug
              const ExpandIcon = isExpanded ? ChevronDown : ChevronRight

              return (
                <div key={connection.id}>
                  {/* Connection header (expandable) */}
                  <button
                    onClick={() => toggleConnection(connection.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                      'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      isExpanded && 'bg-accent/50'
                    )}
                  >
                    <ExpandIcon className="h-3.5 w-3.5 shrink-0" />
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left truncate">{connection.name}</span>
                    {connectionSources.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {connectionSources.length}
                      </span>
                    )}
                  </button>

                  {/* Nested sources */}
                  {isExpanded && connectionSources.length > 0 && (
                    <div className="ml-6 mt-1 space-y-1 border-l-2 border-border pl-2">
                      {connectionSources.map((source) => (
                        <button
                          key={source.id}
                          onClick={() => handleSourceClick(source.id)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                            'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          )}
                        >
                          <span className="flex-1 text-left truncate">{source.name}</span>
                          <ChevronRight className="h-3 w-3 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <button
            onClick={handleSetupClick}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
              'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Plug className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Set up integrations</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          </button>
        )}
      </div>
    </div>
  )
}
