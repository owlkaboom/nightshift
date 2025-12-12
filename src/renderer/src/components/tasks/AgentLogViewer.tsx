import { useEffect, useRef, useMemo, useState } from 'react'
import {
  Bot,
  Cpu,
  CheckCircle2,
  XCircle,
  FileCode,
  Terminal,
  Search,
  Edit3,
  Globe,
  Wrench,
  ChevronDown,
  ChevronRight,
  Code,
  Eye,
  EyeOff
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DiffViewer } from './DiffViewer'

interface AgentLogViewerProps {
  logs: string
  isRunning?: boolean
}

interface ParsedEntry {
  id: string
  type: 'system' | 'assistant' | 'tool' | 'result' | 'raw'
  title: string
  subtitle?: string
  content?: string
  icon: React.ReactNode
  iconBg: string
  details?: Record<string, unknown>
  raw: string
  isError?: boolean
  isSuccess?: boolean
  // File operation specific fields
  filePreview?: {
    type: 'write' | 'edit' | 'read'
    filePath?: string
    content?: string
    oldContent?: string
    newContent?: string
  }
}

// Get icon for tool type
function getToolIcon(toolName: string) {
  const iconClass = 'h-4 w-4'
  switch (toolName.toLowerCase()) {
    case 'read':
      return <FileCode className={iconClass} />
    case 'edit':
    case 'write':
    case 'notebookedit':
      return <Edit3 className={iconClass} />
    case 'bash':
      return <Terminal className={iconClass} />
    case 'grep':
    case 'glob':
      return <Search className={iconClass} />
    case 'webfetch':
    case 'websearch':
      return <Globe className={iconClass} />
    default:
      return <Wrench className={iconClass} />
  }
}

// Format tool input for display
function formatToolInput(input: unknown): string {
  if (!input) return ''
  if (typeof input === 'string') return input

  const obj = input as Record<string, unknown>

  // Special handling for common tools
  if (obj.file_path) return String(obj.file_path)
  if (obj.command) return String(obj.command)
  if (obj.pattern && obj.path) return `${obj.pattern} in ${obj.path}`
  if (obj.pattern) return String(obj.pattern)
  if (obj.query) return String(obj.query)
  if (obj.url) return String(obj.url)

  // Fallback: show first meaningful value
  const keys = Object.keys(obj).filter(k => obj[k] && typeof obj[k] !== 'object')
  if (keys.length > 0) {
    return String(obj[keys[0]])
  }

  return ''
}

// Parse logs into structured entries
function parseEntries(logs: string): ParsedEntry[] {
  if (!logs) return []

  const lines = logs.split('\n')
  const entries: ParsedEntry[] = []
  let entryIndex = 0
  let promptLines: string[] = []
  let inPrompt = false

  // Helper to flush collected prompt lines as a single entry
  const flushPrompt = () => {
    if (promptLines.length > 0) {
      const fullPrompt = promptLines.join('\n')
      entries.push({
        id: `prompt-${entryIndex++}`,
        type: 'system',
        title: 'Task Prompt',
        content: fullPrompt,
        icon: <Bot className="h-4 w-4" />,
        iconBg: 'bg-indigo-600',
        raw: `Prompt: ${fullPrompt}`
      })
      promptLines = []
      inPrompt = false
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Handle empty lines
    if (!trimmed) {
      // Empty line ends prompt collection (prompts are followed by \n\n)
      if (inPrompt) {
        flushPrompt()
      }
      continue
    }

    // Try to parse as JSON first - JSON entries always end prompt collection
    try {
      const json = JSON.parse(trimmed)
      flushPrompt() // Flush any pending prompt before processing JSON
      const entry = parseJsonEntry(json, trimmed, entryIndex++)
      if (entry) {
        entries.push(entry)
      }
      continue
    } catch {
      // Not JSON, continue with text parsing
    }

    // Check for our custom log format [timestamp] [type] message
    const match = trimmed.match(/^\[([^\]]+)\] \[([^\]]+)\] (.+)$/)
    if (match) {
      flushPrompt()
      continue
    }

    // Skip separator lines
    if (trimmed.startsWith('===') || trimmed.startsWith('Working directory:')) {
      flushPrompt()
      continue
    }

    // Start collecting prompt lines
    if (trimmed.startsWith('Prompt:')) {
      flushPrompt() // Flush any previous prompt
      inPrompt = true
      // Extract the text after "Prompt: "
      const promptText = trimmed.replace(/^Prompt:\s*/, '')
      if (promptText) {
        promptLines.push(promptText)
      }
      continue
    }

    // If we're collecting prompt lines, add this line
    if (inPrompt) {
      promptLines.push(trimmed)
      continue
    }

    // Skip empty-ish lines that are just whitespace or very short
    if (trimmed.length < 3) {
      continue
    }

    // Raw text entry - but try to group consecutive raw lines
    // For now, just add them individually but they should be rare
    entries.push({
      id: `raw-${entryIndex++}`,
      type: 'raw',
      title: trimmed.length > 100 ? trimmed.slice(0, 100) + '...' : trimmed,
      icon: <Terminal className="h-4 w-4" />,
      iconBg: 'bg-zinc-700',
      raw: trimmed
    })
  }

  // Flush any remaining prompt at the end
  flushPrompt()

  return entries
}

