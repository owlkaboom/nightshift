/**
 * WalkthroughProvider Component
 *
 * Provides walkthrough context and manages the walkthrough state.
 * Handles step navigation, route changes, and feature highlight detection.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import type { WalkthroughContextValue, FeatureHighlight } from '@shared/types/walkthrough'
import { useWalkthroughStore } from '../../stores/walkthrough-store'
import { walkthroughSteps } from './steps'
import { getUnseenFeaturesForRoute } from './features'

const WalkthroughContext = createContext<WalkthroughContextValue | null>(null)

interface WalkthroughProviderProps {
  children: React.ReactNode
  /** Callback when walkthrough active state changes */
  onActiveChange?: (isActive: boolean) => void
}

/**
 * Provider component that manages walkthrough state and provides context
 */
export const WalkthroughProvider: React.FC<WalkthroughProviderProps> = ({
  children,
  onActiveChange
}) => {
  const navigate = useNavigate()
  const location = useLocation()

  // Walkthrough state from Zustand store - use selective subscriptions to avoid re-renders
  const seenFeatures = useWalkthroughStore((state) => state.seenFeatures)
  const spotlightsEnabled = useWalkthroughStore((state) => state.spotlightsEnabled)
  const storeCompleteWalkthrough = useWalkthroughStore((state) => state.completeWalkthrough)
  const storeSkipWalkthrough = useWalkthroughStore((state) => state.skipWalkthrough)
  const markFeatureSeen = useWalkthroughStore((state) => state.markFeatureSeen)
  const hasSeenFeature = useWalkthroughStore((state) => state.hasSeenFeature)

  // Local state for active walkthrough
  const [isActive, setIsActive] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  // Notify parent when active state changes
  useEffect(() => {
    onActiveChange?.(isActive)
  }, [isActive, onActiveChange])

  /**
   * Get the current step
   */
  const currentStep = isActive ? walkthroughSteps[currentStepIndex] || null : null

  /**
   * Start the walkthrough from the beginning
   */
  const startWalkthrough = useCallback(() => {
    console.log('[Walkthrough] Starting walkthrough tour')
    setCurrentStepIndex(0)
    setIsActive(true)

    // Navigate to the first step's route if specified
    const firstStep = walkthroughSteps[0]
    console.log('[Walkthrough] First step:', {
      id: firstStep.id,
      title: firstStep.title,
      route: firstStep.route
    })
    if (firstStep?.route) {
      console.log('[Walkthrough] Navigating to first step route:', firstStep.route)
      navigate({ to: firstStep.route })
    }
  }, [navigate])

  /**
   * Skip/cancel the walkthrough
   */
  const skipWalkthrough = useCallback(() => {
    setIsActive(false)
    setCurrentStepIndex(0)
    storeSkipWalkthrough()
  }, [storeSkipWalkthrough])

  /**
   * Complete the walkthrough
   */
  const completeWalkthrough = useCallback(() => {
    setIsActive(false)
    setCurrentStepIndex(0)
    storeCompleteWalkthrough()
  }, [storeCompleteWalkthrough])

  /**
   * Move to the next step
   */
  const nextStep = useCallback(async () => {
    const nextIndex = currentStepIndex + 1

    console.log('[Walkthrough] Moving to next step:', {
      currentIndex: currentStepIndex,
      nextIndex,
      totalSteps: walkthroughSteps.length
    })

    if (nextIndex >= walkthroughSteps.length) {
      // Reached the end - complete the walkthrough
      console.log('[Walkthrough] Tour complete')
      completeWalkthrough()
      return
    }

    const nextStepData = walkthroughSteps[nextIndex]
    console.log('[Walkthrough] Next step:', {
      id: nextStepData.id,
      title: nextStepData.title,
      route: nextStepData.route,
      targetSelector: nextStepData.targetSelector
    })

    // Execute beforeShow callback if present
    if (nextStepData.beforeShow) {
      await nextStepData.beforeShow()
    }

    // Navigate to the next step's route if specified and different from current
    if (nextStepData.route && location.pathname !== nextStepData.route) {
      console.log('[Walkthrough] Navigating to:', nextStepData.route)
      navigate({ to: nextStepData.route })
      // Wait for navigation to complete before showing the step
      setTimeout(() => {
        console.log('[Walkthrough] Setting step index to:', nextIndex)
        setCurrentStepIndex(nextIndex)
      }, 100)
    } else {
      console.log('[Walkthrough] Updating step index to:', nextIndex)
      setCurrentStepIndex(nextIndex)
    }
  }, [currentStepIndex, completeWalkthrough, navigate, location.pathname])

  /**
   * Move to the previous step
   */
  const previousStep = useCallback(async () => {
    if (currentStepIndex === 0) return

    const prevIndex = currentStepIndex - 1
    const prevStepData = walkthroughSteps[prevIndex]

    console.log('[Walkthrough] Moving to previous step:', {
      currentIndex: currentStepIndex,
      prevIndex,
      stepId: prevStepData.id
    })

    // Execute beforeShow callback if present
    if (prevStepData.beforeShow) {
      await prevStepData.beforeShow()
    }

    // Navigate to the previous step's route if specified and different from current
    if (prevStepData.route && location.pathname !== prevStepData.route) {
      console.log('[Walkthrough] Navigating to:', prevStepData.route)
      navigate({ to: prevStepData.route })
      // Wait for navigation to complete before showing the step
      setTimeout(() => {
        console.log('[Walkthrough] Setting step index to:', prevIndex)
        setCurrentStepIndex(prevIndex)
      }, 100)
    } else {
      console.log('[Walkthrough] Updating step index to:', prevIndex)
      setCurrentStepIndex(prevIndex)
    }
  }, [currentStepIndex, navigate, location.pathname])

  /**
   * Jump to a specific step by index
   */
  const goToStep = useCallback(
    async (index: number) => {
      if (index < 0 || index >= walkthroughSteps.length) return

      const targetStep = walkthroughSteps[index]

      // Execute beforeShow callback if present
      if (targetStep.beforeShow) {
        await targetStep.beforeShow()
      }

      // Navigate to the step's route if specified and different from current
      if (targetStep.route && location.pathname !== targetStep.route) {
        navigate({ to: targetStep.route })
        // Wait for navigation to complete before showing the step
        setTimeout(() => {
          setCurrentStepIndex(index)
        }, 100)
      } else {
        setCurrentStepIndex(index)
      }
    },
    [navigate, location.pathname]
  )

  /**
   * Get unseen features for the current route
   */
  const getUnseenFeaturesForRouteCallback = useCallback(
    (route: string): FeatureHighlight[] => {
      return getUnseenFeaturesForRoute(route, seenFeatures, spotlightsEnabled)
    },
    [seenFeatures, spotlightsEnabled]
  )

  // Keyboard shortcuts for walkthrough navigation
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts if walkthrough is active
      if (!isActive) return

      // Escape - skip walkthrough
      if (e.key === 'Escape') {
        e.preventDefault()
        skipWalkthrough()
        return
      }

      // Arrow right / Enter - next step
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        nextStep()
        return
      }

      // Arrow left - previous step
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        previousStep()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, nextStep, previousStep, skipWalkthrough])

  const contextValue: WalkthroughContextValue = {
    isActive,
    currentStepIndex,
    totalSteps: walkthroughSteps.length,
    currentStep,
    startWalkthrough,
    skipWalkthrough,
    nextStep,
    previousStep,
    goToStep,
    completeWalkthrough,
    markFeatureSeen,
    getUnseenFeaturesForRoute: getUnseenFeaturesForRouteCallback,
    hasSeenFeature
  }

  return (
    <WalkthroughContext.Provider value={contextValue}>{children}</WalkthroughContext.Provider>
  )
}

/**
 * Hook to access walkthrough context
 * @throws {Error} If used outside of WalkthroughProvider
 */
export const useWalkthrough = (): WalkthroughContextValue => {
  const context = useContext(WalkthroughContext)
  if (!context) {
    throw new Error('useWalkthrough must be used within a WalkthroughProvider')
  }
  return context
}
