# Frontend Development (src/renderer/)

## Overview

Nightshift's frontend is built with React 19, TypeScript, TanStack Router, Zustand for state management, and Tailwind CSS 4 with Radix UI primitives.

## Component Patterns

### File Organization

When creating React components:
- Use functional components only (no class components)
- TypeScript with explicit prop types
- Co-locate related files together

```
components/
└── feature-name/
    ├── FeatureName.tsx        # Main component
    ├── FeatureName.types.ts   # Types (if complex)
    ├── use-feature-name.ts    # Custom hooks
    └── __tests__/
        └── FeatureName.test.tsx
```

### Component Structure

```tsx
import type { ComponentProps } from './ComponentName.types'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ComponentNameProps {
  title: string
  onAction?: () => void
  className?: string
}

export function ComponentName({ title, onAction, className }: ComponentNameProps) {
  const [state, setState] = useState<boolean>(false)

  return (
    <div className={cn('base-classes', className)}>
      {/* Component content */}
    </div>
  )
}
```

## State Management

### Local State
Use `useState` or `useReducer` for component-only state:

```tsx
const [isOpen, setIsOpen] = useState(false)
const [formData, setFormData] = useState({ name: '', email: '' })
```

### Shared State (Zustand)
For state shared across components, create a Zustand store in `stores/`:

```tsx
// stores/example-store.ts
import { create } from 'zustand'

interface ExampleState {
  items: string[]
  addItem: (item: string) => void
  removeItem: (id: string) => void
}

export const useExampleStore = create<ExampleState>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) => set((state) => ({ items: state.items.filter(i => i !== id) }))
}))
```

### Server State (IPC)
Use `window.api` for all backend communication:

```tsx
// Never use fetch() or axios - always use window.api
const tasks = await window.api.invoke('task:list', projectId)
await window.api.invoke('task:update', taskId, updates)

// Subscribe to broadcasts from main process
useEffect(() => {
  const unsubscribe = window.api.on('task:status-changed', (task) => {
    // Handle task update
  })
  return unsubscribe
}, [])
```

## Styling

### Tailwind CSS 4
- Use utility classes for all styling
- Avoid inline styles except for truly dynamic values (e.g., `style={{ width: `${progress}%` }}`)
- Group related utilities with comments for readability

```tsx
<div className="
  flex items-center justify-between gap-4
  rounded-lg border border-gray-200 bg-white p-4
  shadow-sm transition-shadow hover:shadow-md
">
  {/* Content */}
</div>
```

### Conditional Classes
Use `cn()` helper from `lib/utils` for conditional styling:

```tsx
import { cn } from '@/lib/utils'

<Button
  className={cn(
    'base-button-classes',
    isActive && 'bg-blue-500 text-white',
    isDisabled && 'opacity-50 cursor-not-allowed',
    className // Allow external className override
  )}
/>
```

### Radix UI Primitives
Always use Radix UI for interactive elements:

```tsx
// ✅ Good - using Radix Dialog
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'

// ❌ Bad - custom modal implementation
const [isOpen, setIsOpen] = useState(false)
{isOpen && <div className="modal">...</div>}
```

Common primitives in `components/ui/`:
- `Dialog` - Modals and dialogs
- `DropdownMenu` - Context menus
- `Select` - Dropdowns
- `Tooltip` - Hover tooltips
- `Tabs` - Tabbed interfaces
- `ScrollArea` - Custom scrollbars

## Common Patterns

### Dialog/Modal Pattern
Always use Radix Dialog with controlled state:

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

