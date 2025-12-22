/**
 * Project Memory Card
 *
 * Displays memory statistics and allows managing project memory
 * for token optimization.
 */

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Brain, Trash2, RefreshCw, Database, Clock, FileText } from 'lucide-react'
import type { MemoryStats } from '@shared/ipc-types'
import { logger } from '@/lib/logger'

interface ProjectMemoryCardProps {
  projectId: string
  projectName: string
}

export function ProjectMemoryCard({ projectId, projectName }: ProjectMemoryCardProps) {
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [compacting, setCompacting] = useState(false)

  const fetchStats = async () => {
    try {
      const hasMemory = await window.api.hasProjectMemory(projectId)
      if (hasMemory) {
        const memStats = await window.api.getMemoryStats(projectId)
        setStats(memStats)
      } else {
        setStats(null)
      }
    } catch (err) {
      console.error('Failed to fetch memory stats:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [projectId])

  const handleClear = async () => {
    if (!confirm(`Clear all memory for ${projectName}? This will reset learned context.`)) {
      return
    }
    setClearing(true)
    try {
      await window.api.clearProjectMemory(projectId)
      setStats(null)
    } catch (err) {
      console.error('Failed to clear memory:', err)
    } finally {
      setClearing(false)
    }
  }

  const handleCompact = async () => {
    setCompacting(true)
    try {
      const removed = await window.api.compactMemory(projectId)
      await fetchStats()
      if (removed > 0) {
        // Show a brief notification
        logger.debug(`Compacted memory: removed ${removed} stale entries`)
      }
    } catch (err) {
      console.error('Failed to compact memory:', err)
    } finally {
      setCompacting(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Project Memory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Project Memory
        </CardTitle>
        <CardDescription>
          Cached knowledge to reduce token consumption
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Database className="h-4 w-4" />
                  Knowledge Entries
                </div>
                <div className="text-2xl font-bold">{stats.entryCount}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Recent Tasks
                </div>
                <div className="text-2xl font-bold">{stats.recentTaskCount}</div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Codebase structure cached</span>
                <span className={stats.hasStructure ? 'text-green-500' : 'text-muted-foreground'}>
                  {stats.hasStructure ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Session resumption available</span>
                <span className={stats.hasSessionId ? 'text-green-500' : 'text-muted-foreground'}>
                  {stats.hasSessionId ? 'Yes' : 'No'}
                </span>
              </div>
              {stats.lastUsedAt && (
                <div className="flex items-center gap-2 text-muted-foreground mt-2">
                  <Clock className="h-4 w-4" />
                  Last used: {new Date(stats.lastUsedAt).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCompact}
                disabled={compacting}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${compacting ? 'animate-spin' : ''}`} />
                Compact
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={clearing}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            No memory stored yet. Memory will be built as tasks are completed.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
