/**
 * PlanReviewPanel - Display plan file content for plan mode tasks
 */

import { useState, useEffect, useMemo } from 'react'
import { FileText, ExternalLink, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PlanReviewPanelProps {
  planFilePath: string | null
  className?: string
  defaultExpanded?: boolean
}

/**
 * Simple markdown renderer for plan files
 * Handles headers, lists, code blocks, and basic formatting
 */
function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code block
    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(
        <div key={`code-${i}`} className="my-2 bg-zinc-900 rounded-md overflow-hidden">
          {language && (
            <div className="px-3 py-1 bg-zinc-800 text-xs text-zinc-400 border-b border-zinc-700">
              {language}
            </div>
          )}
          <pre className="p-3 overflow-x-auto text-sm">
            <code className="font-mono text-zinc-100">{codeLines.join('\n')}</code>
          </pre>
        </div>
      )
      i++
      continue
    }

    // Headers
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h1>
      )
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-lg font-semibold mt-3 mb-2">{line.slice(3)}</h2>
      )
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-base font-semibold mt-2 mb-1">{line.slice(4)}</h3>
      )
    }
    // List items
    else if (line.match(/^[-*]\s/)) {
      elements.push(
        <li key={`li-${i}`} className="ml-4 list-disc">{renderInlineMarkdown(line.slice(2))}</li>
      )
    } else if (line.match(/^\d+\.\s/)) {
      const match = line.match(/^(\d+)\.\s(.*)$/)
      if (match) {
        elements.push(
          <li key={`li-${i}`} className="ml-4 list-decimal">{renderInlineMarkdown(match[2])}</li>
        )
      }
    }
    // Checkbox list items
    else if (line.match(/^[-*]\s\[([ x])\]/)) {
      const checked = line.includes('[x]')
      const text = line.replace(/^[-*]\s\[([ x])\]\s*/, '')
      elements.push(
        <div key={`check-${i}`} className="flex items-center gap-2 ml-4">
          <input type="checkbox" checked={checked} readOnly className="rounded" />
          <span className={checked ? 'line-through text-muted-foreground' : ''}>
            {renderInlineMarkdown(text)}
          </span>
        </div>
      )
    }
    // Empty lines
    else if (!line.trim()) {
      elements.push(<div key={`br-${i}`} className="h-2" />)
    }
    // Regular paragraphs
    else {
      elements.push(
        <p key={`p-${i}`} className="my-1">{renderInlineMarkdown(line)}</p>
      )
    }

    i++
  }

  return elements
}

/**
 * Render inline markdown (bold, italic, code)
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  // Handle bold
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g)

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1 py-0.5 bg-muted rounded text-sm font-mono">
          {part.slice(1, -1)}
        </code>
      )
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

export function PlanReviewPanel({ planFilePath, className = '', defaultExpanded = true }: PlanReviewPanelProps) {
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  useEffect(() => {
    async function loadPlanFile() {
      if (!planFilePath) {
        setContent(null)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const fileContent = await window.api.readPlanFile(planFilePath)
        setContent(fileContent)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load plan file')
      } finally {
        setIsLoading(false)
      }
    }

    loadPlanFile()
  }, [planFilePath])

  const handleCopyContent = async () => {
    if (!content) return

    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy plan content:', err)
    }
  }

  const handleOpenFile = async () => {
    if (!planFilePath) return
    await window.api.openPath(planFilePath)
  }

  const renderedContent = useMemo(() => {
    if (!content) return null
    return renderMarkdown(content)
  }, [content])

  if (!planFilePath) {
    return null
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`p-4 text-sm text-destructive ${className}`}>
        <p>Failed to load plan file: {error}</p>
        <p className="text-muted-foreground mt-1 text-xs">{planFilePath}</p>
      </div>
    )
  }

  return (
    <div className={`flex flex-col border-b border-border ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors w-full text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        )}
        <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          Plan Output
        </span>
        <span className="text-xs text-blue-600/70 dark:text-blue-400/70 truncate flex-1">
          {planFilePath.split('/').pop()}
        </span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={handleCopyContent}
            title="Copy plan content"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={handleOpenFile}
            title="Open in default editor"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 bg-muted/20 max-h-96 overflow-auto">
          {renderedContent ? (
            <div className="text-sm">{renderedContent}</div>
          ) : (
            <p className="text-sm text-muted-foreground">No plan content available</p>
          )}
        </div>
      )}
    </div>
  )
}
