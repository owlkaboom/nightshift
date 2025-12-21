/**
 * ScoreBreakdown - Visual breakdown of CLAUDE.md quality score
 *
 * Shows which criteria contribute to the overall score
 */

import { CheckCircle2, Circle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClaudeMdAnalysis } from '@shared/types'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ScoreBreakdownProps {
  analysis: ClaudeMdAnalysis
  className?: string
}

interface Criterion {
  label: string
  checked: boolean
  points: number
  category: 'essential' | 'content' | 'organization'
  description: string
}

/**
 * Get all scoring criteria with their status
 */
function getCriteria(analysis: ClaudeMdAnalysis): Criterion[] {
  const criteria: Criterion[] = []

  // Base content points
  if (analysis.exists) {
    criteria.push({
      label: 'CLAUDE.md exists',
      checked: analysis.lineCount > 0,
      points: 20,
      category: 'content',
      description: 'Base points for having a CLAUDE.md file with content'
    })

    if (analysis.lineCount > 50) {
      criteria.push({
        label: 'Substantial content (50+ lines)',
        checked: true,
        points: 5,
        category: 'content',
        description: 'Additional points for detailed documentation'
      })
    }

    if (analysis.lineCount > 100) {
      criteria.push({
        label: 'Comprehensive content (100+ lines)',
        checked: true,
        points: 5,
        category: 'content',
        description: 'Bonus for very thorough documentation'
      })
    }
  }

  // Section diversity
  criteria.push({
    label: 'Multiple sections (3+)',
    checked: analysis.sectionCount >= 3,
    points: 15,
    category: 'organization',
    description: 'Well-organized with multiple topic sections'
  })

  if (analysis.sectionCount >= 5) {
    criteria.push({
      label: 'Rich structure (5+ sections)',
      checked: true,
      points: 5,
      category: 'organization',
      description: 'Comprehensive topic coverage'
    })
  }

  // Essential sections
  criteria.push({
    label: 'Quick Start guide',
    checked: analysis.hasQuickStart,
    points: 15,
    category: 'essential',
    description: 'Setup commands and getting started instructions'
  })

  criteria.push({
    label: 'Code Conventions',
    checked: analysis.hasCodeConventions,
    points: 15,
    category: 'essential',
    description: 'Coding standards and style guidelines'
  })

  criteria.push({
    label: 'Architecture Overview',
    checked: analysis.hasArchitectureInfo,
    points: 15,
    category: 'essential',
    description: 'System design and component structure (in CLAUDE.md or .claude/docs/)'
  })

  // Nice-to-have sections
  criteria.push({
    label: 'Testing Guidelines',
    checked: analysis.hasTestingGuidelines,
    points: 10,
    category: 'organization',
    description: 'Testing-related documentation including test, testing, spec, QA, quality, or coverage topics (in CLAUDE.md or .claude/docs/)'
  })

  criteria.push({
    label: 'Tech Stack',
    checked: analysis.hasTechStack,
    points: 10,
    category: 'organization',
    description: 'Technologies and key dependencies'
  })

  // Advanced organization
  criteria.push({
    label: 'Sub-files organization',
    checked: analysis.subFiles.length > 0,
    points: 10,
    category: 'organization',
    description: 'Detailed docs in .claude/docs/ directory'
  })

  return criteria
}

/**
 * Score breakdown component showing what contributes to the quality score
 */
export function ScoreBreakdown({ analysis, className }: ScoreBreakdownProps) {
  const criteria = getCriteria(analysis)
  const earnedPoints = criteria.filter(c => c.checked).reduce((sum, c) => sum + c.points, 0)

  const categories = [
    { id: 'essential', label: 'Essential Sections', color: 'text-orange-600 dark:text-orange-500' },
    { id: 'content', label: 'Content Quality', color: 'text-blue-600 dark:text-blue-500' },
    { id: 'organization', label: 'Organization', color: 'text-purple-600 dark:text-purple-500' }
  ] as const

  return (
    <div className={cn('space-y-4', className)}>
      {/* Score Summary */}
      <div className="flex items-center justify-between pb-3 border-b">
        <div>
          <h4 className="font-medium">Quality Score Breakdown</h4>
          <p className="text-sm text-muted-foreground">
            What contributes to your {analysis.qualityScore}/100 score
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{earnedPoints}/100</div>
          <div className="text-xs text-muted-foreground">
            {criteria.filter(c => c.checked).length}/{criteria.length} criteria
          </div>
        </div>
      </div>

      {/* Criteria by Category */}
      <TooltipProvider>
        <div className="space-y-4">
          {categories.map(category => {
            const categoryCriteria = criteria.filter(c => c.category === category.id)
            if (categoryCriteria.length === 0) return null

            const earnedInCategory = categoryCriteria.filter(c => c.checked).reduce((sum, c) => sum + c.points, 0)
            const maxInCategory = categoryCriteria.reduce((sum, c) => sum + c.points, 0)

            return (
              <div key={category.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className={cn('text-sm font-medium', category.color)}>
                    {category.label}
                  </h5>
                  <span className="text-xs text-muted-foreground">
                    {earnedInCategory}/{maxInCategory} pts
                  </span>
                </div>

                <div className="space-y-1.5">
                  {categoryCriteria.map((criterion, idx) => (
                    <Tooltip key={idx}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'flex items-center gap-2 p-2 rounded-md transition-colors',
                            criterion.checked
                              ? 'bg-green-50 dark:bg-green-950/20'
                              : 'bg-muted/50'
                          )}
                        >
                          {criterion.checked ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span
                            className={cn(
                              'text-sm flex-1',
                              criterion.checked
                                ? 'text-foreground'
                                : 'text-muted-foreground'
                            )}
                          >
                            {criterion.label}
                          </span>
                          <div className="flex items-center gap-1">
                            <span
                              className={cn(
                                'text-xs font-medium',
                                criterion.checked
                                  ? 'text-green-600 dark:text-green-500'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {criterion.checked ? '+' : ''}{criterion.points}
                            </span>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{criterion.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </TooltipProvider>
    </div>
  )
}
