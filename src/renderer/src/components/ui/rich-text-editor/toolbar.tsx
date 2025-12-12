/**
 * Shared toolbar infrastructure for RichTextEditor
 * Provides reusable toolbar button components and configurations
 */

import type { Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { kbd } from '@/hooks/useKeyboardShortcuts'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Link as LinkIcon,
  Highlighter,
  type LucideIcon
} from 'lucide-react'

/**
 * ToolbarButton component props
 */
interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
  size?: 'default' | 'compact'
}

/**
 * Reusable toolbar button component
 */
export function ToolbarButton({
  onClick,
  isActive,
  disabled,
  title,
  children,
  size = 'default'
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        size === 'default' ? 'h-8 w-8' : 'h-7 w-7',
        isActive && 'bg-accent text-accent-foreground'
      )}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  )
}

/**
 * Toolbar group component with optional divider
 */
interface ToolbarGroupProps {
  children: React.ReactNode
  showDivider?: boolean
  size?: 'default' | 'compact'
}

export function ToolbarGroup({ children, showDivider = true, size = 'default' }: ToolbarGroupProps) {
  const spacing = size === 'default' ? 'pr-2 mr-2' : 'pr-1.5 mr-1.5'
  return (
    <div
      className={cn(
        'flex items-center gap-0.5',
        showDivider && `border-r border-border/40 ${spacing}`
      )}
    >
      {children}
    </div>
  )
}

/**
 * Toolbar button configuration
 */
export interface ToolbarButtonConfig {
  id: string
  icon: LucideIcon
  action: (editor: Editor) => void
  isActive: (editor: Editor) => boolean
  title: string
  shortcut?: string
  canExecute?: (editor: Editor) => boolean
}

/**
 * Get link action with prompt for URL
 */
export function createLinkAction(editor: Editor) {
  const previousUrl = editor.getAttributes('link').href
  const url = window.prompt('URL', previousUrl)

  if (url === null) return

  if (url === '') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }

  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

/**
 * Toolbar button configurations grouped by category
 */
export const TOOLBAR_BUTTONS: Record<string, ToolbarButtonConfig> = {
  // Headings
  h1: {
    id: 'h1',
    icon: Heading1,
    action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 1 }),
    title: 'Heading 1'
  },
  h2: {
    id: 'h2',
    icon: Heading2,
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 2 }),
    title: 'Heading 2'
  },
  h3: {
    id: 'h3',
    icon: Heading3,
    action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 3 }),
    title: 'Heading 3'
  },

  // Formatting
  bold: {
    id: 'bold',
    icon: Bold,
    action: (editor) => editor.chain().focus().toggleBold().run(),
    isActive: (editor) => editor.isActive('bold'),
    title: 'Bold',
    shortcut: `${kbd.mod}+B`
  },
  italic: {
    id: 'italic',
    icon: Italic,
    action: (editor) => editor.chain().focus().toggleItalic().run(),
    isActive: (editor) => editor.isActive('italic'),
    title: 'Italic',
    shortcut: `${kbd.mod}+I`
  },
  strikethrough: {
    id: 'strikethrough',
    icon: Strikethrough,
    action: (editor) => editor.chain().focus().toggleStrike().run(),
    isActive: (editor) => editor.isActive('strike'),
    title: 'Strikethrough'
  },
  code: {
    id: 'code',
    icon: Code,
    action: (editor) => editor.chain().focus().toggleCode().run(),
    isActive: (editor) => editor.isActive('code'),
    title: 'Inline Code'
  },
  highlight: {
    id: 'highlight',
    icon: Highlighter,
    action: (editor) => editor.chain().focus().toggleHighlight().run(),
    isActive: (editor) => editor.isActive('highlight'),
    title: 'Highlight'
  },
  link: {
    id: 'link',
    icon: LinkIcon,
    action: (editor) => createLinkAction(editor),
    isActive: (editor) => editor.isActive('link'),
    title: 'Link',
    shortcut: `${kbd.mod}+K`
  },

  // Lists
  bulletList: {
    id: 'bulletList',
    icon: List,
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (editor) => editor.isActive('bulletList'),
    title: 'Bullet List'
  },
  orderedList: {
    id: 'orderedList',
    icon: ListOrdered,
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor) => editor.isActive('orderedList'),
    title: 'Numbered List'
  },
  taskList: {
    id: 'taskList',
    icon: ListTodo,
    action: (editor) => editor.chain().focus().toggleTaskList().run(),
    isActive: (editor) => editor.isActive('taskList'),
    title: 'Task List'
  },
  blockquote: {
    id: 'blockquote',
    icon: Quote,
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
    isActive: (editor) => editor.isActive('blockquote'),
    title: 'Quote'
  },

  // History
  undo: {
    id: 'undo',
    icon: Undo,
    action: (editor) => editor.chain().focus().undo().run(),
    isActive: () => false,
    canExecute: (editor) => editor.can().undo(),
    title: 'Undo',
    shortcut: `${kbd.mod}+Z`
  },
  redo: {
    id: 'redo',
    icon: Redo,
    action: (editor) => editor.chain().focus().redo().run(),
    isActive: () => false,
    canExecute: (editor) => editor.can().redo(),
    title: 'Redo',
    shortcut: `${kbd.mod}+Shift+Z`
  }
}

