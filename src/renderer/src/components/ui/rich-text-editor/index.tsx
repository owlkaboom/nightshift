/**
 * Unified Rich Text Editor Component
 * Consolidates NoteEditor and TaskPromptEditor into a single configurable component
 */

import { useEffect, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import {
  createExtensions,
  createProjectMentionSuggestion,
  createGroupMentionSuggestion,
  createTagMentionSuggestion
} from '@/lib/tiptap'
import { cn } from '@/lib/utils'
import { markdownToHtml, isMarkdown } from '@/lib/markdown-to-html'
import { Toolbar } from './toolbar'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { Copy, Scissors, Clipboard, Type, Undo, Redo } from 'lucide-react'

/**
 * Variant presets for different use cases
 */
export type RichTextEditorVariant = 'full' | 'compact' | 'minimal'

/**
 * Feature flags for toolbar buttons and editor capabilities
 */
export interface RichTextEditorFeatures {
  headings?: boolean
  mentions?: boolean
  taskLists?: boolean
  highlight?: boolean
  strikethrough?: boolean
  blockquotes?: boolean
}

/**
 * RichTextEditor component props
 */
export interface RichTextEditorProps {
  // Content
  content?: string
  placeholder?: string
  onChange?: (html: string, plainText: string) => void
  onBlur?: () => void

  // Variant presets
  variant?: RichTextEditorVariant

  // Feature toggles (override variant defaults)
  features?: RichTextEditorFeatures

  // Toolbar control
  showToolbar?: boolean

  // Sizing
  minHeight?: string
  maxHeight?: string

  // State
  editable?: boolean
  autoFocus?: boolean
  className?: string

  // Mentions (when features.mentions = true)
  getProjects?: () => Promise<Array<{ id: string; name: string }>>
  getGroups?: () => Promise<Array<{ id: string; name: string; color?: string }>>
  getTags?: () => Promise<Array<{ id: string; name: string; color?: string }>>
}

/**
 * Default features for each variant
 */
const VARIANT_FEATURES: Record<RichTextEditorVariant, RichTextEditorFeatures> = {
  full: {
    headings: true,
    mentions: true,
    taskLists: true,
    highlight: true,
    strikethrough: true,
    blockquotes: true
  },
  compact: {
    headings: false,
    mentions: false,
    taskLists: false,
    highlight: false,
    strikethrough: false,
    blockquotes: false
  },
  minimal: {
    headings: false,
    mentions: false,
    taskLists: false,
    highlight: false,
    strikethrough: false,
    blockquotes: false
  }
}

/**
 * Variant-specific styling configurations
 */
const VARIANT_STYLES = {
  full: {
    size: 'default' as const,
    proseSize: 'prose-base',
    padding: 'px-4 py-3',
    minHeight: '300px',
    editorMinHeight: '[&_.ProseMirror]:min-h-[280px]',
    firstLineTitle: true,
    border: 'rounded-lg overflow-hidden'
  },
  compact: {
    size: 'compact' as const,
    proseSize: 'prose-sm',
    padding: 'px-2 py-1.5',
    minHeight: '150px',
    editorMinHeight: '',
    firstLineTitle: false,
    border: 'rounded-md border overflow-hidden'
  },
  minimal: {
    size: 'compact' as const,
    proseSize: 'prose-sm',
    padding: 'px-2 py-1.5',
    minHeight: '100px',
    editorMinHeight: '',
    firstLineTitle: false,
    border: 'rounded-md border overflow-hidden'
  }
}

/**
 * Unified RichTextEditor component
 * Supports multiple variants and configurable features
 */
export function RichTextEditor({
  content = '',
  placeholder = 'Start typing...',
  onChange,
  onBlur,
  variant = 'compact',
  features: customFeatures,
  showToolbar = true,
  minHeight,
  maxHeight,
  editable = true,
  autoFocus = false,
  className,
  getProjects,
  getGroups,
  getTags
}: RichTextEditorProps) {
  // Merge variant defaults with custom features
  const features = {
    ...VARIANT_FEATURES[variant],
    ...customFeatures
  }

  // Get variant styles
  const styles = VARIANT_STYLES[variant]
  const effectiveMinHeight = minHeight || styles.minHeight

  // Build extension configuration
  const extensionConfig: Parameters<typeof createExtensions>[0] = {
    placeholder
  }

  // Add project mention suggestion if mentions enabled and getProjects provided
  if (features.mentions && getProjects) {
    extensionConfig.projectSuggestion = createProjectMentionSuggestion(getProjects)
  }

  // Add tag mention suggestion if mentions enabled and getTags provided (preferred)
  if (features.mentions && getTags) {
    extensionConfig.tagSuggestion = createTagMentionSuggestion(getTags)
  }
  // Fallback to group mention suggestion if getGroups provided (legacy)
  else if (features.mentions && getGroups) {
    extensionConfig.groupSuggestion = createGroupMentionSuggestion(getGroups)
  }

  const editor = useEditor({
    extensions: createExtensions(extensionConfig),
    content: content || '',
    editable,
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const text = editor.getText()
      onChange?.(html, text)
    },
    onBlur: () => {
      onBlur?.()
    }
  })

  // Handle paste events
  useEffect(() => {
    if (!editor) return

    const handlePaste = (event: Event) => {
      const clipboardEvent = event as ClipboardEvent & { shiftKey?: boolean }
      const text = clipboardEvent.clipboardData?.getData('text/plain')
      if (!text) return

      // Always prevent default to stop TipTap's built-in paste handling
      event.preventDefault()
      event.stopPropagation()

      // Shift+Paste: Always paste as plain text without formatting
      if (clipboardEvent.shiftKey) {
        editor.commands.insertContent(text)
        return
      }

      // Normal Paste (Cmd+V/Ctrl+V): Convert markdown to HTML if detected
      // This matches the context menu "Paste" behavior
      if (isMarkdown(text)) {
        const html = markdownToHtml(text)
        editor.commands.insertContent(html)
      } else {
        editor.commands.insertContent(text)
      }
    }

    const editorElement = editor.view.dom
    // Use capture phase to intercept before TipTap's handlers
    editorElement.addEventListener('paste', handlePaste, true)
    return () => editorElement.removeEventListener('paste', handlePaste, true)
  }, [editor])

  // Context menu handlers
  const handleCopy = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, '\n')
    navigator.clipboard.writeText(text)
  }, [editor])

  const handleCut = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, '\n')
    navigator.clipboard.writeText(text)
    editor.commands.deleteSelection()
  }, [editor])

  const handlePaste = useCallback(async () => {
    if (!editor) return
    const text = await navigator.clipboard.readText()
    // Convert markdown to HTML if detected
    if (isMarkdown(text)) {
      const html = markdownToHtml(text)
      editor.commands.insertContent(html)
    } else {
      editor.commands.insertContent(text)
    }
  }, [editor])

  const handlePasteWithoutFormatting = useCallback(async () => {
    if (!editor) return
    const text = await navigator.clipboard.readText()
    // Always paste as plain text without markdown conversion
    editor.commands.insertContent(text)
  }, [editor])

  const [hasSelection, setHasSelection] = useState(false)

  // Track selection state for context menu
  useEffect(() => {
    if (!editor) return

    const updateSelection = () => {
      const { from, to } = editor.state.selection
      setHasSelection(from !== to)
    }

    editor.on('selectionUpdate', updateSelection)
    return () => {
      editor.off('selectionUpdate', updateSelection)
    }
  }, [editor])

  // Update content when prop changes
  useEffect(() => {
    if (!editor) return

    // Check if content is markdown and convert if needed
    const htmlContent = isMarkdown(content) ? markdownToHtml(content) : content

    // Get current editor HTML
    const currentHTML = editor.getHTML()

    // Normalize both HTMLs for comparison (strip whitespace, normalize formatting)
    const normalizeHTML = (html: string) => html.replace(/>\s+</g, '><').trim()
    const normalizedContent = normalizeHTML(htmlContent || '<p></p>')
    const normalizedCurrent = normalizeHTML(currentHTML || '<p></p>')

    // Only update if content actually differs
    if (normalizedContent !== normalizedCurrent) {
      editor.commands.setContent(htmlContent || '')
    }
  }, [content, editor])

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className={cn('flex flex-col bg-background', styles.border, className)}>
          {editable && showToolbar && (
            <Toolbar
              editor={editor}
              size={styles.size}
              features={{
                headings: features.headings,
                formatting: true, // Always show basic formatting
                strikethrough: features.strikethrough,
                highlight: features.highlight,
                lists: true, // Always show basic lists
                taskLists: features.taskLists,
                blockquotes: features.blockquotes,
                history: true // Always show undo/redo
              }}
            />
          )}
          <EditorContent
            editor={editor}
            className={cn(
              'flex-1 prose dark:prose-invert max-w-none',
              styles.proseSize,
              styles.padding,
              'focus-within:outline-none',
              styles.editorMinHeight,
              maxHeight && 'overflow-y-auto',
              // Placeholder styling
              '[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground/40',
              '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
              '[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left',
              '[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0',
              '[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none',
              '[&_.ProseMirror]:outline-none',
              // First line title styling (only for full variant)
              styles.firstLineTitle && [
                '[&_.ProseMirror>*:first-child]:text-3xl',
                '[&_.ProseMirror>*:first-child]:font-bold',
                '[&_.ProseMirror>*:first-child]:mt-0',
                '[&_.ProseMirror>*:first-child]:mb-4',
                '[&_.ProseMirror>*:first-child]:leading-tight',
                '[&_.ProseMirror>*:first-child]:tracking-tight'
              ],
              // Element spacing
              variant === 'full'
                ? [
                    '[&_.ProseMirror>*]:mb-2',
                    // Paragraph spacing
                    '[&_.ProseMirror>p]:mt-0',
                    '[&_.ProseMirror>p]:mb-2',
                    // Heading spacing
                    '[&_.ProseMirror>h1]:text-2xl',
                    '[&_.ProseMirror>h1]:font-bold',
                    '[&_.ProseMirror>h1]:mt-4',
                    '[&_.ProseMirror>h1]:mb-2',
                    '[&_.ProseMirror>h2]:text-xl',
                    '[&_.ProseMirror>h2]:font-semibold',
                    '[&_.ProseMirror>h2]:mt-3',
                    '[&_.ProseMirror>h2]:mb-2',
                    '[&_.ProseMirror>h3]:text-lg',
                    '[&_.ProseMirror>h3]:font-semibold',
                    '[&_.ProseMirror>h3]:mt-2',
                    '[&_.ProseMirror>h3]:mb-1.5'
                  ]
                : [
                    '[&_.ProseMirror>*]:mb-1.5',
                    '[&_.ProseMirror>*:last-child]:mb-0',
                    // Paragraph spacing for compact/minimal
                    '[&_.ProseMirror>p]:mt-0',
                    '[&_.ProseMirror>p]:mb-1.5'
                  ],
              // Task list styles
              '[&_.ProseMirror_ul[data-type="taskList"]]:list-none',
              '[&_.ProseMirror_ul[data-type="taskList"]]:pl-0',
              '[&_.ProseMirror_ul[data-type="taskList"]_li]:flex',
              '[&_.ProseMirror_ul[data-type="taskList"]_li]:items-start',
              '[&_.ProseMirror_ul[data-type="taskList"]_li]:gap-2',
              '[&_.ProseMirror_ul[data-type="taskList"]_li_label]:mt-0.5',
              '[&_.ProseMirror_ul[data-type="taskList"]_li_div]:flex-1',
              // Code block styling
              '[&_.ProseMirror_pre]:bg-muted',
              variant === 'full'
                ? [
                    '[&_.ProseMirror_pre]:p-2',
                    '[&_.ProseMirror_pre]:rounded-md'
                  ]
                : [
                    '[&_.ProseMirror_pre]:p-1.5',
                    '[&_.ProseMirror_pre]:rounded',
                    '[&_.ProseMirror_pre]:text-sm'
                  ],
              '[&_.ProseMirror_pre]:overflow-x-auto',
              // Inline code styling
              '[&_.ProseMirror_code]:bg-muted',
              variant === 'full'
                ? [
                    '[&_.ProseMirror_code]:px-1',
                    '[&_.ProseMirror_code]:py-0.5'
                  ]
                : [
                    '[&_.ProseMirror_code]:px-1',
                    '[&_.ProseMirror_code]:py-0.5',
                    '[&_.ProseMirror_code]:text-sm'
                  ],
              '[&_.ProseMirror_code]:rounded',
              // Blockquote styling
              '[&_.ProseMirror_blockquote]:border-l-2',
              '[&_.ProseMirror_blockquote]:border-muted-foreground/30',
              '[&_.ProseMirror_blockquote]:pl-3',
              '[&_.ProseMirror_blockquote]:italic'
            )}
            style={{
              minHeight: effectiveMinHeight,
              maxHeight
            }}
          />
        </div>
      </ContextMenuTrigger>
      {editable && (
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={handleCopy} disabled={!hasSelection}>
            <Copy className="mr-2 h-4 w-4" />
            <span>Copy</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCut} disabled={!hasSelection}>
            <Scissors className="mr-2 h-4 w-4" />
            <span>Cut</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={handlePaste}>
            <Clipboard className="mr-2 h-4 w-4" />
            <span>Paste</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={handlePasteWithoutFormatting}>
            <Type className="mr-2 h-4 w-4" />
            <span>Paste without formatting</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => editor?.commands.undo()} disabled={!editor?.can().undo()}>
            <Undo className="mr-2 h-4 w-4" />
            <span>Undo</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => editor?.commands.redo()} disabled={!editor?.can().redo()}>
            <Redo className="mr-2 h-4 w-4" />
            <span>Redo</span>
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  )
}
