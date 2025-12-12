/**
 * PlanningSessionList - List of planning sessions
 */

import { useMemo } from 'react'
import { Plus, MessageSquare, Trash2, CheckCircle2, ArrowRight, FolderTree } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PlanningSession, Project } from '@shared/types'

interface PlanningSessionListProps {
  /** All planning sessions */
  sessions: PlanningSession[]

  /** Currently selected session ID */
  currentSessionId: string | null

  /** Called when user selects a session */
  onSelectSession: (sessionId: string) => void

  /** Called when user deletes a session */
  onDeleteSession: (sessionId: string) => void

  /** Called when user creates a new session */
  onNewSession: () => void

  /** All projects (for showing project names) */
  projects: Project[]
}

export function PlanningSessionList({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession,
  projects
}: PlanningSessionListProps) {
  // Build project name lookup
  const projectNames = useMemo(() => {
    const map: Record<string, string> = {}
    projects.forEach((p) => {
      map[p.id] = p.name
    })
    return map
  }, [projects])

  // Format relative time
  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Get status badge
  const getStatusBadge = (status: PlanningSession['status']) => {
    switch (status) {
      case 'converted':
        return (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            Converted
          </span>
        )
      case 'converting':
        return (
          <span className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
            <ArrowRight className="h-3 w-3" />
            Converting
          </span>
        )
      default:
        return null
    }
  }

  // Get session type badge
  const getSessionTypeBadge = (session: PlanningSession) => {
    if (session.sessionType === 'init') {
      return (
        <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
          <FolderTree className="h-3 w-3" />
          Init
        </span>
      )
    }
    return null
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Sessions</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewSession}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No sessions yet</p>
            <Button variant="link" size="sm" onClick={onNewSession}>
              Start planning
            </Button>
          </div>
        ) : (
          <ul className="p-2 space-y-2">
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  onClick={() => onSelectSession(session.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg transition-all',
                    'border bg-card shadow-sm',
                    'hover:bg-secondary hover:shadow-md group',
                    currentSessionId === session.id &&
                      'bg-secondary border-primary/50 ring-1 ring-primary/20 shadow-md'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{session.title}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {projectNames[session.projectId] || 'Unknown Project'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteSession(session.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatTime(session.updatedAt)}
                    </span>
                    <div className="flex items-center gap-1">
                      {getSessionTypeBadge(session)}
                      {getStatusBadge(session.status)}
                    </div>
                  </div>
                  {session.messages.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {session.messages.length} message{session.messages.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
