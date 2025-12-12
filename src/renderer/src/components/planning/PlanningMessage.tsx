/**
 * PlanningMessage - Single message in a planning conversation
 *
 * Renders user and assistant messages with basic markdown support.
 */

import { useMemo, useState, useCallback } from 'react'
import type { PlanningMessage as PlanningMessageType } from '@shared/types'
import { cn } from '@/lib/utils'
import { User, Bot, Copy, Check, ListPlus, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PlanningMessageProps {
  /** The message to display */
  message: PlanningMessageType

  /** Whether this message is currently streaming */
  isStreaming: boolean

  /** Callback when user wants to create a task from a message section */
  onCreateTaskFromSection?: (content: string) => void

  /** Callback when user wants to view a plan file */
  onViewPlanFile?: (filePath: string) => void
}

/**
 * Code block component with copy button
 */
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <div className="relative group my-2">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
      <div className="bg-zinc-900 rounded-md overflow-hidden">
        {language && (
          <div className="px-3 py-1 bg-zinc-800 text-xs text-zinc-400 border-b border-zinc-700">
            {language}
          </div>
        )}
        <pre className="p-3 overflow-x-auto text-sm">
          <code className="font-mono text-zinc-100">{code}</code>
        </pre>
      </div>
    </div>
  )
}

/**
 * File reference component with view button
 */
function FileReference({ path, onView }: { path: string; onView?: (path: string) => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/40 transition-colors mx-0.5">
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <code className="text-xs font-mono">{path}</code>
      {onView && (
        <span
          onClick={() => onView(path)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onView(path)
            }
          }}
          className="ml-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 hover:text-blue-200 transition-colors text-xs font-medium cursor-pointer"
          title="Click to view file"
        >
          View
        </span>
      )}
    </span>
  )
}

/**
 * Common file extensions that should get a "View" button
 */
const FILE_EXTENSIONS = 'md|ts|tsx|js|jsx|json|css|html|yml|yaml|toml|xml|sh|bash|py|rb|go|rs|java|kt|swift|c|cpp|h|hpp|cs|php|vue|svelte'

/**
 * Check if a string looks like a file path with a viewable extension
 */
function isFilePath(str: string): boolean {
  const filePathRegex = new RegExp(
    `^(?:\\.\\.\\/|\\.\\/)?((?:\\.?[\\w\\-]+\\/)*[\\w\\-\\.]+\\.(?:${FILE_EXTENSIONS}))$`
  )
  return filePathRegex.test(str.trim())
}

/**
 * Format inline markdown (bold, italic, code, file references)
 */
