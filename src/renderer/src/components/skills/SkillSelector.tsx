/**
 * Skill selector component for task creation
 * Allows users to pick one or more skills to include with their task
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useSkillStore } from '@/stores'
import type { Skill, SkillCategory } from '@shared/types'
import { SKILL_CATEGORIES } from '@shared/types'
import { Check, ChevronDown, Info, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

interface SkillSelectorProps {
  selectedSkillIds: string[]
  onSelectionChange: (skillIds: string[]) => void
  className?: string
  /** Hide the label above the selector (for external label placement) */
  hideLabel?: boolean
}

export function SkillSelector({ selectedSkillIds, onSelectionChange, className, hideLabel = false }: SkillSelectorProps) {
  const { skills, fetchSkills } = useSkillStore()
  const [isOpen, setIsOpen] = useState(false)
  const [localSelection, setLocalSelection] = useState<Set<string>>(new Set(selectedSkillIds))

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  useEffect(() => {
    setLocalSelection(new Set(selectedSkillIds))
  }, [selectedSkillIds])

  const toggleSkill = (skillId: string) => {
    setLocalSelection((prev) => {
      const next = new Set(prev)
      if (next.has(skillId)) {
        next.delete(skillId)
      } else {
        next.add(skillId)
      }
      return next
    })
  }

  const handleConfirm = () => {
    onSelectionChange(Array.from(localSelection))
    setIsOpen(false)
  }

  const handleCancel = () => {
    setLocalSelection(new Set(selectedSkillIds))
    setIsOpen(false)
  }

  const selectAll = () => {
    const enabledSkillIds = skills.filter((s) => s.enabled).map((s) => s.id)
    setLocalSelection(new Set(enabledSkillIds))
  }

  const selectNone = () => {
    setLocalSelection(new Set())
  }

  // Get selected skills for display
  const selectedSkills = skills.filter((s) => selectedSkillIds.includes(s.id))

  // Filter to only enabled skills in the dialog
  const enabledSkills = skills.filter((s) => s.enabled)

  // Group enabled skills by category
  const skillsByCategory = enabledSkills.reduce(
    (acc, skill) => {
      if (!acc[skill.category]) {
        acc[skill.category] = []
      }
      acc[skill.category].push(skill)
      return acc
    },
    {} as Record<SkillCategory, Skill[]>
  )

  // Order categories
  const orderedCategories: SkillCategory[] = [
    'coding',
    'testing',
    'debugging',
    'documentation',
    'architecture',
    'security',
    'performance',
    'custom'
  ]

  return (
    <div className={className}>
      {!hideLabel && (
        <Label className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4" />
          Skills
        </Label>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between h-auto min-h-10 py-2"
          >
            <div className="flex flex-wrap gap-1 flex-1 justify-start">
              {selectedSkills.length === 0 ? (
                <span className="text-muted-foreground">Select skills...</span>
              ) : (
                selectedSkills.map((skill) => (
                  <Badge key={skill.id} variant="secondary" className="text-xs">
                    {skill.icon} {skill.name}
                  </Badge>
                ))
              )}
            </div>
            <ChevronDown className="h-4 w-4 ml-2 shrink-0 text-muted-foreground" />
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Select Skills
            </DialogTitle>
            <DialogDescription>
              Choose skills to enhance your agent for this task
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 py-2 border-b">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={selectNone}>
              Clear
            </Button>
            <span className="text-sm text-muted-foreground ml-auto">
              {localSelection.size} skill{localSelection.size !== 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="flex-1 overflow-auto py-4 space-y-4">
            {orderedCategories.map((cat) => {
              const catSkills = skillsByCategory[cat]
              if (!catSkills || catSkills.length === 0) return null

              const catInfo = SKILL_CATEGORIES[cat]

              return (
                <div key={cat}>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    {catInfo.label}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {catSkills.map((skill) => (
                      <SkillOption
                        key={skill.id}
                        skill={skill}
                        isSelected={localSelection.has(skill.id)}
                        onToggle={() => toggleSkill(skill.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            {enabledSkills.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No skills are currently enabled.</p>
                <p className="text-sm">Enable skills in Settings to use them here.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>
              Confirm Selection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedSkills.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {selectedSkills.length} skill{selectedSkills.length !== 1 ? 's' : ''} will enhance
          your agent
        </p>
      )}
    </div>
  )
}

/**
 * Individual skill option in the selector
 */
function SkillOption({
  skill,
  isSelected,
  onToggle
}: {
  skill: Skill
  isSelected: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex items-start gap-2 p-2 rounded-lg border text-left transition-colors cursor-pointer',
        isSelected
          ? 'border-primary bg-primary/10'
          : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
      )}
    >
      <div
        className={cn(
          'w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5',
          isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
        )}
      >
        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span>{skill.icon}</span>
          <span className="font-medium text-sm truncate">{skill.name}</span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
      </div>
    </button>
  )
}

/**
 * Compact skill badges display (for showing selected skills inline)
 */
export function SelectedSkillsBadges({
  skillIds,
  maxDisplay = 3
}: {
  skillIds: string[]
  maxDisplay?: number
}) {
  const { skills } = useSkillStore()
  const selectedSkills = skills.filter((s) => skillIds.includes(s.id))

  if (selectedSkills.length === 0) {
    return null
  }

  const displaySkills = selectedSkills.slice(0, maxDisplay)
  const remaining = selectedSkills.length - maxDisplay

  return (
    <div className="flex flex-wrap gap-1">
      {displaySkills.map((skill) => (
        <Badge key={skill.id} variant="outline" className="text-xs">
          {skill.icon} {skill.name}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="outline" className="text-xs">
          +{remaining} more
        </Badge>
      )}
    </div>
  )
}
