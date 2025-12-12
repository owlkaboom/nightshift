/**
 * SkillImport - Import skills from GitHub repositories
 *
 * Allows users to:
 * - Paste a GitHub URL
 * - Fetch skill files from the repository
 * - Preview skills before importing
 * - Selectively import skills
 */

import { useState, useCallback } from 'react'
import { Github, Download, RefreshCw, Check, AlertCircle, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { useSkillStore } from '@/stores'

interface FetchedSkill {
  name: string
  description: string
  prompt: string
  path: string
}

interface SkillImportProps {
  onSkillsImported?: () => void
}

/**
 * GitHub Import component for fetching and importing skills
 *
 * Fetches .md files from GitHub repos and parses them as skills.
 * Expected file format:
 * - First line: # Skill Name
 * - Second paragraph: Description
 * - Remaining content: Prompt
 */
export function SkillImport({ onSkillsImported }: SkillImportProps) {
  const { skills, createSkill } = useSkillStore()

  const [githubUrl, setGithubUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchedSkills, setFetchedSkills] = useState<FetchedSkill[]>([])
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  /**
   * Validate GitHub URL format
   */
  const isValidGithubUrl = useCallback((url: string): boolean => {
    try {
      const parsed = new URL(url)
      return parsed.hostname === 'github.com' && parsed.pathname.split('/').length >= 3
    } catch {
      return false
    }
  }, [])

  /**
   * Fetch skills from GitHub repository
   */
  const handleFetch = useCallback(async () => {
    if (!githubUrl.trim()) {
      setError('Please enter a GitHub URL')
      return
    }

    if (!isValidGithubUrl(githubUrl)) {
      setError('Invalid GitHub URL. Please enter a valid repository URL.')
      return
    }

    setFetching(true)
    setError(null)
    setSuccess(null)
    setFetchedSkills([])
    setSelectedSkills(new Set())

    try {
      const result = await window.api.fetchGithubSkills(githubUrl)
      setFetchedSkills(result)

      if (result.length === 0) {
        setError('No skill files found in this repository')
      } else {
        setSuccess(`Found ${result.length} skill${result.length === 1 ? '' : 's'}`)
        // Auto-select all skills
        setSelectedSkills(new Set(result.map((_, index) => index.toString())))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch skills from GitHub')
      console.error('Fetch error:', err)
    } finally {
      setFetching(false)
    }
  }, [githubUrl, isValidGithubUrl])

  /**
   * Toggle skill selection
   */
  const handleToggleSkill = useCallback((index: number) => {
    setSelectedSkills(prev => {
      const next = new Set(prev)
      const key = index.toString()
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  /**
   * Toggle all skills selection
   */
  const handleToggleAll = useCallback(() => {
    if (selectedSkills.size === fetchedSkills.length) {
      setSelectedSkills(new Set())
    } else {
      setSelectedSkills(new Set(fetchedSkills.map((_, index) => index.toString())))
    }
  }, [selectedSkills, fetchedSkills])

  /**
   * Import selected skills
   */
  const handleImport = useCallback(async () => {
    if (selectedSkills.size === 0) {
      setError('Please select at least one skill to import')
      return
    }

    setImporting(true)
    setError(null)
    setSuccess(null)

    try {
      let imported = 0
      let skipped = 0

      for (const indexStr of selectedSkills) {
        const index = parseInt(indexStr, 10)
        const skill = fetchedSkills[index]

        // Check if skill with this name already exists
        const exists = skills.some(
          s => s.name.toLowerCase() === skill.name.toLowerCase()
        )

        if (exists) {
          skipped++
          continue
        }

        // Create the skill
        await createSkill({
          name: skill.name,
          description: skill.description,
          prompt: skill.prompt,
          category: 'custom', // Default to custom category
          icon: '📦', // GitHub import icon
          enabled: true
        })

        imported++
      }

      if (imported > 0) {
        setSuccess(
          `Imported ${imported} skill${imported === 1 ? '' : 's'}` +
          (skipped > 0 ? `, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : '')
        )
        onSkillsImported?.()

        // Clear form after successful import
        setTimeout(() => {
          setGithubUrl('')
          setFetchedSkills([])
          setSelectedSkills(new Set())
        }, 2000)
      } else if (skipped > 0) {
        setError('All selected skills already exist')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import skills')
      console.error('Import error:', err)
    } finally {
      setImporting(false)
    }
  }, [selectedSkills, fetchedSkills, skills, createSkill, onSkillsImported])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold mb-2">GitHub Import</h2>
        <p className="text-sm text-muted-foreground">
          Import skill files from GitHub repositories. Paste a repository URL to fetch and preview skills.
        </p>
      </div>

      {/* GitHub URL input */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="github-url">GitHub Repository URL</Label>
          <div className="flex items-center gap-2">
            <Input
              id="github-url"
              type="url"
              placeholder="https://github.com/user/repo"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !fetching) {
                  handleFetch()
                }
              }}
            />
            <Button
              onClick={handleFetch}
              disabled={fetching || !githubUrl.trim()}
            >
              {fetching ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <Github className="h-4 w-4 mr-2" />
                  Fetch
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Example: https://github.com/anthropics/claude-code-skills
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Fetched skills preview */}
      {fetchedSkills.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              Preview ({selectedSkills.size} of {fetchedSkills.length} selected)
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleAll}
              >
                {selectedSkills.size === fetchedSkills.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedSkills.size === 0 || importing}
              >
                {importing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Import Selected
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {fetchedSkills.map((skill, index) => {
              const isSelected = selectedSkills.has(index.toString())
              const skillExists = skills.some(
                s => s.name.toLowerCase() === skill.name.toLowerCase()
              )

              return (
                <div
                  key={index}
                  className={`p-4 border rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-primary/5 border-primary'
                      : 'bg-card border-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleSkill(index)}
                      disabled={skillExists}
                      className="mt-1"
                    />

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <h4 className="font-medium">{skill.name}</h4>
                        {skillExists && (
                          <Badge variant="outline">Already exists</Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {skill.description}
                      </p>

                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          View prompt
                        </summary>
                        <pre className="mt-2 p-3 bg-muted rounded text-xs whitespace-pre-wrap font-mono">
                          {skill.prompt}
                        </pre>
                      </details>

                      <p className="text-xs text-muted-foreground">
                        From: {skill.path}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!fetching && fetchedSkills.length === 0 && !error && (
        <div className="text-center text-sm text-muted-foreground py-12">
          <Github className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Paste a GitHub repository URL to fetch skills</p>
        </div>
      )}
    </div>
  )
}