function parseJsonEntry(json: Record<string, unknown>, raw: string, index: number): ParsedEntry | null {
  const type = json.type as string

  switch (type) {
    case 'system': {
      if (json.subtype === 'init') {
        const model = json.model as string || 'Unknown'
        const tools = json.tools as string[] || []
        return {
          id: `system-${index}`,
          type: 'system',
          title: 'Session Started',
          subtitle: model,
          content: `${tools.length} tools available`,
          icon: <Cpu className="h-4 w-4" />,
          iconBg: 'bg-blue-600',
          details: json,
          raw
        }
      }
      return null
    }

    case 'assistant': {
      const message = json.message as Record<string, unknown>
      const content = message?.content as Array<{ type: string; text?: string; name?: string; input?: unknown }> | undefined

      if (!content || !Array.isArray(content)) return null

      // Extract text content and tool uses
      const textParts: string[] = []
      const toolUses: { name: string; input: unknown }[] = []

      for (const block of content) {
        if (block.type === 'text' && block.text) {
          textParts.push(block.text)
        } else if (block.type === 'tool_use' && block.name) {
          toolUses.push({ name: block.name, input: block.input })
        }
      }

      // If there are tool uses, create entries for each
      const entries: ParsedEntry[] = []

      if (textParts.length > 0) {
        const fullText = textParts.join('\n')
        entries.push({
          id: `assistant-${index}`,
          type: 'assistant',
          title: 'Claude',
          content: fullText,
          icon: <Bot className="h-4 w-4" />,
          iconBg: 'bg-violet-600',
          details: json,
          raw
        })
      }

      for (let i = 0; i < toolUses.length; i++) {
        const tool = toolUses[i]
        const input = tool.input as Record<string, unknown>

        // Extract file preview for file operations
        let filePreview: ParsedEntry['filePreview'] | undefined
        const toolName = tool.name.toLowerCase()

        if (toolName === 'write' && input) {
          filePreview = {
            type: 'write',
            filePath: String(input.file_path || ''),
            content: String(input.content || '')
          }
        } else if (toolName === 'edit' && input) {
          filePreview = {
            type: 'edit',
            filePath: String(input.file_path || ''),
            oldContent: String(input.old_string || ''),
            newContent: String(input.new_string || '')
          }
        } else if (toolName === 'read' && input) {
          filePreview = {
            type: 'read',
            filePath: String(input.file_path || '')
          }
        }

        entries.push({
          id: `tool-${index}-${i}`,
          type: 'tool',
          title: tool.name,
          subtitle: formatToolInput(tool.input),
          icon: getToolIcon(tool.name),
          iconBg: 'bg-amber-600',
          details: { name: tool.name, input: tool.input },
          raw: JSON.stringify(tool, null, 2),
          filePreview
        })
      }

      // Return first entry (we'll handle multiple in a different way if needed)
      return entries[0] || null
    }

    case 'result': {
      const isError = json.is_error === true
      const success = json.subtype === 'success'
      const durationMs = json.duration_ms as number | undefined
      const cost = json.total_cost_usd as number | undefined
      const result = json.result as string | undefined
      const numTurns = json.num_turns as number | undefined

      const parts: string[] = []
      if (durationMs) parts.push(`${(durationMs / 1000).toFixed(1)}s`)
      if (cost) parts.push(`$${cost.toFixed(4)}`)
      if (numTurns) parts.push(`${numTurns} turns`)

      return {
        id: `result-${index}`,
        type: 'result',
        title: isError ? 'Task Failed' : success ? 'Task Completed' : 'Task Finished',
        subtitle: parts.join(' • '),
        content: result,
        icon: isError ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />,
        iconBg: isError ? 'bg-red-600' : 'bg-green-600',
        details: json,
        raw,
        isError,
        isSuccess: success && !isError
      }
    }

    default:
      return null
  }
}

