/**
 * TechnologyBadges component
 *
 * Displays detected technologies as badges with category grouping
 * and confidence indicators.
 */

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { DetectedTechnology, TechCategory } from '@shared/types'
import { getTechCategoryLabel, groupTechnologiesByCategory } from '@shared/types'
import {
  Code2,
  Layers,
  Package,
  Wrench,
  Server,
  Database,
  Cloud,
  GitBranch
} from 'lucide-react'

interface TechnologyBadgesProps {
  technologies: DetectedTechnology[]
  showCategories?: boolean
  maxVisible?: number
  compact?: boolean
}

/**
 * Get icon for a technology category
 */
function getCategoryIcon(category: TechCategory): React.ReactNode {
  const className = 'h-3 w-3'
  switch (category) {
    case 'language':
      return <Code2 className={className} />
    case 'framework':
      return <Layers className={className} />
    case 'library':
      return <Package className={className} />
    case 'tool':
      return <Wrench className={className} />
    case 'platform':
      return <Server className={className} />
    case 'database':
      return <Database className={className} />
    case 'infrastructure':
      return <Cloud className={className} />
    case 'ci-cd':
      return <GitBranch className={className} />
    default:
      return null
  }
}

/**
 * Get badge variant based on confidence
 */
function getConfidenceVariant(confidence: number): 'default' | 'secondary' | 'outline' {
  if (confidence >= 0.9) return 'default'
  if (confidence >= 0.7) return 'secondary'
  return 'outline'
}

/**
 * Single technology badge
 */
function TechnologyBadge({
  technology,
  compact
}: {
  technology: DetectedTechnology
  compact?: boolean
}) {
  const variant = getConfidenceVariant(technology.confidence)
  const icon = getCategoryIcon(technology.category)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={variant}
          className={`gap-1 cursor-default ${compact ? 'text-xs py-0' : ''}`}
        >
          {icon}
          <span>{technology.name}</span>
          {technology.version && !compact && (
            <span className="text-muted-foreground text-xs">v{technology.version}</span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <div className="font-medium">
            {technology.name}
            {technology.version && ` v${technology.version}`}
          </div>
          <div className="text-xs text-muted-foreground">
            {getTechCategoryLabel(technology.category)} • {Math.round(technology.confidence * 100)}%
            confidence
          </div>
          {technology.signals.length > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground">Detected via: </span>
              {technology.signals.slice(0, 2).join(', ')}
              {technology.signals.length > 2 && ` +${technology.signals.length - 2} more`}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * TechnologyBadges component
 */
export function TechnologyBadges({
  technologies,
  showCategories = false,
  maxVisible = 20,
  compact = false
}: TechnologyBadgesProps) {
  // Sort by confidence
  const sortedTechnologies = useMemo(
    () => [...technologies].sort((a, b) => b.confidence - a.confidence),
    [technologies]
  )

  // Group by category if needed
  const groupedTechnologies = useMemo(
    () => (showCategories ? groupTechnologiesByCategory(sortedTechnologies) : null),
    [sortedTechnologies, showCategories]
  )

  if (technologies.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">No technologies detected</div>
    )
  }

  // Render grouped view
  if (showCategories && groupedTechnologies) {
    const categories: TechCategory[] = [
      'language',
      'framework',
      'library',
      'tool',
      'platform',
      'database',
      'infrastructure',
      'ci-cd'
    ]

    return (
      <div className="space-y-3">
        {categories.map((category) => {
          const techs = groupedTechnologies[category]
          if (techs.length === 0) return null

          return (
            <div key={category}>
              <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                {getCategoryIcon(category)}
                {getTechCategoryLabel(category)}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {techs.map((tech) => (
                  <TechnologyBadge key={tech.name} technology={tech} compact={compact} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Render flat view
  const visibleTechs = sortedTechnologies.slice(0, maxVisible)
  const remaining = sortedTechnologies.length - maxVisible

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleTechs.map((tech) => (
        <TechnologyBadge key={tech.name} technology={tech} compact={compact} />
      ))}
      {remaining > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="cursor-default">
              +{remaining} more
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              {sortedTechnologies
                .slice(maxVisible)
                .map((t) => t.name)
                .join(', ')}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

/**
 * Simple inline technology list (for compact displays)
 */
export function TechnologyList({
  technologies,
  max = 5
}: {
  technologies: DetectedTechnology[]
  max?: number
}) {
  const sorted = [...technologies].sort((a, b) => b.confidence - a.confidence)
  const visible = sorted.slice(0, max)
  const remaining = sorted.length - max

  if (technologies.length === 0) {
    return <span className="text-muted-foreground">None detected</span>
  }

  return (
    <span>
      {visible.map((t) => t.name).join(', ')}
      {remaining > 0 && <span className="text-muted-foreground"> +{remaining} more</span>}
    </span>
  )
}
