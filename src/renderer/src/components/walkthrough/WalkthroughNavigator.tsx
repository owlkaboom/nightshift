/**
 * WalkthroughNavigator Component
 *
 * A persistent floating widget that shows tour progress and navigation controls.
 * Always visible during the walkthrough, regardless of which step is active.
 */

import React, { useState } from 'react'
import { useWalkthrough } from './WalkthroughProvider'
import { Button } from '../ui/button'
import { X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'

/**
 * Floating navigation widget for the walkthrough tour
 */
export const WalkthroughNavigator: React.FC = () => {
  const {
    isActive,
    currentStepIndex,
    totalSteps,
    currentStep,
    nextStep,
    previousStep,
    skipWalkthrough,
    completeWalkthrough
  } = useWalkthrough()

  const [isMinimized, setIsMinimized] = useState(false)

  // Don't render if walkthrough is not active
  if (!isActive || !currentStep) {
    return null
  }

  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === totalSteps - 1
  const progressPercent = ((currentStepIndex + 1) / totalSteps) * 100

  // Minimized state - just show progress and expand button
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-[10001] pointer-events-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {currentStepIndex + 1}/{totalSteps}
              </span>
              <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <button
              onClick={() => setIsMinimized(false)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              aria-label="Expand tour controls"
            >
              <ChevronUp size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Expanded state - full controls
  return (
    <div className="fixed bottom-6 right-6 z-[10001] pointer-events-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4 w-80">
        {/* Header with title and controls */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Tour Guide
              </h4>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Step {currentStepIndex + 1} of {totalSteps}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
              {currentStep.title}
            </p>
          </div>
          <div className="flex gap-1 ml-2">
            <button
              onClick={() => setIsMinimized(true)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Minimize tour controls"
            >
              <ChevronDown size={16} />
            </button>
            <button
              onClick={skipWalkthrough}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Exit tour"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-4">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStepIndex
                  ? 'w-8 bg-blue-500'
                  : i < currentStepIndex
                    ? 'w-1.5 bg-blue-300 dark:bg-blue-400'
                    : 'w-1.5 bg-gray-300 dark:bg-gray-600'
              }`}
              title={i < currentStepIndex ? 'Completed' : i === currentStepIndex ? 'Current' : 'Upcoming'}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between gap-2">
          {/* Previous button or skip */}
          {isFirstStep ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={skipWalkthrough}
              className="text-gray-500 flex-1"
            >
              Skip Tour
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={previousStep}
              className="gap-1 flex-1"
            >
              <ChevronLeft size={16} />
              Back
            </Button>
          )}

          {/* Next button or finish */}
          {isLastStep ? (
            <Button size="sm" onClick={completeWalkthrough} className="gap-1 flex-1">
              Finish
              <ChevronRight size={16} />
            </Button>
          ) : (
            <Button size="sm" onClick={nextStep} className="gap-1 flex-1">
              Next
              <ChevronRight size={16} />
            </Button>
          )}
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            ← → Arrow keys to navigate • ESC to exit
          </p>
        </div>
      </div>
    </div>
  )
}