// Individual log entry card
function LogEntryCard({ entry, isExpanded, onToggle }: {
  entry: ParsedEntry
  isExpanded: boolean
  onToggle: () => void
}) {
  const [showRaw, setShowRaw] = useState(false)

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden transition-colors',
        entry.isError && 'border-red-500/30 bg-red-500/5',
        entry.isSuccess && 'border-green-500/30 bg-green-500/5',
        !entry.isError && !entry.isSuccess && 'border-border bg-card'
      )}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
      >
        <div className={cn('p-1.5 rounded', entry.iconBg)}>
          {entry.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{entry.title}</span>
            {entry.subtitle && (
              <span className="text-xs text-muted-foreground truncate">
                {entry.subtitle}
              </span>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border">
          {/* Main content */}
          {entry.content && (
            <div className="p-3 text-sm whitespace-pre-wrap max-h-[400px] overflow-auto">
              {entry.content}
            </div>
          )}

          {/* File Preview */}
          {entry.filePreview && (
            <div className="border-t border-border">
              {/* Write operation preview */}
              {entry.filePreview.type === 'write' && entry.filePreview.content && (
                <div className="px-3 pb-3">
                  <DiffViewer
                    oldContent=""
                    newContent={entry.filePreview.content}
                    fileName={entry.filePreview.filePath}
                  />
                </div>
              )}

              {/* Edit operation preview */}
              {entry.filePreview.type === 'edit' && (entry.filePreview.oldContent || entry.filePreview.newContent) && (
                <div className="px-3 pb-3">
                  <DiffViewer
                    oldContent={entry.filePreview.oldContent || ''}
                    newContent={entry.filePreview.newContent || ''}
                    fileName={entry.filePreview.filePath}
                  />
                </div>
              )}

              {/* Read operation preview */}
              {entry.filePreview.type === 'read' && entry.filePreview.filePath && (
                <div className="bg-muted/20">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                    <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Reading: {entry.filePreview.filePath}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Raw toggle */}
          <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                setShowRaw(!showRaw)
              }}
            >
              {showRaw ? (
                <>
                  <EyeOff className="h-3 w-3 mr-1" />
                  Hide Raw
                </>
              ) : (
                <>
                  <Code className="h-3 w-3 mr-1" />
                  View Raw
                </>
              )}
            </Button>
          </div>

          {/* Raw JSON */}
          {showRaw && (
            <div className="border-t border-border bg-zinc-900 p-3 overflow-x-auto">
              <pre className="text-xs font-mono text-zinc-400">
                {entry.raw}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function AgentLogViewer({ logs, isRunning }: AgentLogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rawContainerRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [showAllRaw, setShowAllRaw] = useState(false)

  // Parse all log entries and reverse order (newest first)
  const entries = useMemo(() => parseEntries(logs).reverse(), [logs])


  // Auto-scroll to top when logs change (since newest entries are first)
  useEffect(() => {
    if (!shouldAutoScroll.current) return

    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      const container = showAllRaw ? rawContainerRef.current : containerRef.current
      if (container) {
        container.scrollTop = 0
      }
    })
  }, [logs, entries, showAllRaw])

  // Track scroll position to determine if we should auto-scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget
    // If user is within 100px of top, enable auto-scroll
    // Otherwise, they've scrolled down to read something, so disable it
    shouldAutoScroll.current = scrollTop <= 100
  }

  const toggleEntry = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedIds(new Set(entries.map(e => e.id)))
  }

  const collapseAll = () => {
    setExpandedIds(new Set())
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        <div className="text-center">
          <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Waiting for output...</p>
          <p className="text-xs mt-1">Logs will appear here once the agent starts</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="text-xs text-muted-foreground">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={expandAll}>
            <Eye className="h-3 w-3 mr-1" />
            Expand All
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={collapseAll}>
            <EyeOff className="h-3 w-3 mr-1" />
            Collapse All
          </Button>
          <Button
            variant={showAllRaw ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowAllRaw(!showAllRaw)}
          >
            <Code className="h-3 w-3 mr-1" />
            Raw Mode
          </Button>
        </div>
      </div>

      {/* Content */}
      {showAllRaw ? (
        <div
          ref={rawContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto p-4 bg-zinc-900"
        >
          <pre className="text-xs font-mono text-zinc-400 whitespace-pre-wrap">
            {logs}
          </pre>
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto p-4 space-y-2"
        >
          {entries.map(entry => (
            <LogEntryCard
              key={entry.id}
              entry={entry}
              isExpanded={expandedIds.has(entry.id)}
              onToggle={() => toggleEntry(entry.id)}
            />
          ))}

          {isRunning && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>Agent is running...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
