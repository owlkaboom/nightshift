/**
 * Utility to convert markdown text to HTML that TipTap can parse
 *
 * This handles:
 * - Headers (# ## ###)
 * - Bold (**text** or __text__)
 * - Italic (*text* or _text_)
 * - Inline code (`code`)
 * - Lists (- or * or 1.)
 * - Links ([text](url))
 * - Code blocks (```lang\ncode\n```)
 * - Blockquotes (> text)
 */

/**
 * Converts markdown text to HTML compatible with TipTap editor
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || markdown.trim() === '') {
    return ''
  }

  // Check if it's already HTML (has tags)
  if (/<[^>]+>/.test(markdown)) {
    return markdown
  }

  let html = markdown

  // Split into blocks (paragraphs separated by blank lines)
  const blocks = html.split(/\n\n+/)

  const processedBlocks = blocks.map(block => {
    const trimmedBlock = block.trim()
    if (!trimmedBlock) return ''

    // Code blocks (```lang...```)
    if (trimmedBlock.startsWith('```')) {
      const lines = trimmedBlock.split('\n')
      const lang = lines[0].replace(/```/, '').trim()
      const code = lines.slice(1, -1).join('\n')
      return `<pre><code${lang ? ` class="language-${lang}"` : ''}>${escapeHtml(code)}</code></pre>`
    }

    // Headers (# ## ### etc)
    const headerMatch = trimmedBlock.match(/^(#{1,6})\s+(.+)$/m)
    if (headerMatch && trimmedBlock.startsWith('#')) {
      const level = headerMatch[1].length
      const text = processInlineMarkdown(headerMatch[2])
      return `<h${level}>${text}</h${level}>`
    }

    // Blockquotes (> text)
    if (trimmedBlock.startsWith('>')) {
      const lines = trimmedBlock.split('\n')
      const quoteContent = lines
        .map(line => line.replace(/^>\s*/, ''))
        .join('\n')
      return `<blockquote><p>${processInlineMarkdown(quoteContent)}</p></blockquote>`
    }

    // Unordered lists (- or *)
    const unorderedListMatch = trimmedBlock.match(/^[-*]\s+/)
    if (unorderedListMatch) {
      const items = trimmedBlock
        .split('\n')
        .filter(line => line.match(/^[-*]\s+/))
        .map(line => {
          const content = line.replace(/^[-*]\s+/, '')
          return `<li>${processInlineMarkdown(content)}</li>`
        })
        .join('')
      return `<ul>${items}</ul>`
    }

    // Ordered lists (1. 2. etc)
    const orderedListMatch = trimmedBlock.match(/^\d+\.\s+/)
    if (orderedListMatch) {
      const items = trimmedBlock
        .split('\n')
        .filter(line => line.match(/^\d+\.\s+/))
        .map(line => {
          const content = line.replace(/^\d+\.\s+/, '')
          return `<li>${processInlineMarkdown(content)}</li>`
        })
        .join('')
      return `<ol>${items}</ol>`
    }

    // Task lists (- [ ] or - [x])
    const taskListMatch = trimmedBlock.match(/^[-*]\s+\[([ xX])\]/)
    if (taskListMatch) {
      const items = trimmedBlock
        .split('\n')
        .filter(line => line.match(/^[-*]\s+\[([ xX])\]/))
        .map(line => {
          const match = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)/)
          if (match) {
            const checked = match[1].toLowerCase() === 'x'
            const content = processInlineMarkdown(match[2])
            return `<li data-type="taskItem" data-checked="${checked}">${content}</li>`
          }
          return ''
        })
        .filter(Boolean)
        .join('')
      return `<ul data-type="taskList">${items}</ul>`
    }

    // Regular paragraph - process inline markdown
    // Handle line breaks within the block
    const processedContent = trimmedBlock
      .split('\n')
      .map(line => processInlineMarkdown(line))
      .join('<br>')

    return `<p>${processedContent}</p>`
  })

  return processedBlocks.filter(Boolean).join('')
}

/**
 * Process inline markdown (bold, italic, code, links)
 */
function processInlineMarkdown(text: string): string {
  let result = text

  // Code blocks first (so they're not processed further)
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Bold (**text** or __text__)
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>')

  // Italic (*text* or _text_) - be careful not to match already processed **
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
  result = result.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>')

  // Links ([text](url))
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  // Strikethrough (~~text~~)
  result = result.replace(/~~(.+?)~~/g, '<s>$1</s>')

  return result
}

/**
 * Escape HTML entities in code blocks
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Detect if text contains markdown syntax
 */
export function isMarkdown(text: string): boolean {
  if (!text) return false

  // Check for common markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s/m,           // Headers
    /^\s*[-*+]\s/m,         // Unordered lists
    /^\s*\d+\.\s/m,         // Ordered lists
    /```[\s\S]*?```/,       // Code blocks
    /`[^`]+`/,              // Inline code
    /\*\*[^*]+\*\*/,        // Bold
    /\*[^*]+\*/,            // Italic (single asterisk)
    /__[^_]+__/,            // Bold (underscore)
    /_[^_]+_/,              // Italic (underscore)
    /\[.+?\]\(.+?\)/,       // Links
    /^>\s/m,                // Blockquotes
    /^\s*[-*_]{3,}\s*$/m,   // Horizontal rules
  ]

  return markdownPatterns.some(pattern => pattern.test(text))
}