function formatInlineMarkdown(text: string, onViewFile?: (path: string) => void): React.ReactNode {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // File reference - matches file paths in various contexts:
    // - Standalone: plans/feature.md, src/App.tsx
    // - With prefix: ./plans/feature.md, ../utils/helper.ts
    // More permissive: matches file paths after any non-alphanumeric char or at start
    const fileMatch = remaining.match(
      new RegExp(`(?:^|[^\\w\\/])((?:\\.\\.\\/|\\.\\/)?((?:\\.?[\\w\\-]+\\/)*[\\w\\-\\.]+\\.(?:${FILE_EXTENSIONS})))(?=[^\\w\\/]|$)`)
    )
    // Inline code (but not code blocks) - check if content is a file path
    const codeMatch = remaining.match(/`([^`\n]+)`/)
    // Bold
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/)
    // Italic (single asterisk, but not part of bold)
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/)

    // Find earliest match
    const matches = [
      { type: 'file', match: fileMatch, index: fileMatch?.index ?? Infinity },
      { type: 'code', match: codeMatch, index: codeMatch?.index ?? Infinity },
      { type: 'bold', match: boldMatch, index: boldMatch?.index ?? Infinity },
      { type: 'italic', match: italicMatch, index: italicMatch?.index ?? Infinity }
    ].filter((m) => m.match).sort((a, b) => a.index - b.index)

    const firstMatch = matches[0]

    if (!firstMatch || firstMatch.index === Infinity) {
      parts.push(remaining)
      break
    }

    // Add text before match
    if (firstMatch.index > 0) {
      parts.push(remaining.slice(0, firstMatch.index))
    }

    // Add formatted content
    if (firstMatch.type === 'file') {
      // For file matches, extract the captured group (index 1)
      const filePath = firstMatch.match![1]
      parts.push(
        <FileReference
          key={key++}
          path={filePath}
          onView={onViewFile}
        />
      )

      // Special handling: file regex includes opening ` in match but not closing ` (lookahead)
      // Check if match starts with backtick and if so, also consume the closing backtick
      const matchEnd = firstMatch.index + firstMatch.match![0].length
      const matchStartsWithBacktick = firstMatch.match![0].startsWith('`')
      if (matchStartsWithBacktick && remaining[matchEnd] === '`') {
        // Consume through the closing backtick
        remaining = remaining.slice(matchEnd + 1)
        continue
      }
    } else if (firstMatch.type === 'code') {
      const matchContent = firstMatch.match![1]
      // Check if the inline code content is a file path - if so, render as FileReference
      if (isFilePath(matchContent)) {
        parts.push(
          <FileReference
            key={key++}
            path={matchContent.trim()}
            onView={onViewFile}
          />
        )
      } else {
        parts.push(
          <code
            key={key++}
            className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-sm text-zinc-200"
          >
            {matchContent}
          </code>
        )
      }
    } else if (firstMatch.type === 'bold') {
      const matchContent = firstMatch.match![1]
      parts.push(
        <strong key={key++} className="font-semibold">
          {matchContent}
        </strong>
      )
    } else if (firstMatch.type === 'italic') {
      const matchContent = firstMatch.match![1]
      parts.push(
        <em key={key++} className="italic">
          {matchContent}
        </em>
      )
    }

    remaining = remaining.slice(firstMatch.index + firstMatch.match![0].length)
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}

/**
 * A content section that can be converted to a task
 */
interface ContentSection {
  content: string
  startIndex: number
  endIndex: number
}

/**
 * Detect plan-like sections in content:
 * 1. Sections with headers followed by numbered lists
 * 2. Sections that reference plan files (plans/*.md) followed by headers and lists
 */
