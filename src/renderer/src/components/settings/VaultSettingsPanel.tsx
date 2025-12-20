/**
 * VaultSettingsPanel Component
 *
 * Panel for configuring the note vault location
 */

import { useState } from 'react'
import { FolderOpen, AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useConfigStore } from '@/stores'

export function VaultSettingsPanel() {
  const { config, updateConfig } = useConfigStore()
  const [isChanging, setIsChanging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const currentVaultPath = config?.vaultPath

  const handleSelectDirectory = async () => {
    setIsChanging(true)
    setError(null)
    setSaved(false)

    try {
      const path = await window.api.selectDirectory()
      if (path) {
        await updateConfig({ vaultPath: path })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to configure vault')
      console.error('Failed to configure vault:', err)
    } finally {
      setIsChanging(false)
    }
  }

  const handleOpenVault = async () => {
    if (currentVaultPath) {
      await window.api.openPath(currentVaultPath)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Note Vault
        </CardTitle>
        <CardDescription>Configure where your notes are stored</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Vault Display */}
        {currentVaultPath ? (
          <div className="space-y-3">
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium mb-1">Current vault location:</p>
              <p className="text-xs text-muted-foreground font-mono break-all">
                {currentVaultPath}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenVault}
                className="flex-1"
              >
                Open in Finder
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectDirectory}
                disabled={isChanging}
                className="flex-1"
              >
                {isChanging ? 'Changing...' : 'Change Location'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
              <p className="font-medium mb-1">No vault configured</p>
              <p className="text-xs">
                You need to configure a vault location before you can create notes.
              </p>
            </div>

            <Button
              variant="default"
              onClick={handleSelectDirectory}
              disabled={isChanging}
              className="w-full"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              {isChanging ? 'Configuring...' : 'Configure Vault Location'}
            </Button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Success Message */}
        {saved && (
          <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
            <Check className="h-4 w-4" />
            <p>Vault location updated successfully</p>
          </div>
        )}

        {/* Info Box */}
        <div className="rounded-md bg-blue-500/10 p-3 text-sm text-blue-600 dark:text-blue-400">
          <p className="font-medium mb-1">About Note Vaults</p>
          <ul className="space-y-1 text-xs">
            <li>• Notes are stored as markdown files with YAML frontmatter</li>
            <li>• Compatible with Obsidian and other markdown editors</li>
            <li>• You can organize notes in folders</li>
            <li>• All metadata is stored in the frontmatter</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
