import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearch } from '@tanstack/react-router'
import { useConfigStore } from '@/stores'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AboutPanel, AgentConfigPanel, VaultSettingsPanel, IntegrationsPanel } from '@/components/settings'
import { useWalkthrough } from '@/components/walkthrough'
import { useWalkthroughStore } from '@/stores/walkthrough-store'
import { Loader2, Check, Monitor, Sun, Moon, Palette, Bell, Volume2, Compass, Music, X, Upload, Play } from 'lucide-react'
import { themes } from '@shared/themes'
import { cn } from '@/lib/utils'
import type { DefaultNotificationSound } from '@shared/types/config'

export function SettingsView() {
  const search = useSearch({ from: '/settings' })
  const { config, loading, fetchConfig, updateConfig, setTheme } = useConfigStore()
  const { startWalkthrough } = useWalkthrough()
  const { resetWalkthrough, walkthroughCompleted, spotlightsEnabled, setSpotlightsEnabled } = useWalkthroughStore()
  const [maxTasks, setMaxTasks] = useState('3')
  const [maxDuration, setMaxDuration] = useState('15')
  const [retentionDays, setRetentionDays] = useState('30')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [notificationSound, setNotificationSound] = useState(true)
  const [defaultSound, setDefaultSound] = useState<DefaultNotificationSound>('Hero')
  const [customSoundPath, setCustomSoundPath] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const integrationsRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  // Scroll to section if specified in search params
  useEffect(() => {
    if (search.section === 'integrations' && integrationsRef.current) {
      // Small delay to ensure the DOM is fully rendered
      setTimeout(() => {
        integrationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [search.section])

  useEffect(() => {
    if (config) {
      setMaxTasks(String(config.maxConcurrentTasks))
      setMaxDuration(String(config.maxTaskDurationMinutes))
      setRetentionDays(String(config.archiveRetentionDays ?? 30))
      setNotificationsEnabled(config.notifications?.enabled ?? true)
      setNotificationSound(config.notifications?.sound ?? true)
      setDefaultSound(config.notifications?.defaultSound ?? 'Hero')
      setCustomSoundPath(config.notifications?.customSoundPath ?? null)
    }
  }, [config])

  // Debounced auto-save function
  const debouncedSave = useCallback(() => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Schedule new save after 500ms of no changes
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        await updateConfig({
          maxConcurrentTasks: parseInt(maxTasks, 10) || 3,
          maxTaskDurationMinutes: parseInt(maxDuration, 10) || 15,
          archiveRetentionDays: parseInt(retentionDays, 10) || 30,
          notifications: {
            enabled: notificationsEnabled,
            sound: notificationSound,
            defaultSound,
            customSoundPath
          }
        })
      } finally {
        setSaving(false)
      }
    }, 500)
  }, [maxTasks, maxDuration, retentionDays, notificationsEnabled, notificationSound, defaultSound, customSoundPath, updateConfig])

  // Auto-save when any setting changes
  useEffect(() => {
    // Don't auto-save on initial mount or when loading config
    if (!config || loading) return

    debouncedSave()

    // Cleanup on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [maxTasks, maxDuration, retentionDays, notificationsEnabled, notificationSound, defaultSound, customSoundPath, debouncedSave, config, loading])

  const handleSelectCustomSound = async () => {
    const path = await window.api.selectFile([
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'aiff', 'aif', 'ogg', 'm4a', 'flac'] }
    ])
    if (path) {
      try {
        // Copy the sound file to app directory
        const copiedPath = await window.api.copyNotificationSound(path)
        setCustomSoundPath(copiedPath)
        setDefaultSound('custom')
      } catch (error) {
        console.error('Failed to copy notification sound:', error)
        // Fall back to using original path
        setCustomSoundPath(path)
        setDefaultSound('custom')
      }
    }
  }

  const handleClearCustomSound = () => {
    setCustomSoundPath(null)
    setDefaultSound('Hero') // Reset to default
  }

  const handlePreviewSound = async (soundName: string) => {
    try {
      // If previewing custom sound, pass the custom path
      if (soundName === 'custom' && customSoundPath) {
        await window.api.previewNotificationSound('custom', customSoundPath)
      } else {
        await window.api.previewNotificationSound(soundName)
      }
    } catch (error) {
      console.error('Failed to preview sound:', error)
    }
  }

  const handleThemeChange = async (themeId: string) => {
    await setTheme(themeId)
  }

  const handleRestartTour = () => {
    resetWalkthrough()
    startWalkthrough()
  }

  const currentTheme = config?.theme || 'dark'

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Group themes by type
  const lightThemes = themes.filter((t) => !t.isDark)
  const darkThemes = themes.filter((t) => t.isDark)

  return (
    <div className="h-full p-6 overflow-auto">
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure Nightshift preferences</p>
        </div>

        <div className="space-y-6">
          {/* Agent Configuration */}
          <AgentConfigPanel />

          {/* Vault Configuration */}
          <VaultSettingsPanel />

          {/* Integrations */}
          <div ref={integrationsRef}>
            <IntegrationsPanel />
          </div>

          {/* Theme Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Theme
              </CardTitle>
              <CardDescription>Choose your preferred color theme</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* System Theme Option */}
              <div>
                <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  System
                </Label>
                <button
                  onClick={() => handleThemeChange('system')}
                  className={cn(
                    'w-full p-4 rounded-lg border-2 transition-all text-left',
                    currentTheme === 'system'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-20 rounded overflow-hidden border">
                      <div className="w-1/2 bg-white" />
                      <div className="w-1/2 bg-zinc-900" />
                    </div>
                    <div>
                      <p className="font-medium">System</p>
                      <p className="text-xs text-muted-foreground">
                        Automatically match your OS appearance
                      </p>
                    </div>
                    {currentTheme === 'system' && (
                      <Check className="h-5 w-5 text-primary ml-auto" />
                    )}
                  </div>
                </button>
              </div>

              {/* Light Themes */}
              <div>
                <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
                  <Sun className="h-4 w-4" />
                  Light Themes
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {lightThemes.map((theme) => (
                    <ThemeCard
                      key={theme.id}
                      theme={theme}
                      isSelected={currentTheme === theme.id}
                      onSelect={() => handleThemeChange(theme.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Dark Themes */}
              <div>
                <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
                  <Moon className="h-4 w-4" />
                  Dark Themes
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {darkThemes.map((theme) => (
                    <ThemeCard
                      key={theme.id}
                      theme={theme}
                      isSelected={currentTheme === theme.id}
                      onSelect={() => handleThemeChange(theme.id)}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Get notified when tasks complete and are ready for review
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notifications-enabled" className="text-base">
                    Desktop Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Show a notification when tasks complete
                  </p>
                </div>
                <Switch
                  id="notifications-enabled"
                  checked={notificationsEnabled}
                  onCheckedChange={setNotificationsEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notification-sound" className="text-base flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Sound Alert
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Play a sound when tasks are ready for review
                  </p>
                </div>
                <Switch
                  id="notification-sound"
                  checked={notificationSound}
                  onCheckedChange={setNotificationSound}
                  disabled={!notificationsEnabled}
                />
              </div>

              {/* Sound Selection */}
              {notificationSound && notificationsEnabled && (
                <div className="space-y-3 border-l-2 border-muted pl-4 ml-2">
                  <div className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Notification Sound</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Choose from default sounds or upload your own
                  </p>

                  {/* Default Sounds Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {(['Hero', 'Glass', 'Ping', 'Pop', 'Purr', 'Submarine', 'Tink'] as const).map((sound) => (
                      <div
                        key={sound}
                        className={cn(
                          'flex items-center gap-1 rounded-md transition-all',
                          defaultSound === sound
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        )}
                      >
                        <button
                          onClick={() => setDefaultSound(sound)}
                          className={cn(
                            'flex-1 px-3 py-2 text-sm font-medium text-left rounded-l-md transition-all',
                            defaultSound === sound
                              ? 'hover:bg-primary/90'
                              : 'hover:bg-muted/80'
                          )}
                        >
                          {sound}
                        </button>
                        <button
                          onClick={() => handlePreviewSound(sound)}
                          className={cn(
                            'px-2 py-2 rounded-r-md transition-all',
                            defaultSound === sound
                              ? 'hover:bg-primary/90'
                              : 'hover:bg-muted/80'
                          )}
                          title={`Preview ${sound}`}
                        >
                          <Play className="h-3 w-3" />
                        </button>
                      </div>
                    ))}

                    {/* Custom Sound Option */}
                    <div
                      className={cn(
                        'flex items-center gap-1 rounded-md transition-all',
                        defaultSound === 'custom'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      <button
                        onClick={() => {
                          if (defaultSound === 'custom' && customSoundPath) {
                            // Already have custom sound, allow deselecting
                            setDefaultSound('Hero')
                          } else if (customSoundPath) {
                            // Have a custom sound file, just switch to it
                            setDefaultSound('custom')
                          } else {
                            // Need to select a file
                            handleSelectCustomSound()
                          }
                        }}
                        className={cn(
                          'flex-1 px-3 py-2 text-sm font-medium text-left rounded-l-md transition-all flex items-center gap-2',
                          defaultSound === 'custom'
                            ? 'hover:bg-primary/90'
                            : 'hover:bg-muted/80'
                        )}
                      >
                        <Upload className="h-3 w-3" />
                        Custom
                      </button>
                      {customSoundPath && (
                        <button
                          onClick={() => handlePreviewSound('custom')}
                          className={cn(
                            'px-2 py-2 rounded-r-md transition-all',
                            defaultSound === 'custom'
                              ? 'hover:bg-primary/90'
                              : 'hover:bg-muted/80'
                          )}
                          title="Preview custom sound"
                        >
                          <Play className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Custom Sound File Display */}
                  {customSoundPath && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                      <Music className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs flex-1 truncate" title={customSoundPath}>
                        {customSoundPath.split('/').pop()}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearCustomSound}
                        className="h-6 w-6 p-0"
                        title="Remove custom sound"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {/* Upload New Custom Sound Button */}
                  {customSoundPath && defaultSound === 'custom' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectCustomSound}
                      className="w-full justify-start"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Different Sound
                    </Button>
                  )}
                </div>
              )}

              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    // Clear any pending debounced save and save immediately
                    if (saveTimeoutRef.current) {
                      clearTimeout(saveTimeoutRef.current)
                    }

                    // Save settings first to ensure test uses current configuration
                    setSaving(true)
                    try {
                      await updateConfig({
                        maxConcurrentTasks: parseInt(maxTasks, 10) || 3,
                        maxTaskDurationMinutes: parseInt(maxDuration, 10) || 15,
                        archiveRetentionDays: parseInt(retentionDays, 10) || 30,
                        notifications: {
                          enabled: notificationsEnabled,
                          sound: notificationSound,
                          defaultSound,
                          customSoundPath
                        }
                      })
                      // Then test notification
                      await window.api.testNotification()
                    } finally {
                      setSaving(false)
                    }
                  }}
                  disabled={!notificationsEnabled}
                >
                  Test Notification
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Walkthrough */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Compass className="h-5 w-5" />
                Walkthrough & Feature Highlights
              </CardTitle>
              <CardDescription>Tour the app and discover new features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Feature Spotlights Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="spotlights-enabled" className="text-base">
                    Show Feature Spotlights
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Highlight new features as you navigate the app
                  </p>
                </div>
                <Switch
                  id="spotlights-enabled"
                  checked={spotlightsEnabled}
                  onCheckedChange={setSpotlightsEnabled}
                />
              </div>

              {/* Restart Tour */}
              <div className="flex items-start justify-between gap-4 pt-2 border-t">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    {walkthroughCompleted
                      ? 'You have completed the walkthrough tour. Click below to take it again.'
                      : 'Haven\'t taken the tour yet? Start the walkthrough to learn about Nightshift\'s key features.'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleRestartTour}
                  className="gap-2 shrink-0"
                >
                  <Compass className="h-4 w-4" />
                  {walkthroughCompleted ? 'Restart Tour' : 'Start Tour'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Task Execution Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Task Execution</CardTitle>
              <CardDescription>Configure task execution settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="max-tasks">Maximum Concurrent Tasks</Label>
                <Input
                  id="max-tasks"
                  type="number"
                  min="1"
                  max="10"
                  value={maxTasks}
                  onChange={(e) => setMaxTasks(e.target.value)}
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of tasks to run simultaneously (1-10)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-duration">Maximum Task Duration (minutes)</Label>
                <Input
                  id="max-duration"
                  type="number"
                  min="0"
                  max="180"
                  value={maxDuration}
                  onChange={(e) => setMaxDuration(e.target.value)}
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">
                  Tasks running longer than this will be automatically terminated. Set to 0 to disable timeout.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="retention-days">Archive Retention (days)</Label>
                <Input
                  id="retention-days"
                  type="number"
                  min="0"
                  max="365"
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(e.target.value)}
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">
                  Automatically delete completed, rejected, and failed tasks older than this many days. Set to 0 to disable automatic cleanup.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <AboutPanel />

          {/* Auto-save indicator */}
          {saving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Theme preview card component
function ThemeCard({
  theme,
  isSelected,
  onSelect
}: {
  theme: (typeof themes)[number]
  isSelected: boolean
  onSelect: () => void
}) {
  const colors = theme.colors

  return (
    <button
      onClick={onSelect}
      className={cn(
        'p-3 rounded-lg border-2 transition-all text-left',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-muted-foreground/50'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Color preview */}
        <div
          className="w-14 h-10 rounded border overflow-hidden flex flex-col shrink-0"
          style={{ backgroundColor: `hsl(${colors.background})` }}
        >
          {/* Header bar */}
          <div
            className="h-2"
            style={{ backgroundColor: `hsl(${colors.card})` }}
          />
          {/* Content preview */}
          <div className="flex-1 p-1 flex gap-0.5">
            <div
              className="w-2 h-full rounded-sm"
              style={{ backgroundColor: `hsl(${colors.primary})` }}
            />
            <div className="flex-1 space-y-0.5">
              <div
                className="h-1 rounded-full w-full"
                style={{ backgroundColor: `hsl(${colors.foreground})`, opacity: 0.7 }}
              />
              <div
                className="h-1 rounded-full w-2/3"
                style={{ backgroundColor: `hsl(${colors.mutedForeground})`, opacity: 0.5 }}
              />
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{theme.name}</p>
            {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground truncate">{theme.description}</p>
        </div>
      </div>
    </button>
  )
}