function TaskDialog() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Open Task</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Task Details</DialogTitle>
        </DialogHeader>
        {/* Dialog content */}
      </DialogContent>
    </Dialog>
  )
}
```

### Form Handling
Use controlled inputs with validation on submit:

```tsx
function TaskForm() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate
    if (!title.trim()) {
      // Show error
      return
    }

    // Submit
    setIsSubmitting(true)
    try {
      await window.api.invoke('task:create', { title, description })
      setIsOpen(false)
    } catch (error) {
      // Handle error
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create Task'}
      </Button>
    </form>
  )
}
```

### Loading and Error States
Always handle loading, error, and empty states explicitly:

```tsx
function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      setIsLoading(true)
      const result = await window.api.invoke('task:list')
      setTasks(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div>Loading tasks...</div>
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>
  }

  if (tasks.length === 0) {
    return <div>No tasks yet</div>
  }

  return (
    <div>
      {tasks.map(task => <TaskCard key={task.id} task={task} />)}
    </div>
  )
}
```

### Custom Hooks
Extract reusable logic into custom hooks (prefix with `use`):

```tsx
// hooks/use-tasks.ts
import { useState, useEffect } from 'react'
import type { Task } from '@shared/types'

export function useTasks(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTasks()

    // Subscribe to task updates
    const unsubscribe = window.api.on('task:status-changed', (task) => {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t))
    })

    return unsubscribe
  }, [projectId])

  const loadTasks = async () => {
    try {
      setIsLoading(true)
      const result = await window.api.invoke('task:list', projectId)
      setTasks(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setIsLoading(false)
    }
  }

  return { tasks, isLoading, error, reload: loadTasks }
}

// Usage
function TaskBoard() {
  const { tasks, isLoading, error, reload } = useTasks(projectId)
  // ...
}
```

## Performance Optimization

### React.memo
Use `React.memo` for expensive components that render frequently:

```tsx
import { memo } from 'react'

export const TaskCard = memo(function TaskCard({ task }: TaskCardProps) {
  // Component implementation
})
```

### useMemo and useCallback
Use for expensive calculations or stable references:

```tsx
const sortedTasks = useMemo(() => {
  return tasks.sort((a, b) => a.priority - b.priority)
}, [tasks])

const handleTaskClick = useCallback((taskId: string) => {
  // Handle click
}, [/* dependencies */])
```

### Lazy Loading
Lazy load heavy components:

```tsx
import { lazy, Suspense } from 'react'

const ReviewPanel = lazy(() => import('./ReviewPanel'))

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ReviewPanel />
    </Suspense>
  )
}
```

## Routing

Use TanStack Router for navigation:

```tsx
// routes/tasks.$taskId.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/tasks/$taskId')({
  component: TaskDetailView
})

function TaskDetailView() {
  const { taskId } = Route.useParams()
  const navigate = Route.useNavigate()

  return (
    <div>
      <button onClick={() => navigate({ to: '/tasks' })}>
        Back to Tasks
      </button>
    </div>
  )
}
```

## Type Safety

### Component Props
Always define prop types explicitly:

```tsx
interface TaskCardProps {
  task: Task
  onEdit?: (task: Task) => void
  onDelete?: (taskId: string) => void
  className?: string
}

export function TaskCard({ task, onEdit, onDelete, className }: TaskCardProps) {
  // ...
}
```

### Event Handlers
Use React's built-in event types:

```tsx
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()
}

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value)
}

const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  // Handle click
}
```

## Logging

Use the logger utility from `lib/logger`:

```tsx
import { logger } from '@/lib/logger'

// Development/debugging output (only shown when debug mode enabled)
logger.debug('Component mounted', { props })

// Production-relevant logs
logger.info('Task created', { taskId })
logger.warn('Invalid input', { value })
logger.error('Failed to save task', { error })

// Never use console.log in production code
```

## Common Mistakes to Avoid

1. **Don't use fetch() or axios** - Always use `window.api` for backend communication
2. **Don't create custom modals** - Always use Radix Dialog primitive
3. **Don't use inline styles** - Use Tailwind utilities (except for truly dynamic values)
4. **Don't forget loading/error states** - Handle all async operation states
5. **Don't mutate state directly** - Always use setState/Zustand setters
6. **Don't use console.log** - Use logger utilities
7. **Don't skip TypeScript types** - Avoid `any`, define explicit types
8. **Don't forget cleanup** - Return cleanup functions from useEffect