/**
 * Grouped toolbar button IDs by category
 */
export const TOOLBAR_GROUPS = {
  headings: ['h1', 'h2', 'h3'],
  formatting: ['bold', 'italic', 'strikethrough', 'code', 'highlight', 'link'],
  lists: ['bulletList', 'orderedList', 'taskList', 'blockquote'],
  history: ['undo', 'redo']
}

/**
 * Toolbar component that renders button groups based on features
 */
interface ToolbarProps {
  editor: Editor | null
  features: {
    headings?: boolean
    formatting?: boolean
    strikethrough?: boolean
    highlight?: boolean
    lists?: boolean
    taskLists?: boolean
    blockquotes?: boolean
    history?: boolean
  }
  size?: 'default' | 'compact'
}

export function Toolbar({ editor, features, size = 'default' }: ToolbarProps) {
  if (!editor) return null

  const iconSize = size === 'default' ? 'h-4 w-4' : 'h-3.5 w-3.5'
  const padding = size === 'default' ? 'px-4 py-3' : 'px-2 py-1.5'

  // Build button groups based on features
  const groups: string[][] = []

  // Headings group
  if (features.headings) {
    groups.push(TOOLBAR_GROUPS.headings)
  }

  // Formatting group (always include bold, italic, code, link)
  if (features.formatting) {
    const formattingButtons = ['bold', 'italic']
    if (features.strikethrough) formattingButtons.push('strikethrough')
    formattingButtons.push('code')
    if (features.highlight) formattingButtons.push('highlight')
    formattingButtons.push('link')
    groups.push(formattingButtons)
  }

  // Lists group
  if (features.lists) {
    const listButtons = ['bulletList', 'orderedList']
    if (features.taskLists) listButtons.push('taskList')
    if (features.blockquotes) listButtons.push('blockquote')
    groups.push(listButtons)
  }

  // History group
  if (features.history) {
    groups.push(TOOLBAR_GROUPS.history)
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1 border-b bg-muted/20', padding)}>
      {groups.map((groupButtons, groupIndex) => (
        <ToolbarGroup
          key={groupIndex}
          showDivider={groupIndex < groups.length - 1}
          size={size}
        >
          {groupButtons.map((buttonId) => {
            const config = TOOLBAR_BUTTONS[buttonId]
            const Icon = config.icon
            const title = config.shortcut ? `${config.title} (${config.shortcut})` : config.title
            const disabled = config.canExecute ? !config.canExecute(editor) : false

            return (
              <ToolbarButton
                key={buttonId}
                onClick={() => config.action(editor)}
                isActive={config.isActive(editor)}
                disabled={disabled}
                title={title}
                size={size}
              >
                <Icon className={iconSize} />
              </ToolbarButton>
            )
          })}
        </ToolbarGroup>
      ))}
    </div>
  )
}
