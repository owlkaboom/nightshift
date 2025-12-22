/**
 * Unified Rich Text Editor Component
 * Consolidates NoteEditor and TaskPromptEditor into a single configurable component
 */

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import {
  createExtensions,
  createGroupMentionSuggestion,
  createProjectMentionSuggestion,
  createTagMentionSuggestion
} from '@/lib/tiptap'
import { cn } from '@/lib/utils'
import { EditorContent, useEditor } from '@tiptap/react'
import { Clipboard, Copy, Redo, Scissors, Type, Undo } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, memo } from 'react'
import { Toolbar } from './toolbar'
import { logger } from '@/lib/logger'

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
  onChange?: (markdown: string, plainText: string) => void
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
export const RichTextEditor = memo(function RichTextEditor({
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

  // Track when we're programmatically updating content (not user edits)
  // Use ref so the onUpdate callback always sees the latest value
  const isLoadingContentRef = useRef(false)
  // Track the last content we programmatically set to avoid unnecessary updates
  const lastSetContentRef = useRef<string>('')

  const editor = useEditor({
    extensions: createExtensions(extensionConfig),
    content: content || '',
    editable,
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      // Don't trigger onChange if we're loading content programmatically
      if (isLoadingContentRef.current) {
        logger.debug('[RichTextEditor] Skipping onChange during content load')
        return
      }
      // Get markdown directly from the editor using the Markdown extension
      const markdown = editor.storage.markdown.manager.serialize(editor.getJSON())
      const text = editor.getText()
      onChange?.(markdown, text)
    },
    onBlur: () => {
      onBlur?.()
    }
  })

  // Note: Paste handling is now automatic via the Markdown extension
  // It will auto-convert pasted markdown text to the editor format

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
    // The Markdown extension will automatically handle markdown conversion
    editor.commands.insertContent(text)
  }, [editor])

  const handlePasteWithoutFormatting = useCallback(async () => {
    if (!editor) return
    const text = await navigator.clipboard.readText()
    // Insert as plain text without any formatting
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

    const newContent = content || ''

    // Get current editor markdown
    const currentMarkdown = editor.storage.markdown.manager.serialize(editor.getJSON())

    // Normalize both for comparison (trim whitespace)
    const normalizeMarkdown = (md: string) => md.trim()
    const normalizedContent = normalizeMarkdown(newContent)
    const normalizedCurrent = normalizeMarkdown(currentMarkdown || '')

    logger.debug('[RichTextEditor] Content sync check:', {
      propContent: newContent.substring(0, 100),
      currentMarkdown: currentMarkdown?.substring(0, 100),
      willUpdate: normalizedContent !== normalizedCurrent
    })

    // Only update if content actually differs from what's in the editor
    if (normalizedContent !== normalizedCurrent) {
      logger.debug('[RichTextEditor] Updating editor content')
      // Set flag to prevent onChange from firing during programmatic update
      isLoadingContentRef.current = true

      // Parse markdown and set as JSON content
      const parsedContent = editor.storage.markdown.manager.parse(newContent)
      editor.commands.setContent(parsedContent)

      // Update the last set content ref to match what we just set
      lastSetContentRef.current = newContent

      // Reset flag synchronously after setContent completes
      // setContent is synchronous in TipTap, so we can reset immediately
      isLoadingContentRef.current = false
    } else {
      // Even if content hasn't changed, update the ref to stay in sync
      lastSetContentRef.current = newContent
    }
  }, [content, editor])

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  // Handle clicking anywhere in the editor area to focus
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    if (!editor || !editable) return

    // If clicking directly on the ProseMirror container (empty space below content),
    // focus the editor and move cursor to end
    const target = e.target as HTMLElement
    const isDirectProseMirrorClick = target.classList.contains('ProseMirror')

    if (isDirectProseMirrorClick) {
      // Focus at end when clicking empty space below content
      editor.commands.focus('end')
    } else {
      // For clicks on content or within the editor wrapper, just ensure focus
      // TipTap will handle cursor positioning naturally
      if (!editor.isFocused) {
        editor.commands.focus()
      }
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
            onClick={handleEditorClick}
            className={cn(
              'flex-1 prose dark:prose-invert max-w-none cursor-text',
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
              // Heading size and font weight (full variant only)
              variant === 'full' && [
                '[&_.ProseMirror>h1]:text-2xl',
                '[&_.ProseMirror>h1]:font-bold',
                '[&_.ProseMirror>h2]:text-xl',
                '[&_.ProseMirror>h2]:font-semibold',
                '[&_.ProseMirror>h3]:text-lg',
                '[&_.ProseMirror>h3]:font-semibold'
              ],
              // Compact/minimal variants: override global spacing with tighter values
              variant !== 'full' && [
                '[&_.ProseMirror>*]:!mb-2',
                '[&_.ProseMirror>*:last-child]:!mb-0',
                // Headings in compact mode get less space
                '[&_.ProseMirror>h1]:!mt-3',
                '[&_.ProseMirror>h1]:!mb-2',
                '[&_.ProseMirror>h2]:!mt-2.5',
                '[&_.ProseMirror>h2]:!mb-1.5',
                '[&_.ProseMirror>h3]:!mt-2',
                '[&_.ProseMirror>h3]:!mb-1.5'
              ],
              // Task list styles
              '[&_.ProseMirror_ul[data-type="taskList"]]:list-none',
              '[&_.ProseMirror_ul[data-type="taskList"]]:pl-0',
              '[&_.ProseMirror_ul[data-type="taskList"]_li]:flex',
              '[&_.ProseMirror_ul[data-type="taskList"]_li]:items-start',
              '[&_.ProseMirror_ul[data-type="taskList"]_li]:gap-2',
              '[&_.ProseMirror_ul[data-type="taskList"]_li]:mb-1',
              '[&_.ProseMirror_ul[data-type="taskList"]_li:last-child]:mb-0',
              '[&_.ProseMirror_ul[data-type="taskList"]_li_label]:mt-0.5',
              '[&_.ProseMirror_ul[data-type="taskList"]_li_div]:flex-1',
              // Regular list item spacing
              '[&_.ProseMirror_li]:mb-1',
              '[&_.ProseMirror_li:last-child]:mb-0',
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
              '[&_.ProseMirror_blockquote]:italic',
              // Horizontal rule styling
              '[&_.ProseMirror_hr]:my-2',
              '[&_.ProseMirror_hr]:border-0',
              '[&_.ProseMirror_hr]:border-t',
              '[&_.ProseMirror_hr]:border-border',
              // Table styling
              '[&_.ProseMirror_table]:my-0',
              '[&_.ProseMirror_table]:border-collapse',
              '[&_.ProseMirror_td]:p-1',
              '[&_.ProseMirror_th]:p-1',
              '[&_.ProseMirror_td]:border',
              '[&_.ProseMirror_th]:border',
              '[&_.ProseMirror_td]:border-border',
              '[&_.ProseMirror_th]:border-border'
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
})
