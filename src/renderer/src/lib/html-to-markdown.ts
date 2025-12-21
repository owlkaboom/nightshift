/**
 * Utility to convert HTML (from TipTap editor) back to markdown
 *
 * This handles:
 * - Headers (h1-h6)
 * - Paragraphs
 * - Bold (<strong> or <b>)
 * - Italic (<em> or <i>)
 * - Inline code (<code>)
 * - Lists (<ul>, <ol>)
 * - Task lists (TipTap format)
 * - Links (<a>)
 * - Code blocks (<pre><code>)
 * - Blockquotes (<blockquote>)
 * - Line breaks (<br>)
 */

/**
 * Converts HTML from TipTap editor to markdown
 */
export function htmlToMarkdown(html: string): string {
  if (!html || html.trim() === '') {
    return ''
  }

  // Create a temporary DOM element to parse HTML
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Process the body element
  return processNode(doc.body).trim()
}

/**
 * Process a DOM node and convert to markdown
 */
function processNode(node: Node): string {
  // Text node - return text content
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || ''
  }

  // Element node - process based on tag
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element
    const tagName = element.tagName.toLowerCase()

    switch (tagName) {
      case 'h1':
        return `# ${processChildren(element)}\n\n`
      case 'h2':
        return `## ${processChildren(element)}\n\n`
      case 'h3':
        return `### ${processChildren(element)}\n\n`
      case 'h4':
        return `#### ${processChildren(element)}\n\n`
      case 'h5':
        return `##### ${processChildren(element)}\n\n`
      case 'h6':
        return `###### ${processChildren(element)}\n\n`

      case 'p':
        const pContent = processChildren(element)
        return pContent ? `${pContent}\n\n` : '\n'

      case 'br':
        return '\n'

      case 'strong':
      case 'b':
        return `**${processChildren(element)}**`

      case 'em':
      case 'i':
        return `*${processChildren(element)}*`

      case 's':
      case 'strike':
      case 'del':
        return `~~${processChildren(element)}~~`

      case 'code':
        // Check if this is inside a pre (code block)
        if (element.parentElement?.tagName.toLowerCase() === 'pre') {
          return processChildren(element)
        }
        return `\`${processChildren(element)}\``

      case 'pre':
        const codeElement = element.querySelector('code')
        if (codeElement) {
          const code = codeElement.textContent || ''
          const lang = extractLanguage(codeElement)
          return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`
        }
        return `\`\`\`\n${element.textContent}\n\`\`\`\n\n`

      case 'a':
        const href = element.getAttribute('href') || ''
        const linkText = processChildren(element)
        return `[${linkText}](${href})`

      case 'ul':
        // Check if it's a task list
        if (element.getAttribute('data-type') === 'taskList') {
          return processTaskList(element)
        }
        return processUnorderedList(element)

      case 'ol':
        return processOrderedList(element)

      case 'li':
        // Task list item
        if (element.getAttribute('data-type') === 'taskItem') {
          const checked = element.getAttribute('data-checked') === 'true'
          const checkbox = checked ? '[x]' : '[ ]'
          return `- ${checkbox} ${processChildren(element)}\n`
        }
        // Regular list item - parent will handle the marker
        return processChildren(element)

      case 'blockquote':
        const quoteLines = processChildren(element).trim().split('\n')
        return quoteLines.map(line => `> ${line}`).join('\n') + '\n\n'

      case 'mark':
        // TipTap highlight - we can use == for highlight in some markdown flavors
        // Or just preserve the text without highlighting
        return processChildren(element)

      case 'body':
      case 'div':
      case 'span':
        // Container elements - just process children
        return processChildren(element)

      default:
        // Unknown elements - just process children
        return processChildren(element)
    }
  }

  return ''
}

/**
 * Process all children of an element
 */
function processChildren(element: Element): string {
  let result = ''
  for (const child of Array.from(element.childNodes)) {
    result += processNode(child)
  }
  return result
}

/**
 * Process an unordered list
 */
function processUnorderedList(ul: Element): string {
  let result = ''
  const items = Array.from(ul.children).filter(child => child.tagName.toLowerCase() === 'li')

  for (const item of items) {
    const content = processChildren(item).trim()
    result += `- ${content}\n`
  }

  return result + '\n'
}

/**
 * Process an ordered list
 */
function processOrderedList(ol: Element): string {
  let result = ''
  const items = Array.from(ol.children).filter(child => child.tagName.toLowerCase() === 'li')

  items.forEach((item, index) => {
    const content = processChildren(item).trim()
    result += `${index + 1}. ${content}\n`
  })

  return result + '\n'
}

/**
 * Process a task list
 */
function processTaskList(ul: Element): string {
  let result = ''
  const items = Array.from(ul.children).filter(child => child.tagName.toLowerCase() === 'li')

  for (const item of items) {
    result += processNode(item)
  }

  return result + '\n'
}

/**
 * Extract language from code block class
 */
function extractLanguage(codeElement: Element): string {
  const className = codeElement.getAttribute('class') || ''
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : ''
}

/**
 * Detect if text is HTML
 */
export function isHtml(text: string): boolean {
  if (!text) return false

  // Check for HTML tags
  return /<[^>]+>/.test(text)
}