function detectPlanSections(content: string): ContentSection[] {
  const sections: ContentSection[] = []
  const lines = content.split('\n')

  let currentSection: { header: string; lines: string[]; startIndex: number } | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check if this is a header (## or ###)
    if (line.match(/^##+ /)) {
      // Save previous section if it had list items (numbered or unnumbered)
      if (currentSection && hasListItems(currentSection.lines)) {
        sections.push({
          content: [currentSection.header, ...currentSection.lines].join('\n'),
          startIndex: currentSection.startIndex,
          endIndex: i - 1
        })
      }

      // Start new section
      currentSection = {
        header: line,
        lines: [],
        startIndex: i
      }
    } else if (currentSection) {
      // Add to current section
      currentSection.lines.push(line)
    }
  }

  // Save last section if it had list items
  if (currentSection && hasListItems(currentSection.lines)) {
    sections.push({
      content: [currentSection.header, ...currentSection.lines].join('\n'),
      startIndex: currentSection.startIndex,
      endIndex: lines.length - 1
    })
  }

  return sections
}

/**
 * Check if lines contain list items (numbered or unnumbered)
 */
function hasListItems(lines: string[]): boolean {
  return lines.some(l =>
    l.match(/^\d+\. /) ||  // Numbered list
    l.match(/^[\-\*] /)    // Unnumbered list (- or *)
  )
}

/**
 * Simple markdown renderer for assistant messages
 */
function renderMarkdown(
  content: string,
  onCreateTask?: (content: string) => void,
  onViewFile?: (path: string) => void
): React.ReactNode[] {
  const elements: React.ReactNode[] = []
  const lines = content.split('\n')
  const planSections = detectPlanSections(content)

  let inCodeBlock = false
  let codeBlockContent = ''
  let codeBlockLang = ''
  let key = 0

  // Track which lines belong to plan sections
  const sectionMap = new Map<number, ContentSection>()
  planSections.forEach(section => {
    for (let i = section.startIndex; i <= section.endIndex; i++) {
      sectionMap.set(i, section)
    }
  })

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check for code block start/end
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBlockLang = line.slice(3).trim()
        codeBlockContent = ''
      } else {
        // End of code block
        elements.push(
          <CodeBlock key={key++} code={codeBlockContent.trim()} language={codeBlockLang} />
        )
        inCodeBlock = false
        codeBlockLang = ''
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockContent += (codeBlockContent ? '\n' : '') + line
      continue
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={key++} className="h-2" />)
      continue
    }

    // Headers - add create task button if this is the start of a plan section
    const section = sectionMap.get(i)
    const isHeaderOfPlanSection = section && i === section.startIndex

    if (line.startsWith('### ')) {
      elements.push(
        <div key={key++} className="flex items-center gap-2 mt-3 mb-1 group">
          <h4 className="font-semibold text-base flex-1">
            {formatInlineMarkdown(line.slice(4), onViewFile)}
          </h4>
          {isHeaderOfPlanSection && onCreateTask && (
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
              onClick={() => onCreateTask(section.content)}
              title="Create task from this section"
            >
              <ListPlus className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Create Task</span>
            </Button>
          )}
        </div>
      )
      continue
    }
    if (line.startsWith('## ')) {
      elements.push(
        <div key={key++} className="flex items-center gap-2 mt-4 mb-2 group">
          <h3 className="font-semibold text-lg flex-1">
            {formatInlineMarkdown(line.slice(3), onViewFile)}
          </h3>
          {isHeaderOfPlanSection && onCreateTask && (
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
              onClick={() => onCreateTask(section.content)}
              title="Create task from this section"
            >
              <ListPlus className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Create Task</span>
            </Button>
          )}
        </div>
      )
      continue
    }
    if (line.startsWith('# ')) {
      elements.push(
        <div key={key++} className="flex items-center gap-2 mt-4 mb-2 group">
          <h2 className="font-bold text-xl flex-1">
            {formatInlineMarkdown(line.slice(2), onViewFile)}
          </h2>
          {isHeaderOfPlanSection && onCreateTask && (
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 px-2"
              onClick={() => onCreateTask(section.content)}
              title="Create task from this section"
            >
              <ListPlus className="h-4 w-4 mr-1" />
              <span className="text-xs">Create Task</span>
            </Button>
          )}
        </div>
      )
      continue
    }

    // List items
    if (line.match(/^[\-\*] /)) {
      elements.push(
        <div key={key++} className="flex gap-2 ml-2">
          <span className="text-muted-foreground">-</span>
          <span>{formatInlineMarkdown(line.slice(2), onViewFile)}</span>
        </div>
      )
      continue
    }

    // Numbered list items
    const numberedMatch = line.match(/^(\d+)\. /)
    if (numberedMatch) {
      elements.push(
        <div key={key++} className="flex gap-2 ml-2">
          <span className="text-muted-foreground min-w-[1.5em]">{numberedMatch[1]}.</span>
          <span>{formatInlineMarkdown(line.slice(numberedMatch[0].length), onViewFile)}</span>
        </div>
      )
      continue
    }

    // Regular paragraph
    elements.push(
      <p key={key++} className="mb-1">
        {formatInlineMarkdown(line, onViewFile)}
      </p>
    )
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockContent) {
    elements.push(
      <CodeBlock key={key++} code={codeBlockContent.trim()} language={codeBlockLang} />
    )
  }

  return elements
}

export function PlanningMessage({
  message,
  isStreaming,
  onCreateTaskFromSection,
  onViewPlanFile
}: PlanningMessageProps) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  const formattedTime = useMemo(() => {
    const date = new Date(message.timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [message.timestamp])

  const renderedContent = useMemo(() => {
    if (isUser) {
      return <p className="whitespace-pre-wrap">{message.content}</p>
    }
    return renderMarkdown(
      message.content || (isStreaming ? '...' : ''),
      isAssistant && !isStreaming ? onCreateTaskFromSection : undefined,
      onViewPlanFile
    )
  }, [message.content, isUser, isStreaming, isAssistant, onCreateTaskFromSection, onViewPlanFile])

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message content */}
      <div className={cn('flex flex-col max-w-[80%]', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-lg px-4 py-2',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}
        >
          {renderedContent}
        </div>

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground mt-1 px-1">
          {formattedTime}
          {isStreaming && isAssistant && ' (typing...)'}
        </span>
      </div>
    </div>
  )
}
