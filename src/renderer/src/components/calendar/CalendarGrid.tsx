/**
 * CalendarGrid Component
 *
 * Displays a month view calendar with task completion counts
 */

import { useMemo } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday
} from 'date-fns'
import { cn } from '@/lib/utils'
import { useCalendarStore } from '@/stores'

interface CalendarGridProps {
  /** Optional className for styling */
  className?: string
}

export function CalendarGrid({ className }: CalendarGridProps) {
  const { currentMonth, selectedDate, selectDate, getTaskCountForDate } = useCalendarStore()

  // Calculate calendar days (including padding from previous/next month)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart)
    const calendarEnd = endOfWeek(monthEnd)

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentMonth])

  // Week days header
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const dateString = format(day, 'yyyy-MM-dd')
          const taskCount = getTaskCountForDate(dateString)
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isSelected = selectedDate === dateString
          const isTodayDate = isToday(day)

          return (
            <button
              key={dateString}
              onClick={() => selectDate(dateString)}
              className={cn(
                'relative aspect-square rounded-md p-2 text-sm transition-colors',
                'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
                // Current month vs other months
                isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/40',
                // Selected state
                isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                // Today indicator
                isTodayDate &&
                  !isSelected &&
                  'border-2 border-primary font-semibold',
                // No tasks - subtle
                taskCount === 0 && isCurrentMonth && 'opacity-60'
              )}
              disabled={!isCurrentMonth}
            >
              {/* Day number */}
              <div className="flex flex-col items-center justify-center h-full">
                <span className="mb-1">{format(day, 'd')}</span>

                {/* Task count badge */}
                {taskCount > 0 && (
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full font-medium',
                      isSelected
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {taskCount}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
