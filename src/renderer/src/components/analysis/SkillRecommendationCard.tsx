/**
 * SkillRecommendationCard component
 *
 * Displays a skill recommendation with selection, preview, and edit options.
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import { Textarea } from '@/components/ui/textarea'
import type { SkillRecommendation, SkillPriority } from '@shared/types'
import { getSkillPriorityLabel } from '@shared/types'
import { ChevronDown, ChevronUp, Lightbulb, Edit2, Check, X, Info } from 'lucide-react'

interface SkillRecommendationCardProps {
  recommendation: SkillRecommendation
  selected: boolean
  onSelect: (selected: boolean) => void
  onPromptEdit?: (newPrompt: string) => void
  compact?: boolean
}

/**
 * Get priority badge variant
 */
function getPriorityVariant(priority: SkillPriority): 'default' | 'secondary' | 'outline' {
  switch (priority) {
    case 'high':
      return 'default'
    case 'medium':
      return 'secondary'
    case 'low':
      return 'outline'
    default:
      return 'outline'
  }
}

/**
 * SkillRecommendationCard component
 */
export function SkillRecommendationCard({
  recommendation,
  selected,
  onSelect,
  onPromptEdit,
  compact = false
}: SkillRecommendationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedPrompt, setEditedPrompt] = useState(recommendation.suggestedPrompt)

  const handleSaveEdit = () => {
    if (onPromptEdit && editedPrompt !== recommendation.suggestedPrompt) {
      onPromptEdit(editedPrompt)
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditedPrompt(recommendation.suggestedPrompt)
    setIsEditing(false)
  }

  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
          selected ? 'bg-accent border-accent-foreground/20' : 'hover:bg-muted/50'
        }`}
      >
        <Checkbox
          id={`rec-${recommendation.id}`}
          checked={selected}
          onCheckedChange={onSelect}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="font-medium truncate">{recommendation.name}</span>
            <Badge variant={getPriorityVariant(recommendation.priority)} className="text-xs">
              {recommendation.priority}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {recommendation.description}
          </p>
        </div>
      </div>
    )
  }

  return (
    <Card className={selected ? 'border-primary' : ''}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id={`rec-${recommendation.id}`}
            checked={selected}
            onCheckedChange={onSelect}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                {recommendation.name}
              </CardTitle>
              <Badge variant={getPriorityVariant(recommendation.priority)} className="text-xs">
                {getSkillPriorityLabel(recommendation.priority)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{recommendation.description}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="py-0 px-4 pb-3">
        {/* Reason */}
        <div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{recommendation.reason}</span>
        </div>

        {/* Based on */}
        {recommendation.basedOn.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            <span className="text-xs text-muted-foreground">Based on:</span>
            {recommendation.basedOn.map((tech) => (
              <Badge key={tech} variant="outline" className="text-xs">
                {tech}
              </Badge>
            ))}
          </div>
        )}

        {/* Expandable prompt preview */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between -mx-2">
              <span className="text-xs text-muted-foreground">
                {isExpanded ? 'Hide' : 'Show'} skill prompt
              </span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  className="font-mono text-xs min-h-[200px]"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit}>
                    <Check className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <pre className="bg-muted/50 p-3 rounded-md text-xs whitespace-pre-wrap overflow-x-auto max-h-[300px]">
                  {recommendation.suggestedPrompt}
                </pre>
                {onPromptEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}

/**
 * List of skill recommendation cards
 */
interface SkillRecommendationListProps {
  recommendations: SkillRecommendation[]
  selectedIds: Set<string>
  onSelectionChange: (id: string, selected: boolean) => void
  onSelectAll?: () => void
  onDeselectAll?: () => void
  onPromptEdit?: (id: string, newPrompt: string) => void
  compact?: boolean
}

export function SkillRecommendationList({
  recommendations,
  selectedIds,
  onSelectionChange,
  onSelectAll,
  onDeselectAll,
  onPromptEdit,
  compact = false
}: SkillRecommendationListProps) {
  const allSelected = recommendations.every((r) => selectedIds.has(r.id))
  const someSelected = recommendations.some((r) => selectedIds.has(r.id))

  return (
    <div className="space-y-3">
      {/* Selection controls */}
      {(onSelectAll || onDeselectAll) && recommendations.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} of {recommendations.length} selected
          </span>
          <div className="flex gap-2">
            {onSelectAll && !allSelected && (
              <Button variant="outline" size="sm" onClick={onSelectAll}>
                Select All
              </Button>
            )}
            {onDeselectAll && someSelected && (
              <Button variant="outline" size="sm" onClick={onDeselectAll}>
                Deselect All
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Cards */}
      {recommendations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No skill recommendations available
        </div>
      ) : (
        <div className={compact ? 'space-y-2' : 'space-y-3'}>
          {recommendations.map((rec) => (
            <SkillRecommendationCard
              key={rec.id}
              recommendation={rec}
              selected={selectedIds.has(rec.id)}
              onSelect={(selected) => onSelectionChange(rec.id, selected)}
              onPromptEdit={onPromptEdit ? (prompt) => onPromptEdit(rec.id, prompt) : undefined}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  )
}
