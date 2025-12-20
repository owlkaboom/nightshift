/**
 * Integrations Panel component for the settings view
 *
 * Allows users to:
 * - Add new GitHub/JIRA integrations
 * - Manage existing integrations
 * - Test integration connections
 * - Enable/disable integrations
 */

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useIntegrationStore } from '@/stores/integration-store'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Loader2, Plus, Github, Settings, Trash2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SetupIntegrationDialog } from './SetupIntegrationDialog'

export function IntegrationsPanel() {
  const {
    connections,
    loading,
    error,
    testingConnection,
    fetchConnections,
    fetchSources,
    deleteConnection,
    updateConnection,
    testConnection,
    getSourcesForConnection,
    clearError
  } = useIntegrationStore()

  const [setupDialogOpen, setSetupDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [connectionToDelete, setConnectionToDelete] = useState<{ id: string; name: string } | null>(null)
  const [testResults, setTestResults] = useState<Map<string, { success: boolean; message?: string }>>(new Map())

  useEffect(() => {
    fetchConnections()
    fetchSources()
  }, [fetchConnections, fetchSources])

  const handleDeleteClick = (connectionId: string, connectionName: string) => {
    setConnectionToDelete({ id: connectionId, name: connectionName })
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!connectionToDelete) return

    try {
      await deleteConnection(connectionToDelete.id)
      setDeleteDialogOpen(false)
      setConnectionToDelete(null)
    } catch (err) {
      // Error is handled by store
    }
  }

  const handleToggleEnabled = async (connectionId: string, currentEnabled: boolean) => {
    await updateConnection(connectionId, {
      enabled: !currentEnabled
    })
  }

  const handleTestConnection = async (connectionId: string) => {
    try {
      const result = await testConnection(connectionId)
      setTestResults(new Map(testResults).set(connectionId, {
        success: result.success,
        message: result.error || result.details
      }))

      // Clear test result after 5 seconds
      setTimeout(() => {
        setTestResults((prev) => {
          const newMap = new Map(prev)
          newMap.delete(connectionId)
          return newMap
        })
      }, 5000)
    } catch (err) {
      // Error is handled by store
    }
  }

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'github':
        return <Github className="h-5 w-5" />
      case 'jira':
        return <Settings className="h-5 w-5" />
      default:
        return <Settings className="h-5 w-5" />
    }
  }

  const getConnectionDisplayName = (connectionId: string, _connectionType: string) => {
    const connectionSources = getSourcesForConnection(connectionId)
    if (connectionSources.length > 0) {
      return `${connectionSources.length} source${connectionSources.length > 1 ? 's' : ''}`
    }
    return 'No sources configured'
  }

  if (loading && connections.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4" data-feature="integrations-panel">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Integrations</h3>
          <p className="text-sm text-muted-foreground">
            Connect to GitHub and JIRA to import issues as tasks
          </p>
        </div>
        <Button onClick={() => setSetupDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Integration
        </Button>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">{error}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Settings className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-semibold">No integrations configured</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Connect to GitHub or JIRA to start importing issues
            </p>
            <Button onClick={() => setSetupDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Integration
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {connections.map((connection) => {
            const testResult = testResults.get(connection.id)
            const isTesting = testingConnection === connection.id

            return (
              <Card key={connection.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {getIntegrationIcon(connection.type)}
                      <div>
                        <CardTitle className="text-base">{connection.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {getConnectionDisplayName(connection.id, connection.type)}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={connection.enabled ? 'default' : 'secondary'}>
                        {connection.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {connection.type}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between pb-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection(connection.id)}
                      disabled={isTesting || !connection.enabled}
                    >
                      {isTesting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Test Connection
                    </Button>
                    {testResult && (
                      <div className={cn(
                        "flex items-center gap-1 text-sm",
                        testResult.success ? "text-green-600" : "text-destructive"
                      )}>
                        {testResult.success ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        <span>{testResult.message || (testResult.success ? 'Connected' : 'Failed')}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleEnabled(connection.id, connection.enabled)}
                    >
                      {connection.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClick(connection.id, connection.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Setup Integration Dialog */}
      <SetupIntegrationDialog
        open={setupDialogOpen}
        onOpenChange={setSetupDialogOpen}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Connection</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{connectionToDelete?.name}"? This will also delete all sources associated with this connection. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
