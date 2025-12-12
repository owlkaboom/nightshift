/**
 * SkillSuggestions - AI-powered skill recommendations based on project analysis
 *
 * Allows users to:
 * - Select a project to analyze
 * - View detected technologies and patterns
 * - Review skill recommendations
 * - Enable recommended skills
 */

import { useState, useCallback, useEffect } from 'react'
import { Sparkles, RefreshCw, Check, Plus, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useProjectStore, useSkillStore } from '@/stores'
import type { SkillRecommendation, ProjectAnalysis } from '@shared/types'

interface SkillSuggestionsProps {
  onSkillCreated?: () => void
}

/**
 * AI Suggestions component for skill recommendations
 *
 * Uses the existing project-analyzer.ts infrastructure to analyze projects
 * and generate skill recommendations based on detected technologies and patterns.
 */
export function SkillSuggestions({ onSkillCreated }: SkillSuggestionsProps) {
  const { projects } = useProjectStore()
  const { skills, createSkill } = useSkillStore()

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creatingSkills, setCreatingSkills] = useState<Set<string>>(new Set())

  // Reset state when project changes
  useEffect(() => {
    setAnalysis(null)
    setError(null)
  }, [selectedProjectId])

  /**
   * Analyze the selected project to get skill recommendations
   */
  const handleAnalyze = useCallback(async () => {
    if (!selectedProjectId) return

    setAnalyzing(true)
    setError(null)

    try {
      // Get the project path
      const projectPath = await window.api.getProjectPath(selectedProjectId)
      if (!projectPath) {
        setError('Project has no local path configured')
        return
      }

      const result = await window.api.analyzeProject(selectedProjectId, projectPath)
      setAnalysis(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze project')
      console.error('Analysis error:', err)
    } finally {
      setAnalyzing(false)
    }
  }, [selectedProjectId])

  /**
   * Create a skill from a recommendation
   */
  const handleCreateSkill = useCallback(async (recommendation: SkillRecommendation) => {
    setCreatingSkills(prev => new Set(prev).add(recommendation.id))

    try {
      // Check if skill with this name already exists
      const existingSkill = skills.find(
        s => s.name.toLowerCase() === recommendation.name.toLowerCase()
      )

      if (existingSkill) {
        setError(`Skill "${recommendation.name}" already exists`)
        return
      }

      // Create the skill
      await createSkill({
        name: recommendation.name,
        description: recommendation.description,
        prompt: recommendation.suggestedPrompt,
        category: 'coding', // Default category, can be refined
        icon: '⚡', // Default icon
        enabled: true
      })

      onSkillCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create skill')
      console.error('Create skill error:', err)
    } finally {
      setCreatingSkills(prev => {
        const next = new Set(prev)
        next.delete(recommendation.id)
        return next
      })
    }
  }, [skills, createSkill, onSkillCreated])

  return (
    <div className="space-y-6">
      {/* Project selection */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">AI Skill Suggestions</h2>
          <p className="text-sm text-muted-foreground">
            Analyze a project to get AI-powered skill recommendations based on detected technologies and patterns.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Select
              value={selectedProjectId ?? ''}
              onValueChange={(value) => setSelectedProjectId(value || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project to analyze..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={!selectedProjectId || analyzing}
          >
            {analyzing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Analyze
              </>
            )}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Analysis results */}
      {analysis && (
        <div className="space-y-6">
          {/* Summary */}
          {analysis.summary && (
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-medium mb-2">Analysis Summary</h3>
              <p className="text-sm text-muted-foreground">{analysis.summary}</p>
            </div>
          )}

          {/* Technologies */}
          {analysis.technologies.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Detected Technologies</h3>
              <div className="flex flex-wrap gap-2">
                {analysis.technologies
                  .sort((a, b) => b.confidence - a.confidence)
                  .map((tech) => (
                    <Badge
                      key={tech.name}
                      variant={tech.confidence >= 0.8 ? 'default' : 'secondary'}
                      className="gap-2"
                    >
                      {tech.name}
                      <span className="text-xs opacity-70">
                        {Math.round(tech.confidence * 100)}%
                      </span>
                    </Badge>
                  ))}
              </div>
            </div>
          )}

          {/* Patterns */}
          {analysis.patterns.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Detected Patterns</h3>
              <div className="space-y-2">
                {analysis.patterns
                  .sort((a, b) => b.confidence - a.confidence)
                  .map((pattern) => (
                    <div
                      key={pattern.name}
                      className="p-3 bg-muted rounded-lg flex items-start justify-between"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{pattern.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {pattern.description}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {Math.round(pattern.confidence * 100)}%
                      </Badge>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">
                Skill Recommendations ({analysis.recommendations.length})
              </h3>
              <div className="space-y-3">
                {analysis.recommendations
                  .sort((a, b) => {
                    // Sort by priority (high > medium > low)
                    const priorityOrder = { high: 3, medium: 2, low: 1 }
                    return priorityOrder[b.priority] - priorityOrder[a.priority]
                  })
                  .map((rec) => {
                    const skillExists = skills.some(
                      s => s.name.toLowerCase() === rec.name.toLowerCase()
                    )
                    const isCreating = creatingSkills.has(rec.id)

                    return (
                      <div
                        key={rec.id}
                        className="p-4 bg-card border rounded-lg space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{rec.name}</h4>
                              <Badge
                                variant={
                                  rec.priority === 'high'
                                    ? 'default'
                                    : rec.priority === 'medium'
                                      ? 'secondary'
                                      : 'outline'
                                }
                              >
                                {rec.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {rec.description}
                            </p>
                            {rec.reason && (
                              <p className="text-xs text-muted-foreground mt-2">
                                <strong>Why:</strong> {rec.reason}
                              </p>
                            )}
                          </div>

                          <Button
                            size="sm"
                            onClick={() => handleCreateSkill(rec)}
                            disabled={skillExists || isCreating}
                          >
                            {skillExists ? (
                              <>
                                <Check className="h-4 w-4 mr-2" />
                                Added
                              </>
                            ) : isCreating ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Adding...
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4 mr-2" />
                                Add
                              </>
                            )}
                          </Button>
                        </div>

                        {rec.basedOn && rec.basedOn.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {rec.basedOn.map((tech) => (
                              <Badge key={tech} variant="outline" className="text-xs">
                                {tech}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {analysis.recommendations.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              No skill recommendations found for this project.
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!analysis && !analyzing && (
        <div className="text-center text-sm text-muted-foreground py-12">
          <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a project and click Analyze to get skill recommendations</p>
        </div>
      )}
    </div>
  )
}
