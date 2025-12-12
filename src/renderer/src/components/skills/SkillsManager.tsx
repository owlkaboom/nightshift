/**
 * Skills management component for the settings view
 */

import { useEffect, useState } from 'react'
import { useSkillStore } from '@/stores'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import type { Skill, SkillCategory } from '@shared/types'
import { SKILL_CATEGORIES } from '@shared/types'
import { cn } from '@/lib/utils'

export function SkillsManager() {
  const { skills, loading, fetchSkills, createSkill, updateSkill, deleteSkill, toggleSkill, resetSkills } =
    useSkillStore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['coding', 'custom']))

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [icon, setIcon] = useState('')
  const [category, setCategory] = useState<SkillCategory>('custom')

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  const resetForm = () => {
    setName('')
    setDescription('')
    setPrompt('')
    setIcon('')
    setCategory('custom')
    setEditingSkill(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (skill: Skill) => {
    setEditingSkill(skill)
    setName(skill.name)
    setDescription(skill.description)
    setPrompt(skill.prompt)
    setIcon(skill.icon)
    setCategory(skill.category)
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (editingSkill) {
      await updateSkill(editingSkill.id, {
        name,
        description,
        prompt,
        icon: icon || undefined,
        category
      })
    } else {
      await createSkill({
        name,
        description,
        prompt,
        icon: icon || undefined,
        category
      })
    }
    setIsDialogOpen(false)
    resetForm()
  }

  const handleDelete = async (skill: Skill) => {
    if (skill.isBuiltIn) return
    if (confirm(`Delete skill "${skill.name}"?`)) {
      await deleteSkill(skill.id)
    }
  }

  const handleReset = async () => {
    if (confirm('Reset all skills to defaults? Custom skills will be deleted.')) {
      await resetSkills()
    }
  }

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
      } else {
        next.add(cat)
      }
      return next
    })
  }

  // Group skills by category
  const skillsByCategory = skills.reduce(
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

  if (loading && skills.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Agent Skills
            </CardTitle>
            <CardDescription>
              Configure specialized prompts to enhance your agent's capabilities
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-1" />
              Add Skill
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {orderedCategories.map((cat) => {
            const catSkills = skillsByCategory[cat]
            if (!catSkills || catSkills.length === 0) return null

            const isExpanded = expandedCategories.has(cat)
            const catInfo = SKILL_CATEGORIES[cat]
            const enabledCount = catSkills.filter((s) => s.enabled).length

            return (
              <div key={cat} className="border rounded-lg">
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">{catInfo.label}</span>
                    <span className="text-xs text-muted-foreground">({catInfo.description})</span>
                  </div>
                  <Badge variant="secondary">
                    {enabledCount}/{catSkills.length} enabled
                  </Badge>
                </button>

                {isExpanded && (
                  <div className="border-t divide-y">
                    {catSkills.map((skill) => (
                      <SkillRow
                        key={skill.id}
                        skill={skill}
                        onToggle={() => toggleSkill(skill.id)}
                        onEdit={() => openEditDialog(skill)}
                        onDelete={() => handleDelete(skill)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSkill ? 'Edit Skill' : 'Create New Skill'}</DialogTitle>
            <DialogDescription>
              {editingSkill
                ? 'Update this skill\'s configuration'
                : 'Define a new specialized prompt for your agent'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="skill-name">Name</Label>
                <Input
                  id="skill-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., API Design Expert"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skill-icon">Icon (emoji)</Label>
                <Input
                  id="skill-icon"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="e.g., (default)"
                  maxLength={4}
                  className="w-24"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="skill-category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as SkillCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SKILL_CATEGORIES).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      {info.label} - {info.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="skill-description">Description</Label>
              <Input
                id="skill-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what this skill does"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="skill-prompt">Prompt Instructions</Label>
              <Textarea
                id="skill-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter the specialized instructions for the agent..."
                rows={8}
                className="font-mono text-sm"
                disabled={editingSkill?.isBuiltIn}
              />
              {editingSkill?.isBuiltIn && (
                <p className="text-xs text-muted-foreground">
                  Built-in skill prompts cannot be modified
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name || !description || !prompt}>
              {editingSkill ? 'Update' : 'Create'} Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

/**
 * Individual skill row component
 */
function SkillRow({
  skill,
  onToggle,
  onEdit,
  onDelete
}: {
  skill: Skill
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={cn(
          'w-10 h-6 rounded-full transition-colors relative cursor-pointer',
          skill.enabled ? 'bg-primary' : 'bg-muted'
        )}
      >
        <div
          className={cn(
            'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
            skill.enabled ? 'translate-x-5' : 'translate-x-1'
          )}
        />
      </button>

      {/* Icon and name */}
      <span className="text-lg">{skill.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium', !skill.enabled && 'text-muted-foreground')}>
            {skill.name}
          </span>
          {skill.isBuiltIn && (
            <Badge variant="outline" className="text-xs">
              Built-in
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        {!skill.isBuiltIn && (
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  )
}
