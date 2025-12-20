/**
 * WalkthroughTooltip Component
 *
 * Displays the tooltip content for the current walkthrough step with navigation controls.
 * Intelligently positions itself relative to the spotlight bounds.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import type { SpotlightBounds, TooltipPosition } from '@shared/types/walkthrough'
import { useWalkthrough } from './WalkthroughProvider'
import { Button } from '@/components/ui/button'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface WalkthroughTooltipProps {
  spotlightBounds: SpotlightBounds
}

/**
 * Tooltip component that displays walkthrough step content
 */
export const WalkthroughTooltip: React.FC<WalkthroughTooltipProps> = ({ spotlightBounds }) => {
  const {
    currentStep,
    currentStepIndex,
    totalSteps,
    nextStep,
    previousStep,
    skipWalkthrough,
    completeWalkthrough
  } = useWalkthrough()

  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null)
  const [tooltipRef, setTooltipRef] = useState<HTMLDivElement | null>(null)

  // Memoize step state
  const isFirstStep = useMemo(() => currentStepIndex === 0, [currentStepIndex])
  const isLastStep = useMemo(() => currentStepIndex === totalSteps - 1, [currentStepIndex, totalSteps])

  /**
   * Calculate optimal tooltip position based on available space
   */
  const calculateTooltipPosition = useCallback(
    (tooltipElement: HTMLDivElement): TooltipPosition => {
      if (!currentStep) {
        return { top: 0, left: 0, position: 'bottom' }
      }

      const tooltipRect = tooltipElement.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const gap = 16 // Gap between spotlight and tooltip

      // Determine best position based on available space and preference
      const preferredPosition = currentStep.position || 'auto'

      const positions = {
        top: {
          top: spotlightBounds.top - tooltipRect.height - gap,
          left: spotlightBounds.left + spotlightBounds.width / 2 - tooltipRect.width / 2,
          position: 'top' as const
        },
        bottom: {
          top: spotlightBounds.top + spotlightBounds.height + gap,
          left: spotlightBounds.left + spotlightBounds.width / 2 - tooltipRect.width / 2,
          position: 'bottom' as const
        },
        left: {
          top: spotlightBounds.top + spotlightBounds.height / 2 - tooltipRect.height / 2,
          left: spotlightBounds.left - tooltipRect.width - gap,
          position: 'left' as const
        },
        right: {
          top: spotlightBounds.top + spotlightBounds.height / 2 - tooltipRect.height / 2,
          left: spotlightBounds.left + spotlightBounds.width + gap,
          position: 'right' as const
        }
      }

      // Check if preferred position fits in viewport
      if (preferredPosition !== 'auto') {
        const pos = positions[preferredPosition]
        if (
          pos.top >= 0 &&
          pos.top + tooltipRect.height <= viewportHeight &&
          pos.left >= 0 &&
          pos.left + tooltipRect.width <= viewportWidth
        ) {
          return pos
        }
      }

      // Find the first position that fits
      for (const position of ['bottom', 'top', 'right', 'left'] as const) {
        const pos = positions[position]
        if (
          pos.top >= 0 &&
          pos.top + tooltipRect.height <= viewportHeight &&
          pos.left >= 0 &&
          pos.left + tooltipRect.width <= viewportWidth
        ) {
          return pos
        }
      }

      // Fallback to bottom, constrained to viewport
      let finalPosition = positions.bottom
      finalPosition.top = Math.max(gap, Math.min(finalPosition.top, viewportHeight - tooltipRect.height - gap))
      finalPosition.left = Math.max(gap, Math.min(finalPosition.left, viewportWidth - tooltipRect.width - gap))

      return finalPosition
    },
    [currentStep, spotlightBounds]
  )

  /**
   * Update tooltip position when spotlight bounds or tooltip size changes
   */
  useEffect(() => {
    if (!tooltipRef) return

    // Use RAF for smoother updates
    const rafId = requestAnimationFrame(() => {
      const position = calculateTooltipPosition(tooltipRef)
      setTooltipPosition(position)
    })

    return () => cancelAnimationFrame(rafId)
  }, [tooltipRef, calculateTooltipPosition])

  /**
   * Update position on window resize
   */
  useEffect(() => {
    if (!tooltipRef) return

    let rafId: number | undefined
    let isScheduled = false

    const handleResize = () => {
      if (isScheduled) return
      isScheduled = true

      rafId = requestAnimationFrame(() => {
        const position = calculateTooltipPosition(tooltipRef)
        setTooltipPosition(position)
        isScheduled = false
      })
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [tooltipRef, calculateTooltipPosition])

  // Memoize progress indicators to avoid re-creating on every render
  // Note: Must be before early return to follow React hooks rules
  const progressIndicators = useMemo(
    () =>
      Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${
            i === currentStepIndex
              ? 'w-6 bg-blue-500'
              : i < currentStepIndex
                ? 'w-1 bg-blue-300'
                : 'w-1 bg-gray-300 dark:bg-gray-600'
          }`}
        />
      )),
    [totalSteps, currentStepIndex]
  )

  if (!currentStep || !tooltipPosition) {
    return null
  }

  return (
    <div
      ref={setTooltipRef}
      className="absolute bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 max-w-md pointer-events-auto transition-all duration-300"
      style={{
        top: `${tooltipPosition.top}px`,
        left: `${tooltipPosition.left}px`,
        zIndex: 10000
      }}
    >
      {/* Close button */}
      <button
        onClick={skipWalkthrough}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        aria-label="Close walkthrough"
      >
        <X size={18} />
      </button>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1">{progressIndicators}</div>
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
          {currentStepIndex + 1} / {totalSteps}
        </span>
      </div>

      {/* Content */}
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {currentStep.title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          {currentStep.description}
        </p>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between gap-3">
        {/* Previous button (or skip on first step) */}
        {isFirstStep ? (
          <Button variant="ghost" size="sm" onClick={skipWalkthrough} className="text-gray-500">
            Skip Tour
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={previousStep} className="gap-1">
            <ChevronLeft size={16} />
            Previous
          </Button>
        )}

        {/* Next/Finish button */}
        {isLastStep ? (
          <Button size="sm" onClick={completeWalkthrough} className="gap-1">
            Finish Tour
            <ChevronRight size={16} />
          </Button>
        ) : (
          <Button size="sm" onClick={nextStep} className="gap-1">
            Next
            <ChevronRight size={16} />
          </Button>
        )}
      </div>

      {/* Keyboard hints */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          Use arrow keys to navigate • ESC to exit
        </p>
      </div>
    </div>
  )
}
