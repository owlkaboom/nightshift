/**
 * WalkthroughPrompt Component
 *
 * Shows a prompt dialog asking the user if they want to take the walkthrough tour.
 * Appears after initial setup for first-time users.
 */

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import { Button } from '../ui/button'
import { useWalkthrough } from './WalkthroughProvider'
import { useWalkthroughStore } from '../../stores/walkthrough-store'
import { Compass } from 'lucide-react'

interface WalkthroughPromptProps {
  /** Whether to show the prompt (controlled externally) */
  show?: boolean
  /** Callback when prompt is dismissed */
  onDismiss?: () => void
}

/**
 * Prompt dialog that asks users if they want to start the walkthrough
 */
export const WalkthroughPrompt: React.FC<WalkthroughPromptProps> = ({ show, onDismiss }) => {
  const { startWalkthrough } = useWalkthrough()
  const { shouldShowWalkthrough, skipWalkthrough } = useWalkthroughStore()
  const [isOpen, setIsOpen] = useState(false)

  /**
   * Show prompt if:
   * - Controlled mode: `show` prop is true
   * - Uncontrolled mode: user hasn't completed or skipped walkthrough
   */
  useEffect(() => {
    if (show !== undefined) {
      setIsOpen(show)
    } else {
      setIsOpen(shouldShowWalkthrough())
    }
  }, [show, shouldShowWalkthrough])

  /**
   * Handle starting the tour
   */
  const handleStartTour = () => {
    setIsOpen(false)
    startWalkthrough()
    onDismiss?.()
  }

  /**
   * Handle skipping the tour
   */
  const handleSkipTour = () => {
    setIsOpen(false)
    skipWalkthrough()
    onDismiss?.()
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Compass className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <DialogTitle className="text-xl">Take a tour?</DialogTitle>
          </div>
          <DialogDescription className="text-base leading-relaxed">
            Let us show you around Nightshift! We'll walk you through the key features and help you
            get started with AI-assisted task management.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 my-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            You'll learn about:
          </h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Creating and managing AI coding tasks</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Organizing work with projects</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Using AI planning sessions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Customizing AI behavior with skills</span>
            </li>
          </ul>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleSkipTour}>
            Skip for now
          </Button>
          <Button onClick={handleStartTour} className="gap-2">
            <Compass size={16} />
            Start Tour
          </Button>
        </DialogFooter>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
          You can restart this tour anytime from Settings
        </p>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Auto-showing prompt component that manages its own visibility
 * Shows automatically if user hasn't completed or skipped the walkthrough
 */
export const AutoWalkthroughPrompt: React.FC = () => {
  const { shouldShowWalkthrough } = useWalkthroughStore()
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    // Delay showing the prompt slightly to avoid showing on every app start
    // Only show if user should see it
    const timer = setTimeout(() => {
      setShouldShow(shouldShowWalkthrough())
    }, 1000)

    return () => clearTimeout(timer)
  }, [shouldShowWalkthrough])

  if (!shouldShow) return null

  return <WalkthroughPrompt show={shouldShow} onDismiss={() => setShouldShow(false)} />
}
