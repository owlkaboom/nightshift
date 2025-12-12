/**
 * Zustand store for calendar view state
 */

import { create } from 'zustand'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import type { TaskManifest } from '@shared/types'

interface MonthCache {
  /** ISO date string for start of month (YYYY-MM-DD) */
  key: string
  /** Tasks for this month */
  tasks: TaskManifest[]
  /** When this was cached */
  cachedAt: number
}

interface CalendarState {
  /** Currently displayed month (Date object at start of month) */
  currentMonth: Date
  /** Selected day for detailed view (ISO date string) */
  selectedDate: string | null
  /** Project filter (null = all projects) */
  selectedProjectId: string | null
  /** Status filter (null = all completed statuses) */
  statusFilter: 'all' | 'completed' | 'rejected' | 'needs_review'
  /** Cached month data */
  cache: Map<string, MonthCache>
  /** Cache TTL in milliseconds (15 minutes) */
  cacheTTL: number
  /** Loading state */
  loading: boolean
  /** Error state */
  error: string | null

  // Actions
  /** Set current month */
  setCurrentMonth: (date: Date) => void
  /** Go to next month */
  nextMonth: () => void
  /** Go to previous month */
  previousMonth: () => void
  /** Go to today */
  goToToday: () => void
  /** Select a date for detailed view */
  selectDate: (date: string | null) => void
  /** Set project filter */
  setProjectFilter: (projectId: string | null) => void
  /** Set status filter */
  setStatusFilter: (status: 'all' | 'completed' | 'rejected' | 'needs_review') => void
  /** Fetch tasks for current month */
  fetchCurrentMonth: () => Promise<void>
  /** Prefetch adjacent months */
  prefetchAdjacentMonths: () => Promise<void>
  /** Get tasks for a specific date */
  getTasksForDate: (date: string) => TaskManifest[]
  /** Get task count for a date */
  getTaskCountForDate: (date: string) => number
  /** Clear cache */
  clearCache: () => void
  /** Clear error */
  clearError: () => void
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  currentMonth: startOfMonth(new Date()),
  selectedDate: null,
  selectedProjectId: null,
  statusFilter: 'all',
  cache: new Map(),
  cacheTTL: 15 * 60 * 1000, // 15 minutes
  loading: false,
  error: null,

  setCurrentMonth: (date: Date) => {
    const monthStart = startOfMonth(date)
    set({ currentMonth: monthStart })
    // Fetch tasks for new month
    get().fetchCurrentMonth()
  },

  nextMonth: () => {
    const { currentMonth } = get()
    const nextMonth = new Date(currentMonth)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    get().setCurrentMonth(nextMonth)
  },

  previousMonth: () => {
    const { currentMonth } = get()
    const prevMonth = new Date(currentMonth)
    prevMonth.setMonth(prevMonth.getMonth() - 1)
    get().setCurrentMonth(prevMonth)
  },

  goToToday: () => {
    get().setCurrentMonth(new Date())
  },

  selectDate: (date: string | null) => {
    set({ selectedDate: date })
  },

  setProjectFilter: (projectId: string | null) => {
    set({ selectedProjectId: projectId })
    // Clear cache when filter changes
    get().clearCache()
    // Refetch with new filter
    get().fetchCurrentMonth()
  },

  setStatusFilter: (status: 'all' | 'completed' | 'rejected' | 'needs_review') => {
    set({ statusFilter: status })
  },

  fetchCurrentMonth: async () => {
    const { currentMonth, selectedProjectId, cache, cacheTTL } = get()
    const monthKey = format(currentMonth, 'yyyy-MM')

    // Check cache first
    const cached = cache.get(monthKey)
    const now = Date.now()
    if (cached && now - cached.cachedAt < cacheTTL) {
      // Cache is still valid, no need to fetch
      return
    }

    set({ loading: true, error: null })

    try {
      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

      const tasks = await window.api.listCompletedTasksByDateRange(
        startDate,
        endDate,
        selectedProjectId || undefined
      )

      // Update cache
      const newCache = new Map(cache)
      newCache.set(monthKey, {
        key: monthKey,
        tasks,
        cachedAt: now
      })

      set({ cache: newCache, loading: false })

      // Prefetch adjacent months in background
      get().prefetchAdjacentMonths()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch calendar data',
        loading: false
      })
    }
  },

  prefetchAdjacentMonths: async () => {
    const { currentMonth, selectedProjectId, cache, cacheTTL } = get()

    // Previous month
    const prevMonth = new Date(currentMonth)
    prevMonth.setMonth(prevMonth.getMonth() - 1)
    const prevMonthKey = format(prevMonth, 'yyyy-MM')

    // Next month
    const nextMonth = new Date(currentMonth)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    const nextMonthKey = format(nextMonth, 'yyyy-MM')

    const now = Date.now()

    // Prefetch previous month if not cached
    const prevCached = cache.get(prevMonthKey)
    if (!prevCached || now - prevCached.cachedAt >= cacheTTL) {
      try {
        const startDate = format(startOfMonth(prevMonth), 'yyyy-MM-dd')
        const endDate = format(endOfMonth(prevMonth), 'yyyy-MM-dd')
        const tasks = await window.api.listCompletedTasksByDateRange(
          startDate,
          endDate,
          selectedProjectId || undefined
        )

        const newCache = new Map(cache)
        newCache.set(prevMonthKey, {
          key: prevMonthKey,
          tasks,
          cachedAt: now
        })
        set({ cache: newCache })
      } catch (error) {
        // Silent fail for prefetch
        console.error('Failed to prefetch previous month:', error)
      }
    }

    // Prefetch next month if not cached
    const nextCached = cache.get(nextMonthKey)
    if (!nextCached || now - nextCached.cachedAt >= cacheTTL) {
      try {
        const startDate = format(startOfMonth(nextMonth), 'yyyy-MM-dd')
        const endDate = format(endOfMonth(nextMonth), 'yyyy-MM-dd')
        const tasks = await window.api.listCompletedTasksByDateRange(
          startDate,
          endDate,
          selectedProjectId || undefined
        )

        const newCache = new Map(cache)
        newCache.set(nextMonthKey, {
          key: nextMonthKey,
          tasks,
          cachedAt: now
        })
        set({ cache: newCache })
      } catch (error) {
        // Silent fail for prefetch
        console.error('Failed to prefetch next month:', error)
      }
    }
  },

  getTasksForDate: (date: string) => {
    const { currentMonth, cache, statusFilter } = get()
    const monthKey = format(currentMonth, 'yyyy-MM')
    const cached = cache.get(monthKey)

    if (!cached) {
      return []
    }

    // Filter tasks for this specific date
    let tasks = cached.tasks.filter((task) => {
      if (!task.completedAt) return false
      const taskDate = format(new Date(task.completedAt), 'yyyy-MM-dd')
      return taskDate === date
    })

    // Apply status filter
    if (statusFilter !== 'all') {
      tasks = tasks.filter((task) => task.status === statusFilter)
    }

    return tasks
  },

  getTaskCountForDate: (date: string) => {
    return get().getTasksForDate(date).length
  },

  clearCache: () => {
    set({ cache: new Map() })
  },

  clearError: () => {
    set({ error: null })
  }
}))
