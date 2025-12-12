# UI Components

## Overview

Nightshift's UI is built with React 19, TypeScript, and Tailwind CSS. Components follow a layered architecture with UI primitives, feature components, and page views.

## Component Hierarchy

```
src/renderer/src/
├── views/              # Page-level components (routes)
│   ├── QueueView.tsx
│   ├── ProjectsView.tsx
│   ├── GroupsView.tsx
│   └── SettingsView.tsx
├── components/
│   ├── layout/         # App structure
│   ├── queue/          # Kanban board
│   ├── tasks/          # Task-related
│   ├── projects/       # Project-related
│   ├── review/         # Review interface
│   ├── skills/         # Skills management
│   └── ui/             # Primitives
└── hooks/              # Custom hooks
```

## UI Primitives (`components/ui/`)

Based on Radix UI with Tailwind styling (shadcn/ui pattern):

| Component | Description |
|-----------|-------------|
| `Button` | Primary, secondary, ghost, destructive variants |
| `Card` | Container with header, content, footer |
| `Dialog` | Modal dialogs |
| `DropdownMenu` | Context menus |
| `Input` | Text inputs |
| `Label` | Form labels |
| `ScrollArea` | Custom scrollbars |
| `Select` | Dropdowns |
| `Separator` | Visual dividers |
| `Tabs` | Tabbed interfaces |
| `Textarea` | Multi-line input |
| `Tooltip` | Hover tooltips |
| `Badge` | Status badges |

### Usage Example

```tsx
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'

function Example() {
  return (
    <Card>
      <CardHeader>
        <h2>Task Title</h2>
      </CardHeader>
      <CardContent>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="primary">Open</Button>
          </DialogTrigger>
          <DialogContent>
            {/* Dialog content */}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
```

## Layout Components (`components/layout/`)

### AppLayout

Main application shell with sidebar navigation:

```tsx
// components/layout/AppLayout.tsx
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Header />
        {children}
      </main>
    </div>
  )
}
```

### Sidebar

Navigation sidebar with view switching:

```tsx
// components/layout/Sidebar.tsx
function Sidebar() {
  const currentView = useUIStore(state => state.currentView)
  const setView = useUIStore(state => state.setView)

  return (
    <nav className="w-64 border-r bg-background">
      <SidebarItem
        icon={<ListTodo />}
        label="Queue"
        active={currentView === 'queue'}
        onClick={() => setView('queue')}
      />
      <SidebarItem
        icon={<Folder />}
        label="Projects"
        active={currentView === 'projects'}
        onClick={() => setView('projects')}
      />
      {/* More items */}
    </nav>
  )
}
```

## Queue Components (`components/queue/`)

### QueueBoard

Kanban-style board using dnd-kit:

```tsx
// components/queue/QueueBoard.tsx
import { DndContext, closestCenter } from '@dnd-kit/core'

function QueueBoard() {
  const tasks = useTaskStore(state => state.tasks)

  const columns = [
    { id: 'backlog', title: 'Backlog', statuses: ['queued'] },
    { id: 'progress', title: 'In Progress', statuses: ['running'] },
    { id: 'review', title: 'Review', statuses: ['needs_review'] },
    { id: 'done', title: 'Done', statuses: ['accepted', 'rejected'] },
  ]

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 p-4">
        {columns.map(column => (
          <QueueColumn
            key={column.id}
            column={column}
            tasks={tasks.filter(t => column.statuses.includes(t.status))}
          />
        ))}
      </div>
    </DndContext>
  )
}
```

### QueueColumn

Single column in the board:

```tsx
// components/queue/QueueColumn.tsx
function QueueColumn({ column, tasks }: QueueColumnProps) {
  return (
    <div className="w-80 flex-shrink-0">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{column.title}</h3>
        <Badge>{tasks.length}</Badge>
      </div>
      <SortableContext items={tasks.map(t => t.id)}>
        <div className="space-y-2">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
```

## Task Components (`components/tasks/`)

### TaskCard

Compact task display for queue:

```tsx
// components/tasks/TaskCard.tsx
function TaskCard({ task }: { task: Task }) {
  const project = useProjectStore(state =>
    state.projects.find(p => p.id === task.projectId)
  )

  return (
    <Card className="cursor-pointer hover:shadow-md" onClick={() => openTask(task)}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-medium">{task.title}</h4>
            <p className="text-sm text-muted-foreground">{project?.name}</p>
          </div>
          <TaskStatusBadge status={task.status} />
        </div>
        <p className="mt-2 text-sm line-clamp-2">{task.prompt}</p>
      </CardContent>
    </Card>
  )
}
```

### TaskDetailPanel

Full task details in side panel:

```tsx
// components/tasks/TaskDetailPanel.tsx
function TaskDetailPanel({ task }: { task: Task }) {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">{task.title}</h2>
        <TaskActions task={task} />
      </div>

      <Tabs defaultValue="prompt">
        <TabsList>
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
          <TabsTrigger value="log">Execution Log</TabsTrigger>
          <TabsTrigger value="diff">Changes</TabsTrigger>
        </TabsList>

        <TabsContent value="prompt">
          <TaskPromptView task={task} />
        </TabsContent>
        <TabsContent value="log">
          <TaskLogView task={task} />
        </TabsContent>
        <TabsContent value="diff">
          <TaskDiffView task={task} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### CreateTaskDialog

New task creation form:

```tsx
// components/tasks/CreateTaskDialog.tsx
function CreateTaskDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  const createTask = useTaskStore(state => state.createTask)

  const handleSubmit = async (data: CreateTaskInput) => {
    await createTask(projectId, data)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>
        <TaskForm onSubmit={handleSubmit} />
      </DialogContent>
    </Dialog>
  )
}
```

## Review Components (`components/review/`)

### ReviewInterface

Main review screen for completed tasks:

```tsx
// components/review/ReviewInterface.tsx
function ReviewInterface({ task }: { task: Task }) {
  const acceptTask = useTaskStore(state => state.acceptTask)
  const rejectTask = useTaskStore(state => state.rejectTask)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">{task.title}</h2>
        <div className="mt-2 flex gap-2">
          <Button variant="primary" onClick={() => acceptTask(task.id)}>
            Accept Changes
          </Button>
          <Button variant="destructive" onClick={() => rejectTask(task.id)}>
            Reject
          </Button>
          <Button variant="secondary">Re-prompt</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <DiffViewer task={task} />
      </div>
    </div>
  )
}
```

### DiffViewer

Shows git diff of changes:

```tsx
// components/review/DiffViewer.tsx
function DiffViewer({ task }: { task: Task }) {
  const [diff, setDiff] = useState<string>('')

  useEffect(() => {
    window.api.getTaskDiff(task.id).then(setDiff)
  }, [task.id])

  return (
    <pre className="bg-muted p-4 font-mono text-sm">
      {diff}
    </pre>
  )
}
```

## Project Components (`components/projects/`)

### ProjectCard

```tsx
// components/projects/ProjectCard.tsx
function ProjectCard({ project }: { project: Project }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          <CardTitle>{project.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{project.gitUrl}</p>
        <div className="mt-2 flex gap-2">
          <Badge>{project.taskCount} tasks</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
```

## State Management Integration

Components connect to Zustand stores:

```tsx
// Using store in component
function TaskList({ projectId }: { projectId: string }) {
  // Subscribe to specific state
  const tasks = useTaskStore(state =>
    state.tasks.filter(t => t.projectId === projectId)
  )
  const loading = useTaskStore(state => state.loading)

  // Access actions
  const loadTasks = useTaskStore(state => state.loadTasks)

  useEffect(() => {
    loadTasks(projectId)
  }, [projectId])

  if (loading) return <Spinner />

  return (
    <div>
      {tasks.map(task => <TaskCard key={task.id} task={task} />)}
    </div>
  )
}
```

## Keyboard Shortcuts

Global shortcuts via custom hook:

```tsx
// hooks/useKeyboardShortcuts.ts
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl + N: New task
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        openNewTaskDialog()
      }

      // Cmd/Ctrl + Enter: Run task
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        runSelectedTask()
      }

      // Escape: Close panel
      if (e.key === 'Escape') {
        closeDetailPanel()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
```

## Styling Conventions

- **Tailwind CSS 4**: Utility-first styling
- **CSS Variables**: Theme colors via `--background`, `--foreground`, etc.
- **Dark Mode**: Supported via `dark:` prefix classes
- **Responsive**: Mobile-first with `sm:`, `md:`, `lg:` breakpoints

```tsx
// Example styling
<div className="flex flex-col gap-4 p-4 md:flex-row md:gap-6 md:p-6">
  <Card className="flex-1 bg-background dark:bg-background-dark">
    {/* Content */}
  </Card>
</div>
```

## Relevant Files

| File | Purpose |
|------|---------|
| `src/renderer/src/views/` | Page components |
| `src/renderer/src/components/ui/` | UI primitives |
| `src/renderer/src/components/layout/` | App shell |
| `src/renderer/src/components/queue/` | Kanban board |
| `src/renderer/src/components/tasks/` | Task components |
| `src/renderer/src/components/review/` | Review interface |
| `src/renderer/src/components/projects/` | Project components |
| `src/renderer/src/hooks/` | Custom hooks |
| `src/renderer/src/index.css` | Global styles |
| `tailwind.config.js` | Tailwind configuration |
