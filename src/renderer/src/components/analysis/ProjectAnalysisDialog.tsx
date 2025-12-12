/**
 * ProjectAnalysisDialog component
 *
 * Main dialog for analyzing a project to detect technologies
 * and suggest skills.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { useAnalysisStore } from '@/stores'
import { TechnologyBadges } from './TechnologyBadges'
import { SkillRecommendationList } from './SkillRecommendationCard'
import type { Project } from '@shared/types'
import {
  Loader2,
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lightbulb,
  Code2,
  FileText
} from 'lucide-react'

interface ProjectAnalysisDialogProps {
  project: Project
  /** The local filesystem path to the project */
  projectPath: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSkillsCreated?: () => void
}

/**
 * ProjectAnalysisDialog component
 */
export function ProjectAnalysisDialog({
  project,
  projectPath,
  open,
  onOpenChange,
  onSkillsCreated
}: ProjectAnalysisDialogProps) {
  const [activeTab, setActiveTab] = useState<'technologies' | 'recommendations'>('technologies')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isCreatingSkills, setIsCreatingSkills] = useState(false)
  const [createdCount, setCreatedCount] = useState(0)

  const {
    analyzeProject,
    getAnalysis,
    createSkillsFromRecommendations,
    clearCache,
    setupListeners
  } = useAnalysisStore()

  // Get analysis state for this project
  const analysisState = getAnalysis(project.id)
  const analysis = analysisState?.analysis
  const isLoading = analysisState?.loading ?? false
  const error = analysisState?.error ?? null
  const progress = analysisState?.progress

  // Setup listeners on mount
  useEffect(() => {
    setupListeners()
  }, [setupListeners])

  // Start analysis when dialog opens
  useEffect(() => {
    if (open && !analysis && !isLoading && projectPath) {
      analyzeProject(project.id, projectPath)
    }
  }, [open, project.id, projectPath, analysis, isLoading, analyzeProject])

  // Reset selection when analysis changes
  useEffect(() => {
    if (analysis) {
      // Auto-select high priority recommendations
      const highPriorityIds = analysis.recommendations
        .filter((r) => r.priority === 'high')
        .map((r) => r.id)
      setSelectedIds(new Set(highPriorityIds))
    }
  }, [analysis])

  const handleSelectionChange = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (analysis) {
      setSelectedIds(new Set(analysis.recommendations.map((r) => r.id)))
    }
  }, [analysis])

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleRefresh = useCallback(async () => {
    if (!projectPath) return
    await clearCache(project.id)
    await analyzeProject(project.id, projectPath)
  }, [project.id, projectPath, clearCache, analyzeProject])

  const handleCreateSkills = useCallback(async () => {
    if (selectedIds.size === 0 || !projectPath) return

    setIsCreatingSkills(true)
    try {
      const skills = await createSkillsFromRecommendations(project.id, projectPath, Array.from(selectedIds))
      setCreatedCount(skills.length)
      onSkillsCreated?.()
    } catch (err) {
      console.error('Failed to create skills:', err)
    } finally {
      setIsCreatingSkills(false)
    }
  }, [project.id, projectPath, selectedIds, createSkillsFromRecommendations, onSkillsCreated])

  // Sorted recommendations by priority
  const sortedRecommendations = useMemo(() => {
    if (!analysis) return []
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return [...analysis.recommendations].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    )
  }, [analysis])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] max-h-[95vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Analyze Project for Skills
          </DialogTitle>
          <DialogDescription>
            Detect technologies and patterns to suggest appropriate Claude Code skills for{' '}
            <span className="font-medium">{project.name}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Progress or Error */}
          {isLoading && progress && (
            <div className="space-y-2 py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress.message}
              </div>
              <Progress value={progress.progress} />
            </div>
          )}

          {/* Error message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Analysis Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success message after creating skills */}
          {createdCount > 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Skills Created</AlertTitle>
              <AlertDescription>
                Successfully created {createdCount} skill{createdCount !== 1 ? 's' : ''} in the
                project's <code className="text-xs bg-muted px-1 rounded">.claude/skills/</code>{' '}
                directory.
              </AlertDescription>
            </Alert>
          )}

          {/* Analysis Results */}
          {analysis && !isLoading && (
            <>
              {/* Summary */}
              {analysis.summary && (
                <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                  {analysis.summary}
                </div>
              )}

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mt-4">
                <div className="flex items-center justify-between sticky top-0 bg-background z-10 pb-3">
                  <TabsList>
                    <TabsTrigger value="technologies" className="gap-1.5">
                      <Code2 className="h-4 w-4" />
                      Technologies
                      <span className="text-xs text-muted-foreground ml-1">
                        ({analysis.technologies.length})
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="recommendations" className="gap-1.5">
                      <Lightbulb className="h-4 w-4" />
                      Skill Suggestions
                      <span className="text-xs text-muted-foreground ml-1">
                        ({analysis.recommendations.length})
                      </span>
                    </TabsTrigger>
                  </TabsList>

                  <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Re-analyze
                  </Button>
                </div>

                <Separator className="mb-4" />

                <TabsContent value="technologies" className="mt-0">
                  <TechnologyBadges technologies={analysis.technologies} showCategories />

                  {/* Patterns */}
                  {analysis.patterns.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                        <FileText className="h-4 w-4" />
                        Detected Patterns
                      </h4>
                      <div className="space-y-2">
                        {analysis.patterns.map((pattern) => (
                          <div
                            key={pattern.id}
                            className="p-3 bg-muted/50 rounded-md"
                          >
                            <div className="font-medium text-sm">{pattern.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {pattern.description}
                            </div>
                            {pattern.examples.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Examples: {pattern.examples.slice(0, 3).join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="recommendations" className="mt-0">
                  <SkillRecommendationList
                    recommendations={sortedRecommendations}
                    selectedIds={selectedIds}
                    onSelectionChange={handleSelectionChange}
                    onSelectAll={handleSelectAll}
                    onDeselectAll={handleDeselectAll}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {analysis && activeTab === 'recommendations' && (
            <Button
              onClick={handleCreateSkills}
              disabled={selectedIds.size === 0 || isCreatingSkills}
            >
              {isCreatingSkills ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Create {selectedIds.size} Skill{selectedIds.size !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
