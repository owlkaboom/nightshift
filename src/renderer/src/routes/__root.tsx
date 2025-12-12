import { useEffect, useState, useMemo, useCallback } from 'react'
import { createRootRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { MainLayout } from '@/components/layout'
import { StartupLoader } from '@/components/layout/StartupLoader'
import { QuickNoteDialog } from '@/components/notes/QuickNoteDialog'
import { InitSetupDialog } from '@/components/settings/InitSetupDialog'
import { SpotlightDebugPanel } from '@/components/debug/SpotlightDebugPanel'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { WalkthroughProvider, WalkthroughSpotlight, AutoWalkthroughPrompt, AutoFeatureSpotlight } from '@/components/walkthrough'
import { useUIStore, useProjectStore, useConfigStore, useNoteStore } from '@/stores'
import { useKeyboardShortcuts, type KeyboardShortcut } from '@/hooks'

function RootComponent() {
  const navigate = useNavigate()
  const { toggleSidebar, activeModal, sidebarCollapsed } = useUIStore()
  const { fetchProjects, loadSelectedProject } = useProjectStore()
  const { fetchConfig, config, updateConfig } = useConfigStore()
  const { createNote } = useNoteStore()
  const [quickNoteOpen, setQuickNoteOpen] = useState(false)
  const [initSetupOpen, setInitSetupOpen] = useState(false)
  const [hasCheckedInitSetup, setHasCheckedInitSetup] = useState(false)
  const [walkthroughActive, setWalkthroughActive] = useState(false)
  const [debugPanelOpen, setDebugPanelOpen] = useState(false)

  // Startup loading state
  const [startupComplete, setStartupComplete] = useState(false)
  const [startupMessage, setStartupMessage] = useState('Starting up...')

  // Check startup status and listen for updates
  useEffect(() => {
    // Get initial startup status
    window.api.getStartupStatus().then((status) => {
      setStartupMessage(status.message)
      if (status.complete) {
        setStartupComplete(true)
      }
    })

    // Listen for startup progress updates
    const unsubscribe = window.api.onStartupProgress((status) => {
      setStartupMessage(status.message)
      if (status.complete) {
        setStartupComplete(true)
      }
    })

    return unsubscribe
  }, [])

  // Initial data fetch (only after startup complete)
  useEffect(() => {
    if (startupComplete) {
      const loadData = async () => {
        await fetchProjects()
        await loadSelectedProject()
        await fetchConfig()
      }
      loadData()
    }
  }, [startupComplete, fetchProjects, loadSelectedProject, fetchConfig])

  // Check if we need to show init setup dialog
  useEffect(() => {
    if (config && !hasCheckedInitSetup) {
      setHasCheckedInitSetup(true)

      // Check if this is a first-run (no vault path configured)
      const needsSetup = !config.vaultPath

      // Check if user has previously skipped setup
      const hasSkippedSetup = localStorage.getItem('nightshift:init-setup-skipped') === 'true'

      if (needsSetup && !hasSkippedSetup) {
        setInitSetupOpen(true)
      }
    }
  }, [config, hasCheckedInitSetup])

  // Auto-collapse sidebar on small screens (< 640px)
  useEffect(() => {
    const handleResize = () => {
      const isSmallScreen = window.innerWidth < 640
      // Only auto-collapse, don't auto-expand (user controls expansion)
      if (isSmallScreen && !sidebarCollapsed) {
        toggleSidebar()
      }
    }

    // Check on mount
    handleResize()

    // Listen for window resize
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [sidebarCollapsed, toggleSidebar])

  // Navigation shortcuts using router
  const handleGoToBoard = useCallback(() => navigate({ to: '/board' }), [navigate])
  const handleGoToProjects = useCallback(() => navigate({ to: '/projects' }), [navigate])
  const handleGoToTags = useCallback(() => navigate({ to: '/tags' }), [navigate])
  const handleGoToNotes = useCallback(() => navigate({ to: '/notes' }), [navigate])
  const handleGoToPlanning = useCallback(() => navigate({ to: '/planning' }), [navigate])
  const handleGoToSkills = useCallback(() => navigate({ to: '/skills' }), [navigate])
  const handleGoToSchedule = useCallback(() => navigate({ to: '/schedule' }), [navigate])
  const handleGoToSettings = useCallback(() => navigate({ to: '/settings', search: { section: undefined } }), [navigate])
  const handleGoToProcesses = useCallback(() => navigate({ to: '/processes' }), [navigate])
  const handleGoToShortcuts = useCallback(() => navigate({ to: '/shortcuts' }), [navigate])
  const handleToggleSidebar = useCallback(() => toggleSidebar(), [toggleSidebar])

  // Quick note handler
  const handleQuickNote = useCallback(() => setQuickNoteOpen(true), [])

  // Debug panel handler (only in dev mode)
  const handleToggleDebugPanel = useCallback(() => {
    if (import.meta.env.DEV) {
      setDebugPanelOpen((prev) => !prev)
    }
  }, [])

  // Handle quick note save
  const handleQuickNoteSave = useCallback(
    async (data: Parameters<typeof createNote>[0]) => {
      await createNote(data)
    },
    [createNote]
  )

  // Handle init setup completion
  const handleInitSetupComplete = useCallback(
    async (setupConfig: { vaultPath: string }) => {
      await updateConfig({ vaultPath: setupConfig.vaultPath })
      setInitSetupOpen(false)
    },
    [updateConfig]
  )

  // Handle init setup skip
  const handleInitSetupSkip = useCallback(() => {
    localStorage.setItem('nightshift:init-setup-skipped', 'true')
    setInitSetupOpen(false)
  }, [])

  // Global shortcuts (navigation) - using mnemonic keys
  const globalShortcuts: KeyboardShortcut[] = useMemo(
    () => [
      { key: 'b', handler: handleGoToBoard, description: 'Go to Board', ignoreInputs: true },
      { key: 'p', handler: handleGoToProjects, description: 'Go to Projects', ignoreInputs: true },
      { key: 't', handler: handleGoToTags, description: 'Go to Tags', ignoreInputs: true },
      { key: 'n', handler: handleGoToNotes, description: 'Go to Notes', ignoreInputs: true },
      { key: 'a', handler: handleGoToPlanning, description: 'Go to Planning', ignoreInputs: true },
      { key: 'k', handler: handleGoToSkills, description: 'Go to Skills', ignoreInputs: true },
      { key: 's', handler: handleGoToSchedule, description: 'Go to Schedule', ignoreInputs: true },
      { key: ',', handler: handleGoToSettings, description: 'Go to Settings', ignoreInputs: true },
      { key: 'b', meta: true, handler: handleToggleSidebar, description: 'Toggle sidebar' },
      { key: 'p', meta: true, handler: handleGoToProcesses, description: 'Go to Processes' },
      { key: '/', meta: true, handler: handleGoToShortcuts, description: 'Go to Shortcuts' },
      { key: 'n', meta: true, shift: true, handler: handleQuickNote, description: 'Quick note' },
      { key: 'd', meta: true, shift: true, handler: handleToggleDebugPanel, description: 'Toggle debug panel (dev only)' },
    ],
    [handleGoToBoard, handleGoToProjects, handleGoToTags, handleGoToNotes, handleGoToPlanning, handleGoToSkills, handleGoToSchedule, handleGoToSettings, handleToggleSidebar, handleGoToProcesses, handleGoToShortcuts, handleQuickNote, handleToggleDebugPanel]
  )

  // Don't enable shortcuts when a modal is open or walkthrough is active
  useKeyboardShortcuts(globalShortcuts, {
    enabled: !activeModal && !quickNoteOpen && !initSetupOpen && !walkthroughActive
  })

  return (
    <TooltipProvider>
      <WalkthroughProvider onActiveChange={setWalkthroughActive}>
        <StartupLoader visible={!startupComplete} statusMessage={startupMessage} />
        <MainLayout>
          <Outlet />
        </MainLayout>
        <InitSetupDialog
          open={initSetupOpen}
          onComplete={handleInitSetupComplete}
          onSkip={handleInitSetupSkip}
        />
        <QuickNoteDialog
          open={quickNoteOpen}
          onOpenChange={setQuickNoteOpen}
          onSave={handleQuickNoteSave}
        />
        <AutoWalkthroughPrompt />
        <WalkthroughSpotlight />
        <AutoFeatureSpotlight />
        <Toaster />
        {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
        {import.meta.env.DEV && (
          <SpotlightDebugPanel open={debugPanelOpen} onOpenChange={setDebugPanelOpen} />
        )}
      </WalkthroughProvider>
    </TooltipProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent
})
