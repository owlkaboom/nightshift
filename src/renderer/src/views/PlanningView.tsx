/**
 * PlanningView - Main planning interface
 *
 * Enables conversational planning with AI agents to develop
 * implementation plans that can be converted to tasks.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, MessageSquare, Trash2, RefreshCw, FolderTree, ListTodo } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { usePlanningStore, useProjectStore, useTaskStore } from '@/stores'
import { useSessionStore } from '@/stores/session-store'
import { useKeyboardShortcuts, formatKbd, type KeyboardShortcut } from '@/hooks'
import {
  PlanningChat,
  PlanningInput,
  PlanningSessionList,
  PlanExtractionPanel,
  InitProjectDialog,
  CreateTaskFromPlanningDialog,
  PlanFileViewer
} from '@/components/planning'
import { Route } from '@/routes/planning'

export function PlanningView() {
  const { sessionId: urlSessionId, projectId: urlProjectId, sessionType: urlSessionType, initialPrompt: urlInitialPrompt } = Route.useSearch()

  const {
    sessions,
    currentSession,
    loading,
    error,
    fetchAllSessions,
    createSession,
    loadSession,
    deleteSession,
    sendMessage,
    interruptAndSend,
    cancelResponse,
    updatePlanItems,
    convertToTasks,
    setCurrentSession,
    clearError,
    isSessionAwaitingResponse,
    isSessionStreaming,
    getSessionStreamingContent,
    getSessionActivity
  } = usePlanningStore()

  const { projects, fetchProjects } = useProjectStore()
  const { createTask } = useTaskStore()
  const { sessionProjectId, setSessionProject } = useSessionStore()
  const [selectedProjectId, setSelectedProjectId] = useState<string>(sessionProjectId || '')
  const [showPlanPanel, setShowPlanPanel] = useState(false)
  const [showInitDialog, setShowInitDialog] = useState(false)
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false)
  const [sectionContent, setSectionContent] = useState<string | undefined>(undefined)
  const [planFilePath, setPlanFilePath] = useState<string | undefined>(undefined)
  const [showPlanFileViewer, setShowPlanFileViewer] = useState(false)
  const [selectedPlanFile, setSelectedPlanFile] = useState<string | null>(null)
  const [hasHandledUrlParams, setHasHandledUrlParams] = useState(false)

  // Initial data fetch
  useEffect(() => {
    fetchAllSessions()
    fetchProjects()
  }, [fetchAllSessions, fetchProjects])

  // Initialize project from session store when available
  useEffect(() => {
    if (sessionProjectId && !selectedProjectId) {
      setSelectedProjectId(sessionProjectId)
    }
  }, [sessionProjectId])

  // Auto-select first project if none selected
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      const firstProjectId = projects[0].id
      setSelectedProjectId(firstProjectId)
      setSessionProject(firstProjectId)
    }
  }, [projects, selectedProjectId, setSessionProject])

  // Handle creating a new session
  const handleNewSession = useCallback(async () => {
    if (!selectedProjectId) return

    try {
      const session = await createSession({
        projectId: selectedProjectId
      })
      setCurrentSession(session.id)
    } catch (err) {
      console.error('Failed to create session:', err)
    }
  }, [selectedProjectId, createSession, setCurrentSession])

  // Handle starting an init planning session
  const handleStartInitSession = useCallback(
    async (data: {
      projectId: string
      projectDescription: string
      techStack?: string
      initialMessage?: string
    }) => {
      const session = await createSession({
        projectId: data.projectId,
        sessionType: 'init',
        projectDescription: data.projectDescription,
        techStack: data.techStack,
        initialMessage: data.initialMessage
      })
      setCurrentSession(session.id)
    },
    [createSession, setCurrentSession]
  )

  // Handle sending a message
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!currentSession) {
        // Create a new session with the initial message
        if (!selectedProjectId) return
        await createSession({
          projectId: selectedProjectId,
          initialMessage: content
        })
      } else {
        await sendMessage(content)
      }
    },
    [currentSession, selectedProjectId, createSession, sendMessage]
  )

  // Handle session selection
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      loadSession(sessionId)
    },
    [loadSession]
  )

  // Handle session deletion
  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      await deleteSession(sessionId)
    },
    [deleteSession]
  )

  // Handle converting plan to tasks
  const handleConvertToTasks = useCallback(
    async (itemIds: string[]) => {
      const tasks = await convertToTasks(itemIds)
      return tasks
    },
    [convertToTasks]
  )

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchAllSessions()
  }, [fetchAllSessions])

  // Handle opening init dialog
  const handleOpenInitDialog = useCallback(() => {
    setShowInitDialog(true)
  }, [])

  // Handle opening create task dialog
  const handleOpenCreateTaskDialog = useCallback(() => {
    setSectionContent(undefined)
    setPlanFilePath(undefined)
    setShowCreateTaskDialog(true)
  }, [])

  // Handle creating task from a specific section
  const handleCreateTaskFromSection = useCallback((content: string) => {
    setSectionContent(content)
    setPlanFilePath(undefined)
    setShowCreateTaskDialog(true)
  }, [])

  // Handle creating task from a plan file
  const handleCreateTaskFromPlanFile = useCallback((content: string, filePath: string) => {
    setSectionContent(content)
    setPlanFilePath(filePath)
    setShowPlanFileViewer(false)
    setShowCreateTaskDialog(true)
  }, [])

  // Handle viewing a plan file
  const handleViewPlanFile = useCallback((filePath: string) => {
    setSelectedPlanFile(filePath)
    setShowPlanFileViewer(true)
  }, [])

  // Handle creating task from a plan file path (reads file first)
  const handleCreateTaskFromPlanFilePath = useCallback(async (filePath: string) => {
    if (!currentSession) return
    try {
      const content = await window.api.readPlanningFile(currentSession.projectId, filePath)
      setSectionContent(content)
      setPlanFilePath(filePath)
      setShowCreateTaskDialog(true)
    } catch (error) {
      console.error('Failed to read plan file:', error)
    }
  }, [currentSession])

  // Handle creating a task from the planning session
  const handleCreateTaskFromPlanning = useCallback(
    async (data: {
      prompt: string
      projectId: string
      enabledSkills?: string[]
      agentId?: string | null
      model?: string | null
      thinkingMode?: boolean | null
      planFilePath?: string | null
    }) => {
      await createTask(data)
    },
    [createTask]
  )

  // Keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = useMemo(
    () => [
      { key: 'n', meta: true, handler: handleNewSession, description: 'New planning session' },
      { key: 'i', meta: true, shift: true, handler: handleOpenInitDialog, description: 'Init project' },
      { key: 'r', meta: true, handler: handleRefresh, description: 'Refresh sessions' },
      {
        key: 't',
        meta: true,
        shift: true,
        handler: handleOpenCreateTaskDialog,
        description: 'Create task from planning',
        disabled: !currentSession
      }
    ],
    [handleNewSession, handleOpenInitDialog, handleRefresh, handleOpenCreateTaskDialog, currentSession]
  )

  useKeyboardShortcuts(shortcuts)

  const hasProjects = projects.length > 0
  const currentProject = useMemo(() => {
    if (!currentSession) return null
    return projects.find((p) => p.id === currentSession.projectId) || null
  }, [currentSession, projects])

  const projectName = useMemo(() => {
    return currentProject?.name || ''
  }, [currentProject])

  // Handle URL parameters for session selection/creation
  useEffect(() => {
    if (hasHandledUrlParams || sessions.length === 0 || projects.length === 0) return

    const handleUrlParams = async () => {
      // If sessionId is provided, load that session
      if (urlSessionId) {
        await loadSession(urlSessionId)
        setHasHandledUrlParams(true)
        return
      }

      // If projectId + sessionType + initialPrompt are provided, create a new session
      if (urlProjectId && urlSessionType) {
        try {
          const session = await createSession({
            projectId: urlProjectId,
            sessionType: urlSessionType,
            initialMessage: urlInitialPrompt
          })
          setCurrentSession(session.id)
          setHasHandledUrlParams(true)
        } catch (err) {
          console.error('[PlanningView] Failed to create session from URL params:', err)
        }
      }
    }

    handleUrlParams()
  }, [urlSessionId, urlProjectId, urlSessionType, urlInitialPrompt, sessions, projects, hasHandledUrlParams, loadSession, createSession, setCurrentSession])

  // All sessions (including claude-md) are now shown
  const planningSessions = sessions

  return (
    <div className="h-full flex flex-col" data-feature="planning-sessions">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-6 sm:pb-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Planning</h1>
          <p className="text-muted-foreground text-xs sm:text-sm truncate">
            Plan implementations with AI before creating tasks
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Project selector */}
          <Select
            value={selectedProjectId}
            onValueChange={(value) => {
              setSelectedProjectId(value)
              setSessionProject(value)
            }}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={loading}
            title={`Refresh (${formatKbd('⌘R')})`}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            variant="outline"
            onClick={handleOpenInitDialog}
            disabled={!hasProjects}
            title={`Init project (${formatKbd('⌘⇧I')})`}
            className="shrink-0"
          >
            <FolderTree className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Init Project</span>
            <kbd className="ml-2 text-xs opacity-60 hidden lg:inline">{formatKbd('⌘⇧I')}</kbd>
          </Button>

          <Button onClick={handleNewSession} disabled={!hasProjects} title={`New session (${formatKbd('⌘N')})`} className="shrink-0">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">New Session</span>
            <kbd className="ml-2 text-xs opacity-60 hidden lg:inline">{formatKbd('⌘N')}</kbd>
          </Button>
        </div>
      </div>

      {/* Init Project Dialog */}
      <InitProjectDialog
        open={showInitDialog}
        onOpenChange={setShowInitDialog}
        onStart={handleStartInitSession}
        projects={projects}
        defaultProjectId={selectedProjectId}
      />

      {/* Error display */}
      {error && (
        <div className="mx-6 mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 px-4 sm:px-6 pb-4 sm:pb-6 gap-4">
        {/* Session list sidebar */}
        <div className="w-full lg:w-64 flex-shrink-0 border rounded-lg bg-card max-h-48 lg:max-h-none overflow-y-auto lg:overflow-y-visible">
          <PlanningSessionList
            sessions={planningSessions}
            currentSessionId={currentSession?.id || null}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onNewSession={handleNewSession}
            projects={projects}
          />
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col border rounded-lg bg-card min-w-0 min-h-0">
          {!hasProjects ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 sm:p-8">
              <div className="rounded-full bg-muted p-4 sm:p-6 mb-3 sm:mb-4">
                <MessageSquare className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold mb-2">No projects yet</h2>
              <p className="text-muted-foreground max-w-sm text-sm sm:text-base px-4">
                Add a project first to start planning. Go to the Projects view to add a project.
              </p>
            </div>
          ) : !currentSession ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 sm:p-8">
              <div className="rounded-full bg-muted p-4 sm:p-6 mb-3 sm:mb-4">
                <MessageSquare className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold mb-2">Start a planning session</h2>
              <p className="text-muted-foreground max-w-sm mb-4 text-sm sm:text-base px-4">
                Describe what you want to build and collaborate with AI to create an implementation
                plan.
              </p>
              <Button onClick={handleNewSession}>
                <Plus className="h-4 w-4 mr-2" />
                New Session
              </Button>
            </div>
          ) : (
            <>
              {/* Session header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 border-b">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{currentSession.title}</h3>
                  <p className="text-xs text-muted-foreground truncate">{projectName}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Quick Create Task button - creates task immediately from session */}
                  {currentSession.messages.length > 0 && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        // Build a prompt from the planning session
                        const parts: string[] = []

                        // Add title from first user message
                        const firstUserMsg = currentSession.messages.find(m => m.role === 'user')
                        if (firstUserMsg) {
                          const firstLine = firstUserMsg.content.split('\n')[0].trim()
                          parts.push(`## ${firstLine}\n`)
                        }

                        // Add all messages as context
                        parts.push('## Planning Session Context\n')
                        currentSession.messages.forEach((msg) => {
                          if (msg.role === 'user') {
                            parts.push(`**User:** ${msg.content}\n`)
                          } else if (msg.role === 'assistant') {
                            parts.push(`**Assistant:** ${msg.content}\n`)
                          }
                        })

                        parts.push('\n## Instructions\n')
                        parts.push('Implement the requirements discussed above following best practices.')

                        // Create the task immediately
                        await handleCreateTaskFromPlanning({
                          prompt: parts.join('\n'),
                          projectId: currentSession.projectId,
                        })
                      }}
                      title="Create task from this planning session"
                      className="shrink-0"
                    >
                      <ListTodo className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Quick Create Task</span>
                    </Button>
                  )}
                  {/* Manual Create Task button - opens dialog for customization */}
                  {currentSession.messages.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenCreateTaskDialog}
                      title={`Customize task (${formatKbd('⌘⇧T')})`}
                      className="shrink-0"
                    >
                      <ListTodo className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Customize</span>
                    </Button>
                  )}
                  {currentSession.finalPlan.length > 0 && (
                    <Button
                      variant={showPlanPanel ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setShowPlanPanel(!showPlanPanel)}
                      className="shrink-0"
                    >
                      <span className="hidden sm:inline">Plan ({currentSession.finalPlan.length})</span>
                      <span className="sm:hidden">Plan ({currentSession.finalPlan.length})</span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteSession(currentSession.id)}
                    title="Delete session"
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-hidden">
                <PlanningChat
                  key={`planning-chat-${currentSession.id}`}
                  messages={currentSession.messages}
                  isAwaitingResponse={isSessionAwaitingResponse(currentSession.id)}
                  isStreaming={isSessionStreaming(currentSession.id)}
                  streamingContent={getSessionStreamingContent(currentSession.id)}
                  currentActivity={getSessionActivity(currentSession.id)}
                  onCreateTaskFromSection={handleCreateTaskFromSection}
                  onViewPlanFile={handleViewPlanFile}
                  onCreateTaskFromPlanFile={handleCreateTaskFromPlanFilePath}
                />
              </div>

              {/* Input area */}
              <PlanningInput
                key={`planning-${currentSession.id}`}
                onSend={handleSendMessage}
                onInterruptAndSend={interruptAndSend}
                onCancel={cancelResponse}
                isAwaitingResponse={isSessionAwaitingResponse(currentSession.id)}
                isStreaming={isSessionStreaming(currentSession.id)}
                disabled={!hasProjects}
                projectId={currentSession?.projectId || ''}
              />
            </>
          )}
        </div>

        {/* Plan extraction panel (shown when plan exists) */}
        {showPlanPanel && currentSession && currentSession.finalPlan.length > 0 && (
          <div className="w-full lg:w-80 flex-shrink-0 border rounded-lg bg-card max-h-96 lg:max-h-none overflow-y-auto lg:overflow-y-visible">
            <PlanExtractionPanel
              items={currentSession.finalPlan}
              onUpdateItems={updatePlanItems}
              onConvertToTasks={handleConvertToTasks}
              sessionStatus={currentSession.status}
            />
          </div>
        )}
      </div>

      {/* Create Task from Planning Dialog */}
      <CreateTaskFromPlanningDialog
        open={showCreateTaskDialog}
        onOpenChange={setShowCreateTaskDialog}
        session={currentSession}
        project={currentProject}
        sectionContent={sectionContent}
        planFilePath={planFilePath}
        onCreateTask={handleCreateTaskFromPlanning}
      />

      {/* Plan File Viewer Dialog */}
      <PlanFileViewer
        open={showPlanFileViewer}
        onOpenChange={setShowPlanFileViewer}
        filePath={selectedPlanFile}
        projectId={currentSession?.projectId || null}
        onCreateTask={handleCreateTaskFromPlanFile}
      />
    </div>
  )
}
