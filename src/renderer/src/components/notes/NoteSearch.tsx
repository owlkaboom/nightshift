/**
 * Search input component for notes with instant results
 */

import { useState, useEffect, useCallback } from 'react'
import type { Note } from '@shared/types'
import { Input } from '@/components/ui/input'
import { Search, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks'

interface NoteSearchProps {
  onSearch: (query: string) => Promise<Note[]>
  onResultClick?: (note: Note) => void
  placeholder?: string
  className?: string
  showResults?: boolean
}

export function NoteSearch({
  onSearch,
  onResultClick,
  placeholder = 'Search notes...',
  className,
  showResults = true
}: NoteSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const searchResults = await onSearch(searchQuery)
      setResults(searchResults)
    } catch (error) {
      console.error('Search failed:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [onSearch])

  useEffect(() => {
    performSearch(debouncedQuery)
  }, [debouncedQuery, performSearch])

  const handleClear = useCallback(() => {
    setQuery('')
    setResults([])
  }, [])

  const handleResultClick = useCallback((note: Note) => {
    onResultClick?.(note)
    setFocused(false)
  }, [onResultClick])

  const showDropdown = showResults && focused && (results.length > 0 || (query && loading))

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder={placeholder}
          className="pl-9 pr-9"
        />
        {(query || loading) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Searching...
            </div>
          ) : (
            results.map((note) => (
              <button
                key={note.id}
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-accent border-b last:border-b-0 cursor-pointer"
                onClick={() => handleResultClick(note)}
              >
                <div className="font-medium text-sm truncate">{note.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {note.excerpt}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
