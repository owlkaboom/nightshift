/**
 * ScheduleView - Calendar view of completed tasks
 */

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { CalendarGrid, TaskDayPanel } from '@/components/calendar'
import { TaskDetailView } from '@/components/review'
import { useCalendarStore, useProjectStore, useTaskStore } from '@/stores'
import type { TaskManifest } from '@shared/types'

export function ScheduleView() {
  const [selectedTask, setSelectedTask] = useState<TaskManifest | null>(null)

  const {
    currentMonth,
    selectedProjectId,
    statusFilter,
    loading,
    error,
    nextMonth,
    previousMonth,
    goToToday,
    setProjectFilter,
    setStatusFilter,
    fetchCurrentMonth
  } = useCalendarStore()

  const { projects, fetchProjects } = useProjectStore()
  const { fetchTasks } = useTaskStore()

  // Fetch projects and calendar data on mount
  useEffect(() => {
    fetchProjects()
    fetchCurrentMonth()
  }, [fetchProjects, fetchCurrentMonth])

  const handleTaskClick = (task: TaskManifest) => {
    setSelectedTask(task)
  }

  // Build project name lookup
  const projectNames: Record<string, string> = {}
  projects.forEach((p) => {
    projectNames[p.id] = p.name
  })

  // If viewing task details, show that instead
  if (selectedTask) {
    return (
      <TaskDetailView
        task={selectedTask}
        projectName={projectNames[selectedTask.projectId] || 'Unknown Project'}
        onBack={() => {
          setSelectedTask(null)
          fetchCurrentMonth() // Refresh calendar after review
        }}
        onTaskUpdated={() => {
          setSelectedTask(null)
          fetchCurrentMonth() // Refresh calendar after task update
          fetchTasks() // Also refresh task list
        }}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Schedule</h1>

          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={previousMonth}
              disabled={loading}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="min-w-[160px] text-center font-medium">
              {format(currentMonth, 'MMMM yyyy')}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={nextMonth}
              disabled={loading}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              onClick={goToToday}
              disabled={loading}
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              Today
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          {/* Project filter */}
          <Select
            value={selectedProjectId || 'all'}
            onValueChange={(value) => setProjectFilter(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select
            value={statusFilter}
            onValueChange={(value: 'all' | 'completed' | 'rejected' | 'needs_review') =>
              setStatusFilter(value)
            }
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="needs_review">Needs Review</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-destructive/10 text-destructive rounded-lg">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex gap-6 p-6 overflow-hidden">
        {/* Calendar grid */}
        <div className="flex-1 overflow-auto">
          <CalendarGrid />
        </div>

        {/* Task day panel */}
        <div className="w-[400px] border rounded-lg overflow-hidden flex flex-col">
          <TaskDayPanel onTaskClick={handleTaskClick} />
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-background/50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading calendar...</p>
          </div>
        </div>
      )}
    </div>
  )
}
