# Nightshift Architecture Diagram

## High-Level System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    NIGHTSHIFT APPLICATION                                    │
│                                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              MAIN PROCESS (Node.js)                                     │ │
│  │                                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                           AGENT SYSTEM                                           │  │ │
│  │  │                                                                                  │  │ │
│  │  │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                     │  │ │
│  │  │   │   Registry   │───→│   Process    │───→│   Planning   │                     │  │ │
│  │  │   │  (singleton) │    │   Manager    │    │   Manager    │                     │  │ │
│  │  │   └──────────────┘    └──────────────┘    └──────────────┘                     │  │ │
│  │  │          │                   │                   │                              │  │ │
│  │  │          ▼                   ▼                   ▼                              │  │ │
│  │  │   ┌─────────────────────────────────────────────────────────────────────────┐  │  │ │
│  │  │   │                       AGENT ADAPTERS                                     │  │  │ │
│  │  │   │                                                                          │  │  │ │
│  │  │   │   ┌──────────────────────────────────────────────────────────────────┐  │  │  │ │
│  │  │   │   │                    BaseAgentAdapter                               │  │  │  │ │
│  │  │   │   │  • wrapChildProcess()   • parseOutput()   • detectRateLimit()    │  │  │  │ │
│  │  │   │   │  • detectUsageLimit()   • extractResetTime()  • detectAuthError()│  │  │  │ │
│  │  │   │   │  • getExecutablePath()  • spawnProcess()                         │  │  │  │ │
│  │  │   │   └──────────────────────────────────────────────────────────────────┘  │  │  │ │
│  │  │   │                              ▲  ▲  ▲                                     │  │  │ │
│  │  │   │              ┌───────────────┘  │  └───────────────┐                    │  │  │ │
│  │  │   │              │                  │                  │                    │  │  │ │
│  │  │   │   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐               │  │  │ │
│  │  │   │   │  ClaudeCode  │   │    Gemini    │   │  OpenRouter  │               │  │  │ │
│  │  │   │   │   Adapter    │   │    Adapter   │   │   Adapter    │               │  │  │ │
│  │  │   │   │              │   │              │   │              │               │  │  │ │
│  │  │   │   │ • OAuth Auth │   │ • API Key    │   │ • API Key    │               │  │  │ │
│  │  │   │   │ • chat()     │   │ • Rate Tiers │   │ • Model List │               │  │  │ │
│  │  │   │   │ • Usage API  │   │              │   │              │               │  │  │ │
│  │  │   │   └──────────────┘   └──────────────┘   └──────────────┘               │  │  │ │
│  │  │   └─────────────────────────────────────────────────────────────────────────┘  │  │ │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                                         │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐                     │ │
│  │  │     STORAGE      │  │       GIT        │  │       IPC        │                     │ │
│  │  │                  │  │                  │  │    HANDLERS      │                     │ │
│  │  │  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │                     │ │
│  │  │  │   SQLite   │  │  │  │  Git Info  │  │  │  │ Task/Agent │  │                     │ │
│  │  │  │  Database  │  │  │  │            │  │  │  │  Handlers  │  │                     │ │
│  │  │  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │                     │ │
│  │  │  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │                     │ │
│  │  │  │  Secure    │  │  │  │  Worktree  │  │  │  │  Project/  │  │                     │ │
│  │  │  │  Store     │  │  │  │  Manager   │  │  │  │  Group     │  │                     │ │
│  │  │  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │                     │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘                     │ │
│  └────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                           │                                                  │
│                                    contextBridge                                             │
│                                   (Electron IPC)                                             │
│                                           │                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            PRELOAD SCRIPT                                               │ │
│  │                                                                                         │ │
│  │   window.api = {                                                                       │ │
│  │     // Tasks                        // Agents                   // System              │ │
│  │     createTask(),                   startTask(),                selectDirectory(),     │ │
│  │     listTasks(),                    cancelTask(),               openExternal(),        │ │
│  │     updateTask(),                   getRunningTasks(),          getPlatform(),         │ │
│  │                                     checkUsageLimits(),                                │ │
│  │     // Projects                     // Planning                 // Events              │ │
│  │     listProjects(),                 createPlanningSession(),    onTaskStatusChanged(), │ │
│  │     addProject(),                   sendPlanningMessage(),      onUsageLimitChanged(), │ │
│  │     ...                             ...                         ...                    │ │
│  │   }                                                                                    │ │
│  └────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                           │                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                           RENDERER PROCESS (React)                                      │ │
│  │                                                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                              ZUSTAND STORES                                       │  │ │
│  │  │                                                                                   │  │ │
│  │  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐         │  │ │
│  │  │  │   Task    │ │  Project  │ │   Group   │ │  Planning │ │    UI     │         │  │ │
│  │  │  │   Store   │ │   Store   │ │   Store   │ │   Store   │ │   Store   │         │  │ │
│  │  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘         │  │ │
│  │  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐                       │  │ │
│  │  │  │   Skill   │ │   Note    │ │   Config  │ │   Usage   │                       │  │ │
│  │  │  │   Store   │ │   Store   │ │   Store   │ │   Limit   │                       │  │ │
│  │  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘                       │  │ │
│  │  └──────────────────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                              VIEWS (TanStack Router)                              │  │ │
│  │  │                                                                                   │  │ │
│  │  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐         │  │ │
│  │  │  │   Queue   │ │  Projects │ │  Planning │ │   Notes   │ │  Settings │         │  │ │
│  │  │  │   View    │ │   View    │ │   View    │ │   View    │ │   View    │         │  │ │
│  │  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘         │  │ │
│  │  └──────────────────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                              COMPONENTS                                           │  │ │
│  │  │                                                                                   │  │ │
│  │  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                     │  │ │
│  │  │  │     Layout      │ │      Tasks      │ │     Review      │                     │  │ │
│  │  │  │  • Sidebar      │ │  • TaskCard     │ │  • DiffViewer   │                     │  │ │
│  │  │  │  • Header       │ │  • TaskDetail   │ │  • LogViewer    │                     │  │ │
│  │  │  │  • AppShell     │ │  • TaskForm     │ │  • AcceptDialog │                     │  │ │
│  │  │  └─────────────────┘ └─────────────────┘ └─────────────────┘                     │  │ │
│  │  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                     │  │ │
│  │  │  │      Queue      │ │     Planning    │ │       UI        │                     │  │ │
│  │  │  │  • KanbanBoard  │ │  • ChatView     │ │  • Button       │                     │  │ │
│  │  │  │  • ColumnView   │ │  • PlanItems    │ │  • Dialog       │                     │  │ │
│  │  │  │  • DragDrop     │ │  • Session      │ │  • Card         │                     │  │ │
│  │  │  └─────────────────┘ └─────────────────┘ └─────────────────┘                     │  │ │
│  │  └──────────────────────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Task Execution

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 TASK EXECUTION FLOW                                          │
│                                                                                              │
│  USER ACTION                                                                                 │
│      │                                                                                       │
│      ▼                                                                                       │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│  │   React     │     │   Zustand   │     │  window.api │     │     IPC     │               │
│  │  Component  │────→│    Store    │────→│  .startTask │────→│   Handler   │               │
│  │             │     │             │     │             │     │             │               │
│  └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘               │
│                                                                   │                         │
│                                                                   ▼                         │
│                      ┌────────────────────────────────────────────────────────┐            │
│                      │                    MAIN PROCESS                         │            │
│                      │                                                         │            │
│                      │   1. Validate auth        ┌────────────────────────┐   │            │
│                      │   2. Check usage limits   │     Process Manager    │   │            │
│                      │   3. Create worktree      │                        │   │            │
│                      │   4. Spawn agent          │   • Spawn CLI process  │   │            │
│                      │      ─────────────────────│   • Stream output      │   │            │
│                      │                           │   • Update task status │   │            │
│                      │                           │   • Handle completion  │   │            │
│                      │                           └────────────────────────┘   │            │
│                      │                                      │                  │            │
│                      │                                      ▼                  │            │
│                      │                           ┌────────────────────────┐   │            │
│                      │                           │    Agent Adapter       │   │            │
│                      │                           │                        │   │            │
│                      │                           │   • invoke()           │   │            │
│                      │                           │   • parseOutput()      │   │            │
│                      │                           │   • detectRateLimit()  │   │            │
│                      │                           └────────────────────────┘   │            │
│                      │                                      │                  │            │
│                      └──────────────────────────────────────│──────────────────┘            │
│                                                             │                               │
│                                                             ▼                               │
│                                                  ┌────────────────────────┐                │
│                                                  │    External CLI        │                │
│                                                  │    (claude, gemini)    │                │
│                                                  │                        │                │
│                                                  │   Running in worktree  │                │
│                                                  │   directory            │                │
│                                                  └────────────────────────┘                │
│                                                             │                               │
│                                                             ▼                               │
│                                                  ┌────────────────────────┐                │
│                                                  │   Git Worktree         │                │
│                                                  │   ~/.nightshift/       │                │
│                                                  │   worktrees/{proj}/    │                │
│                                                  │   {task}/              │                │
│                                                  └────────────────────────┘                │
│                                                                                              │
│  OUTPUT EVENTS                                                                               │
│      │                                                                                       │
│      ▼                                                                                       │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│  │   Main →    │     │    IPC      │     │   Zustand   │     │    React    │               │
│  │   Renderer  │────→│   Events    │────→│    Store    │────→│  Components │               │
│  │   Events    │     │             │     │   Update    │     │   Re-render │               │
│  └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘               │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Storage Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  STORAGE ARCHITECTURE                                        │
│                                                                                              │
│  ~/.nightshift/                                                                              │
│  │                                                                                           │
│  ├── nightshift.db          SQLite Database                                                 │
│  │   │                      ┌───────────────────────────────────────────────────────────┐   │
│  │   │                      │                        TABLES                              │   │
│  │   │                      │                                                            │   │
│  │   │                      │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │   │
│  │   │                      │  │   projects  │  │    groups   │  │    tasks    │        │   │
│  │   │                      │  │             │  │             │  │             │        │   │
│  │   │                      │  │ • id        │  │ • id        │  │ • id        │        │   │
│  │   │                      │  │ • name      │  │ • name      │  │ • projectId │        │   │
│  │   │                      │  │ • gitUrl    │  │ • color     │  │ • title     │        │   │
│  │   │                      │  │ • groupId   │  │ • icon      │  │ • status    │        │   │
│  │   │                      │  └─────────────┘  └─────────────┘  │ • prompt    │        │   │
│  │   │                      │                                     │ • iterations│        │   │
│  │   │                      │  ┌─────────────┐  ┌─────────────┐  └─────────────┘        │   │
│  │   │                      │  │   skills    │  │    notes    │                         │   │
│  │   │                      │  │             │  │             │  ┌─────────────┐        │   │
│  │   │                      │  │ • id        │  │ • id        │  │  planning   │        │   │
│  │   │                      │  │ • name      │  │ • content   │  │  sessions   │        │   │
│  │   │                      │  │ • prompt    │  │ • mentions  │  │             │        │   │
│  │   │                      │  │ • enabled   │  │ • isPinned  │  │ • messages  │        │   │
│  │   │                      │  └─────────────┘  └─────────────┘  │ • planItems │        │   │
│  │   │                      │                                     └─────────────┘        │   │
│  │   │                      └───────────────────────────────────────────────────────────┘   │
│  │   │                                                                                       │
│  ├── config.json            App configuration (theme, sidebar, etc.)                        │
│  │                                                                                           │
│  ├── local-state.json       Machine-specific state (window bounds, paths)                   │
│  │                                                                                           │
│  └── worktrees/             Git worktrees for task isolation                                │
│      └── {projectId}/                                                                        │
│          └── {taskId}/      Task-specific worktree                                          │
│              ├── .git → ... Linked to main repo                                             │
│              └── [files]    Working directory                                               │
│                                                                                              │
│  SECURE STORAGE (OS Keychain)                                                               │
│  │                                                                                           │
│  ├── Claude Code OAuth Token                                                                │
│  ├── Gemini API Key                                                                         │
│  └── OpenRouter API Key                                                                     │
│                                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Agent Adapter Inheritance

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              AGENT ADAPTER CLASS HIERARCHY                                   │
│                                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐    │
│  │                              AgentAdapter (interface)                                │    │
│  │                                                                                      │    │
│  │   interface AgentAdapter {                                                          │    │
│  │     id: string                                                                      │    │
│  │     name: string                                                                    │    │
│  │     isAvailable(): Promise<boolean>                                                 │    │
│  │     getExecutablePath(): Promise<string | null>                                     │    │
│  │     invoke(options: AgentInvokeOptions): AgentProcess                               │    │
│  │     parseOutput(stream: ReadableStream): AsyncIterable<AgentOutputEvent>            │    │
│  │     detectRateLimit(output: string): boolean                                        │    │
│  │     detectUsageLimit(output: string): UsageLimitResult                              │    │
│  │     detectAuthError(output: string): boolean                                        │    │
│  │     validateAuth(): Promise<AuthValidationResult>                                   │    │
│  │     checkUsageLimits(): Promise<UsageLimitCheckResult>                              │    │
│  │     getUsagePercentage(): Promise<UsagePercentageResult>                            │    │
│  │     fetchAvailableModels(): Promise<AgentModelInfo[]>                               │    │
│  │     getProjectConfigFiles(): string[]                                               │    │
│  │     getCapabilities(): AgentCapabilities                                            │    │
│  │   }                                                                                 │    │
│  └─────────────────────────────────────────────────────────────────────────────────────┘    │
│                                            ▲                                                 │
│                                            │ implements                                      │
│                                            │                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐    │
│  │                              BaseAgentAdapter (abstract)                             │    │
│  │                                                                                      │    │
│  │   SHARED FUNCTIONALITY:                                                             │    │
│  │   ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐                │    │
│  │   │ wrapChildProcess  │ │   parseOutput     │ │   parseLine       │                │    │
│  │   │ (static helper)   │ │ (async generator) │ │ (JSON/text)       │                │    │
│  │   └───────────────────┘ └───────────────────┘ └───────────────────┘                │    │
│  │   ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐                │    │
│  │   │  detectRateLimit  │ │ detectUsageLimit  │ │  extractResetTime │                │    │
│  │   │  (rate limits)    │ │ (quota/billing)   │ │ (time patterns)   │                │    │
│  │   └───────────────────┘ └───────────────────┘ └───────────────────┘                │    │
│  │   ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐                │    │
│  │   │ getExecutablePath │ │   spawnProcess    │ │  detectAuthError  │                │    │
│  │   │ (PATH + locations)│ │ (with env/logging)│ │ (auth patterns)   │                │    │
│  │   └───────────────────┘ └───────────────────┘ └───────────────────┘                │    │
│  │                                                                                      │    │
│  │   ABSTRACT (must override):                                                         │    │
│  │   • possiblePaths      • cliCommand        • defaultModels                         │    │
│  │   • invoke()           • validateAuth()    • checkUsageLimits()                    │    │
│  │   • getUsagePercentage() • fetchAvailableModels()                                  │    │
│  │   • getProjectConfigFiles() • getCapabilities()                                    │    │
│  └─────────────────────────────────────────────────────────────────────────────────────┘    │
│                                            ▲                                                 │
│                  ┌─────────────────────────┼─────────────────────────┐                      │
│                  │                         │                         │                      │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐             │
│  │   ClaudeCodeAdapter   │ │     GeminiAdapter     │ │  OpenRouterAdapter    │             │
│  │                       │ │                       │ │                       │             │
│  │ SPECIFIC FEATURES:    │ │ SPECIFIC FEATURES:    │ │ SPECIFIC FEATURES:    │             │
│  │ • OAuth token access  │ │ • API key auth        │ │ • Requires both       │             │
│  │ • Usage API endpoint  │ │ • Rate tier tracking  │ │   Claude CLI +        │             │
│  │ • chat() for planning │ │ • Local rate limiting │ │   OpenRouter CLI      │             │
│  │ • Models API fetch    │ │ • Models API fetch    │ │ • Multi-model access  │             │
│  │                       │ │                       │ │ • Credit-based usage  │             │
│  └───────────────────────┘ └───────────────────────┘ └───────────────────────┘             │
│                                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## IPC Communication Pattern

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                IPC COMMUNICATION PATTERN                                     │
│                                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐    │
│  │                              TYPE DEFINITIONS                                        │    │
│  │                              (src/shared/ipc-types.ts)                               │    │
│  │                                                                                      │    │
│  │   // Handler interfaces define all IPC methods                                      │    │
│  │   interface TaskHandlers {                                                          │    │
│  │     'task:list': (projectId: string) => Promise<TaskManifest[]>                    │    │
│  │     'task:create': (data: CreateTaskData) => Promise<TaskManifest>                 │    │
│  │     'task:update': (...) => Promise<TaskManifest | null>                           │    │
│  │     ...                                                                             │    │
│  │   }                                                                                 │    │
│  │                                                                                      │    │
│  │   // Combined handlers for full API                                                 │    │
│  │   type IpcHandlers = TaskHandlers & ProjectHandlers & AgentHandlers & ...          │    │
│  │                                                                                      │    │
│  │   // RendererApi defines window.api shape                                           │    │
│  │   interface RendererApi {                                                           │    │
│  │     listTasks: (projectId: string) => Promise<TaskManifest[]>                      │    │
│  │     createTask: (data: CreateTaskData) => Promise<TaskManifest>                    │    │
│  │     ...                                                                             │    │
│  │   }                                                                                 │    │
│  └─────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                              │
│  REQUEST FLOW (Renderer → Main):                                                            │
│                                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   React      │    │   Preload    │    │   Electron   │    │     IPC      │              │
│  │  Component   │───→│   Script     │───→│   ipcMain    │───→│   Handler    │              │
│  │              │    │              │    │   .handle()  │    │              │              │
│  │ window.api   │    │ ipcRenderer  │    │              │    │ task-handlers│              │
│  │ .createTask()│    │ .invoke()    │    │              │    │ .ts          │              │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘              │
│                                                                     │                       │
│                                                                     ▼                       │
│                                                              ┌──────────────┐              │
│                                                              │   Storage    │              │
│                                                              │   (SQLite)   │              │
│                                                              └──────────────┘              │
│                                                                                              │
│  EVENT FLOW (Main → Renderer):                                                              │
│                                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   Storage/   │    │   Broadcast  │    │   Preload    │    │    React     │              │
│  │   Agent      │───→│   to all     │───→│  listeners   │───→│   Stores     │              │
│  │   Change     │    │   windows    │    │              │    │   (Zustand)  │              │
│  │              │    │              │    │ onTaskStatus │    │              │              │
│  │              │    │ webContents  │    │ Changed()    │    │ updateTask() │              │
│  └──────────────┘    │ .send()      │    └──────────────┘    └──────────────┘              │
│                      └──────────────┘                                                       │
│                                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Task State Machine

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  TASK STATE MACHINE                                          │
│                                                                                              │
│                                                                                              │
│                    ┌──────────────────────────────────────────────────────────────┐         │
│                    │                                                               │         │
│                    ▼                                                               │         │
│              ┌──────────┐                                                          │         │
│              │          │                                                          │         │
│     ┌───────│  QUEUED  │◄──────────────────────────────────────────────┐          │         │
│     │       │          │                                                │          │         │
│     │       └──────────┘                                                │          │         │
│     │            │                                                      │          │         │
│     │            │ startTask()                                          │          │         │
│     │            ▼                                                      │          │         │
│     │       ┌──────────┐                                                │          │         │
│     │       │          │                                                │          │         │
│     │       │ RUNNING  │────────┬───────────────────────────┐          │          │         │
│     │       │          │        │                           │          │          │         │
│     │       └──────────┘        │                           │          │          │         │
│     │            │              │                           │          │          │         │
│     │            │ complete     │ error                     │ cancel   │          │         │
│     │            ▼              ▼                           ▼          │          │         │
│     │   ┌─────────────┐    ┌──────────┐              ┌──────────┐     │          │         │
│     │   │   NEEDS     │    │          │              │          │     │          │         │
│     │   │   REVIEW    │    │  FAILED  │──────────────│ CANCELLED│     │          │         │
│     │   │             │    │          │   retry      │          │     │          │         │
│     │   └─────────────┘    └──────────┘              └──────────┘     │          │         │
│     │         │  │                                                     │          │         │
│     │         │  │ re-prompt                                          │          │         │
│     │         │  └────────────────────────────────────────────────────┘          │         │
│     │         │                                                                   │         │
│     │         │ accept            │ reject                                        │         │
│     │         ▼                   ▼                                               │         │
│     │   ┌──────────┐        ┌──────────┐                                         │         │
│     │   │          │        │          │                                         │         │
│     │   │ ACCEPTED │        │ REJECTED │─────────────────────────────────────────┘         │
│     │   │          │        │          │  clone as new task                                │
│     │   └──────────┘        └──────────┘                                                   │
│     │                                                                                       │
│     │ delete                                                                               │
│     ▼                                                                                       │
│  [DELETED]                                                                                  │
│                                                                                              │
│                                                                                              │
│  Status Descriptions:                                                                       │
│  ┌────────────┬──────────────────────────────────────────────────────────────────┐         │
│  │ QUEUED     │ Waiting in queue, ready to be started                            │         │
│  │ RUNNING    │ Agent actively executing, output streaming                       │         │
│  │ NEEDS_REVIEW│ Agent completed, awaiting human review                          │         │
│  │ FAILED     │ Agent encountered error (rate limit, auth, crash)               │         │
│  │ CANCELLED  │ User cancelled during execution                                  │         │
│  │ ACCEPTED   │ Human approved changes (ready for merge)                        │         │
│  │ REJECTED   │ Human rejected changes (worktree will be cleaned)               │         │
│  └────────────┴──────────────────────────────────────────────────────────────────┘         │
│                                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```
