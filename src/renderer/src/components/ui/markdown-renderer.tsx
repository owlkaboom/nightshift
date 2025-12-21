import { memo } from 'react'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { cn } from '@/lib/utils'
import { isMarkdown } from '@/lib/markdown-to-html'

interface MarkdownRendererProps {
  content: string
  className?: string
  /**
   * Number of lines to clamp (for truncation in card views)
   */
  lineClamp?: number
  /**
   * Maximum height for scrollable containers
   */
  maxHeight?: string
}

/**
 * Detects if a string contains HTML tags.
 */
function isHtml(text: string): boolean {
  if (!text || text.trim().length === 0) return false
  return /<[^>]+>/.test(text)
}

/**
 * Renders text content using the RichTextEditor in read-only mode.
 * Automatically detects if content is Markdown, HTML, or plain text and renders accordingly.
 * Falls back to plain text with whitespace preservation if not Markdown or HTML.
 */
export const MarkdownRenderer = memo<MarkdownRendererProps>(
  ({ content, className, lineClamp, maxHeight }) => {
    const hasHtml = isHtml(content)
    const hasMarkdown = isMarkdown(content)

    // Calculate max-height based on lineClamp (assuming ~1.5rem per line)
    const computedMaxHeight = lineClamp ? `${lineClamp * 1.5}rem` : maxHeight

    // For HTML or Markdown content, use RichTextEditor in read-only mode
    if (hasHtml || hasMarkdown) {
      return (
        <div
          className={cn(
            'markdown-renderer-wrapper',
            lineClamp && 'overflow-hidden',
            maxHeight && !lineClamp && 'overflow-y-auto scrollbar-autohide',
            className
          )}
          style={{
            ...(computedMaxHeight ? { maxHeight: computedMaxHeight } : {}),
            ...(lineClamp
              ? {
                  display: '-webkit-box',
                  WebkitLineClamp: lineClamp,
                  WebkitBoxOrient: 'vertical' as const,
                  overflow: 'hidden'
                }
              : {})
          }}
        >
          <RichTextEditor
            content={content}
            editable={false}
            showToolbar={false}
            variant="minimal"
            className={cn(
              // Remove border and padding from the editor container
              '!border-0 !rounded-none !bg-transparent',
              // Reduce padding to minimal
              '[&_.ProseMirror]:!p-0',
              // Tighter spacing for read-only view
              '[&_.ProseMirror>*]:!mb-2',
              '[&_.ProseMirror>*:last-child]:!mb-0',
              // Zero out heading margins
              '[&_.ProseMirror>h1]:!mt-0',
              '[&_.ProseMirror>h2]:!mt-0',
              '[&_.ProseMirror>h3]:!mt-0',
              '[&_.ProseMirror>h4]:!mt-0',
              '[&_.ProseMirror>h5]:!mt-0',
              '[&_.ProseMirror>h6]:!mt-0',
              '[&_.ProseMirror>h1]:!mb-2',
              '[&_.ProseMirror>h2]:!mb-2',
              '[&_.ProseMirror>h3]:!mb-2',
              '[&_.ProseMirror>h4]:!mb-2',
              '[&_.ProseMirror>h5]:!mb-2',
              '[&_.ProseMirror>h6]:!mb-2',
              // Override minimal variant padding
              '!px-0 !py-0'
            )}
            minHeight="auto"
            maxHeight={computedMaxHeight}
          />
        </div>
      )
    }

    // Plain text fallback
    return (
      <p
        className={cn(
          'whitespace-pre-wrap overflow-x-hidden break-words',
          lineClamp && 'overflow-hidden',
          maxHeight && !lineClamp && 'overflow-y-auto scrollbar-autohide',
          className
        )}
        style={{
          ...(computedMaxHeight ? { maxHeight: computedMaxHeight } : {}),
          ...(lineClamp
            ? {
                display: '-webkit-box',
                WebkitLineClamp: lineClamp,
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden'
              }
            : {})
        }}
      >
        {content}
      </p>
    )
  }
)

MarkdownRenderer.displayName = 'MarkdownRenderer'
