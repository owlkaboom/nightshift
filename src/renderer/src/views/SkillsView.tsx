/**
 * SkillsView - Skills management interface
 *
 * Split-panel layout with skills list on the left and tabbed content on the right.
 * Features:
 * - My Skills: View/edit skills and see which tasks use them
 * - AI Suggestions: On-demand project analysis for skill recommendations
 * - GitHub Import: Fetch and import skills from GitHub repositories
 */

import { useCallback, useEffect, useState } from 'react'
import { Zap, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSkillStore, useProjectStore } from '@/stores'
import { useKeyboardShortcuts, formatKbd, type KeyboardShortcut } from '@/hooks'
import type { Skill, SkillCategory } from '@shared/types'
import { SkillSuggestions, SkillImport } from '@/components/skills'

type FilterCategory = 'all' | SkillCategory

export function SkillsView() {
  const {
    skills,
    loading,
    fetchSkills,
    toggleSkill
  } = useSkillStore()

  const { fetchProjects } = useProjectStore()

  const [activeTab, setActiveTab] = useState<'my-skills' | 'suggestions' | 'import'>('my-skills')
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all')
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [showLoading, setShowLoading] = useState(true)

  // Initial data fetch
  useEffect(() => {
    const startTime = Date.now()
    const minLoadingDuration = 300 // milliseconds

    const fetchData = async () => {
      await Promise.all([
        fetchSkills(),
        fetchProjects()
      ])

      // Ensure minimum loading time to prevent flash
      const elapsed = Date.now() - startTime
      const remainingTime = Math.max(0, minLoadingDuration - elapsed)

      if (remainingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingTime))
      }

      setShowLoading(false)
    }

    fetchData()
  }, [fetchSkills, fetchProjects])

  // Get filtered skills based on category
  const filteredSkills = filterCategory === 'all'
    ? skills
    : skills.filter(s => s.category === filterCategory)

  // Auto-select first skill when skills are loaded
  useEffect(() => {
    if (!showLoading && filteredSkills.length > 0 && !selectedSkill) {
      setSelectedSkill(filteredSkills[0])
    }
  }, [showLoading, filteredSkills, selectedSkill])

  // Update selected skill when it changes in the store
  useEffect(() => {
    if (selectedSkill) {
      const updated = skills.find(s => s.id === selectedSkill.id)
      if (updated) {
        setSelectedSkill(updated)
      }
    }
  }, [skills, selectedSkill])

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchSkills()
  }, [fetchSkills])

  // Handle skill selection
  const handleSkillClick = useCallback((skill: Skill) => {
    setSelectedSkill(skill)
    setActiveTab('my-skills')
  }, [])

  // Handle skill toggle
  const handleToggleSkill = useCallback(async (skillId: string) => {
    await toggleSkill(skillId)
  }, [toggleSkill])

  // Handle skill created/imported
  const handleSkillCreated = useCallback(() => {
    fetchSkills()
  }, [fetchSkills])

  // Keyboard shortcuts
  const shortcuts = [
    { key: 'r', meta: true, handler: handleRefresh, description: 'Refresh skills' }
  ] as KeyboardShortcut[]

  useKeyboardShortcuts(shortcuts)

  return (
    <div className="flex flex-col h-full" data-feature="skills-system">
      {/* Split-pane content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Skills list */}
        <div className="w-80 border-r flex flex-col bg-muted/30 shrink-0">
          {/* Sidebar header */}
          <div className="p-4 border-b space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Skills</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={loading}
                className="h-7 w-7"
                title={`Refresh (${formatKbd('⌘R')})`}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-1">
            <Button
              variant={filterCategory === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterCategory('all')}
              className="h-7 text-xs"
            >
              All
            </Button>
            <Button
              variant={filterCategory === 'coding' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterCategory('coding')}
              className="h-7 text-xs"
            >
              Coding
            </Button>
            <Button
              variant={filterCategory === 'testing' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterCategory('testing')}
              className="h-7 text-xs"
            >
              Testing
            </Button>
            <Button
              variant={filterCategory === 'custom' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterCategory('custom')}
              className="h-7 text-xs"
            >
              Custom
            </Button>
          </div>
        </div>

        {/* Skills list */}
        <div className="flex-1 overflow-y-auto p-2">
          {showLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              No skills in this category
            </div>
          ) : (
            <div className="space-y-1">
              {filteredSkills.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => handleSkillClick(skill)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedSkill?.id === skill.id
                      ? 'bg-primary/10 border-primary'
                      : 'bg-card hover:bg-accent border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg shrink-0">{skill.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm truncate">{skill.name}</h3>
                        {skill.enabled && (
                          <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {skill.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
                          {skill.category}
                        </span>
                        {skill.isBuiltIn && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                            Built-in
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        </div>

      {/* Right panel - Tabbed content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex flex-col h-full">
          <div className="border-b px-4 bg-background z-10 shrink-0">
            <TabsList>
              <TabsTrigger value="my-skills">My Skills</TabsTrigger>
              <TabsTrigger value="suggestions">AI Suggestions</TabsTrigger>
              <TabsTrigger value="import">GitHub Import</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="my-skills" className="m-0 p-6 h-full">
              {selectedSkill ? (
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="flex items-start gap-4">
                    <span className="text-4xl">{selectedSkill.icon}</span>
                    <div className="flex-1">
                      <h1 className="text-2xl font-bold">{selectedSkill.name}</h1>
                      <p className="text-muted-foreground mt-1">{selectedSkill.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={selectedSkill.enabled ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleToggleSkill(selectedSkill.id)}
                      >
                        {selectedSkill.enabled ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Prompt</h3>
                      <div className="p-4 bg-muted rounded-lg">
                        <pre className="text-sm whitespace-pre-wrap font-mono">{selectedSkill.prompt}</pre>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold mb-2">Details</h3>
                      <dl className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <dt className="text-muted-foreground">Category</dt>
                          <dd className="font-medium capitalize">{selectedSkill.category}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Type</dt>
                          <dd className="font-medium">{selectedSkill.isBuiltIn ? 'Built-in' : 'Custom'}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Created</dt>
                          <dd className="font-medium">{new Date(selectedSkill.createdAt).toLocaleDateString()}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Updated</dt>
                          <dd className="font-medium">{new Date(selectedSkill.updatedAt).toLocaleDateString()}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4">
                    <Zap className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <div>
                      <h3 className="text-lg font-semibold text-muted-foreground">No skill selected</h3>
                      <p className="text-sm text-muted-foreground">
                        Select a skill from the list to view details
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="suggestions" className="m-0 p-6 h-full">
              <div className="max-w-4xl mx-auto">
                <SkillSuggestions onSkillCreated={handleSkillCreated} />
              </div>
            </TabsContent>

            <TabsContent value="import" className="m-0 p-6 h-full">
              <div className="max-w-4xl mx-auto">
                <SkillImport onSkillsImported={handleSkillCreated} />
              </div>
            </TabsContent>
          </div>
        </Tabs>
        </div>
      </div>
    </div>
  )
}
