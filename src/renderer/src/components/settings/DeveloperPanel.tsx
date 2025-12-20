import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Bug, FolderOpen } from 'lucide-react'

export function DeveloperPanel() {
  const [debugLogging, setDebugLogging] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.getDebugLogging().then((enabled) => {
      setDebugLogging(enabled)
      setLoading(false)
    })
  }, [])

  const handleDebugLoggingChange = async (enabled: boolean) => {
    setDebugLogging(enabled)
    await window.api.setDebugLogging(enabled)
  }

  const handleOpenLogsFolder = async () => {
    await window.api.openLogsFolder()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Developer Options
        </CardTitle>
        <CardDescription>
          Advanced settings for troubleshooting and debugging
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="debug-logging" className="text-base">
              Debug Logging
            </Label>
            <p className="text-sm text-muted-foreground">
              Enable verbose logging for troubleshooting issues
            </p>
          </div>
          <Switch
            id="debug-logging"
            checked={debugLogging}
            onCheckedChange={handleDebugLoggingChange}
            disabled={loading}
          />
        </div>

        <div className="pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenLogsFolder}
            className="gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            Open Logs Folder
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Logs are stored in ~/.nightshift/logs/ and automatically rotate when they reach 10MB
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
