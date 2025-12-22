/**
 * AutoFeatureSpotlight Component
 *
 * Automatically shows a spotlight for unseen features when the user navigates to a route.
 * This component detects new features on the current route and triggers the spotlight
 * to highlight them one at a time.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useLocation } from '@tanstack/react-router'
import { createPortal } from 'react-dom'
import type { FeatureHighlight, SpotlightBounds, TooltipPosition } from '@shared/types/walkthrough'
import { useWalkthrough } from './WalkthroughProvider'
import { useWalkthroughStore } from '@/stores/walkthrough-store'
import { Button } from '@/components/ui/button'
import { X, Sparkles } from 'lucide-react'
import { MarkdownRenderer } from '@/components/ui/markdown-renderer'
import { logger } from '@/lib/logger'

/**
 * Auto-showing feature spotlight that activates when unseen features are on the current route
 */
export const AutoFeatureSpotlight: React.FC = () => {
  const location = useLocation()
  const { getUnseenFeaturesForRoute, markFeatureSeen, isActive } = useWalkthrough()
  const walkthroughCompleted = useWalkthroughStore((state) => state.walkthroughCompleted)
  const walkthroughSkipped = useWalkthroughStore((state) => state.walkthroughSkipped)

  const [currentFeature, setCurrentFeature] = useState<FeatureHighlight | null>(null)
  const [spotlightBounds, setSpotlightBounds] = useState<SpotlightBounds | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const isDismissingRef = useRef(false)
  const targetElementRef = useRef<Element | null>(null)

  /**
   * Calculate spotlight bounds for the target element
   */
  const calculateSpotlightBounds = useCallback((feature: FeatureHighlight): SpotlightBounds | null => {
    // Use cached element if it matches the selector
    let targetElement = targetElementRef.current
    if (!targetElement || targetElement.matches?.(feature.targetSelector) === false) {
      targetElement = document.querySelector(feature.targetSelector)
      targetElementRef.current = targetElement
    }

    if (!targetElement) {
      logger.debug(`[AutoFeatureSpotlight] Target element not found: ${feature.targetSelector}`)
      return null
    }

    const rect = targetElement.getBoundingClientRect()
    const padding = 8

    // Cache computed style
    const computedStyle = window.getComputedStyle(targetElement)
    const borderRadius = parseInt(computedStyle.borderRadius) || 8

    return {
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      borderRadius: borderRadius + padding / 2
    }
  }, [])

  /**
   * Update spotlight bounds
   */
  const updateSpotlight = useCallback(() => {
    if (!currentFeature) return
    const bounds = calculateSpotlightBounds(currentFeature)
    setSpotlightBounds(bounds)
  }, [currentFeature, calculateSpotlightBounds])

  /**
   * Scroll target element into view with optimal positioning
   */
  const scrollToTarget = useCallback(() => {
    const targetElement = targetElementRef.current
    if (!targetElement) return

    // Use scrollIntoView with smooth behavior and center alignment
    targetElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    })
  }, [])

  /**
   * Detect and show unseen features when route changes
   */
  useEffect(() => {
    // Don't show auto-spotlight if:
    // 1. Walkthrough tour is active
    // 2. User hasn't completed or skipped the walkthrough yet
    // 3. Currently dismissing a feature
    if (isActive || (!walkthroughCompleted && !walkthroughSkipped) || isDismissingRef.current) {
      logger.debug('[AutoFeatureSpotlight] Spotlight blocked:', {
        isActive,
        walkthroughCompleted,
        walkthroughSkipped,
        isDismissing: isDismissingRef.current,
        reason: isActive ? 'walkthrough active' :
                (!walkthroughCompleted && !walkthroughSkipped) ? 'walkthrough not completed/skipped' :
                'dismissing feature'
      })
      setCurrentFeature(null)
      setIsVisible(false)
      targetElementRef.current = null
      return
    }

    // Wait for DOM to update after navigation
    const timer = setTimeout(() => {
      // Double-check we're not dismissing
      if (isDismissingRef.current) return

      logger.debug('[AutoFeatureSpotlight] Checking for features on route:', location.pathname)

      const unseenFeatures = getUnseenFeaturesForRoute(location.pathname)

      logger.debug('[AutoFeatureSpotlight] Route changed:', location.pathname)
      logger.debug('[AutoFeatureSpotlight] Unseen features:', unseenFeatures.length)
      logger.debug('[AutoFeatureSpotlight] Unseen feature IDs:', unseenFeatures.map(f => f.id))

      if (unseenFeatures.length > 0) {
        // Show the first unseen feature (already sorted by priority)
        const firstFeature = unseenFeatures[0]
        targetElementRef.current = null // Reset cache
        setCurrentFeature(firstFeature)

        logger.debug('[AutoFeatureSpotlight] Attempting to show feature:', firstFeature.id)
        logger.debug('[AutoFeatureSpotlight] Target selector:', firstFeature.targetSelector)

        // Use double RAF for better frame timing
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const bounds = calculateSpotlightBounds(firstFeature)
            if (bounds) {
              logger.debug('[AutoFeatureSpotlight] Bounds calculated successfully:', bounds)
              // Scroll to target
              scrollToTarget()

              // Reduced wait time
              setTimeout(() => {
                setSpotlightBounds(bounds)
                setIsVisible(true)
              }, 150) // Reduced from 300ms
            } else {
              logger.debug('[AutoFeatureSpotlight] Could not calculate bounds for feature:', firstFeature.id)
              logger.debug('[AutoFeatureSpotlight] Element exists?', document.querySelector(firstFeature.targetSelector) !== null)
            }
          })
        })
      } else {
        setCurrentFeature(null)
        setIsVisible(false)
        targetElementRef.current = null
      }
    }, 400) // Increased from 200ms to give elements more time to render

    return () => clearTimeout(timer)
  }, [location.pathname, getUnseenFeaturesForRoute, isActive, walkthroughCompleted, walkthroughSkipped, calculateSpotlightBounds, scrollToTarget])

  /**
   * Update spotlight position on scroll and resize
   */
  useEffect(() => {
    if (!currentFeature || !isVisible) return

    // Use RAF-based throttling for better performance
    let rafId: number | undefined
    let isScheduled = false

    const throttledUpdate = () => {
      if (isScheduled) return
      isScheduled = true

      rafId = requestAnimationFrame(() => {
        updateSpotlight()
        isScheduled = false
      })
    }

    window.addEventListener('scroll', throttledUpdate, true)
    window.addEventListener('resize', throttledUpdate)

    return () => {
      window.removeEventListener('scroll', throttledUpdate, true)
      window.removeEventListener('resize', throttledUpdate)
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [currentFeature, isVisible, updateSpotlight])

  /**
   * Check if two rectangles overlap
   */
  const rectanglesOverlap = useCallback((
    rect1: { top: number; left: number; width: number; height: number },
    rect2: { top: number; left: number; width: number; height: number }
  ): boolean => {
    return !(
      rect1.left + rect1.width < rect2.left ||
      rect2.left + rect2.width < rect1.left ||
      rect1.top + rect1.height < rect2.top ||
      rect2.top + rect2.height < rect1.top
    )
  }, [])

  /**
   * Calculate tooltip position relative to spotlight
   */
  const calculateTooltipPosition = useCallback((): TooltipPosition | null => {
    if (!tooltipRef.current || !spotlightBounds) return null

    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const gap = 16

    const positions = {
      bottom: {
        top: spotlightBounds.top + spotlightBounds.height + gap,
        left: spotlightBounds.left + spotlightBounds.width / 2 - tooltipRect.width / 2,
        position: 'bottom' as const
      },
      top: {
        top: spotlightBounds.top - tooltipRect.height - gap,
        left: spotlightBounds.left + spotlightBounds.width / 2 - tooltipRect.width / 2,
        position: 'top' as const
      },
      right: {
        top: spotlightBounds.top + spotlightBounds.height / 2 - tooltipRect.height / 2,
        left: spotlightBounds.left + spotlightBounds.width + gap,
        position: 'right' as const
      },
      left: {
        top: spotlightBounds.top + spotlightBounds.height / 2 - tooltipRect.height / 2,
        left: spotlightBounds.left - tooltipRect.width - gap,
        position: 'left' as const
      }
    }

    // Find first position that fits in viewport AND doesn't overlap spotlight
    for (const position of ['bottom', 'top', 'right', 'left'] as const) {
      const pos = positions[position]

      // Check viewport boundaries
      const fitsInViewport =
        pos.top >= 0 &&
        pos.top + tooltipRect.height <= viewportHeight &&
        pos.left >= 0 &&
        pos.left + tooltipRect.width <= viewportWidth

      if (!fitsInViewport) continue

      // Check if tooltip would overlap with spotlight
      const tooltipBounds = {
        top: pos.top,
        left: pos.left,
        width: tooltipRect.width,
        height: tooltipRect.height
      }

      const overlapsSpotlight = rectanglesOverlap(tooltipBounds, spotlightBounds)

      if (!overlapsSpotlight) {
        return pos
      }
    }

    // Fallback: find position with minimum overlap
    // Try each position and calculate overlap area
    let bestPosition: { top: number; left: number; position: 'top' | 'bottom' | 'left' | 'right' } = positions.bottom
    let minOverlapArea = Infinity

    for (const position of ['bottom', 'top', 'right', 'left'] as const) {
      const pos = positions[position]

      // Constrain to viewport
      const constrainedTop = Math.max(gap, Math.min(pos.top, viewportHeight - tooltipRect.height - gap))
      const constrainedLeft = Math.max(gap, Math.min(pos.left, viewportWidth - tooltipRect.width - gap))

      const tooltipBounds = {
        top: constrainedTop,
        left: constrainedLeft,
        width: tooltipRect.width,
        height: tooltipRect.height
      }

      // Calculate overlap area
      const overlapLeft = Math.max(tooltipBounds.left, spotlightBounds.left)
      const overlapRight = Math.min(
        tooltipBounds.left + tooltipBounds.width,
        spotlightBounds.left + spotlightBounds.width
      )
      const overlapTop = Math.max(tooltipBounds.top, spotlightBounds.top)
      const overlapBottom = Math.min(
        tooltipBounds.top + tooltipBounds.height,
        spotlightBounds.top + spotlightBounds.height
      )

      const overlapArea =
        overlapRight > overlapLeft && overlapBottom > overlapTop
          ? (overlapRight - overlapLeft) * (overlapBottom - overlapTop)
          : 0

      if (overlapArea < minOverlapArea) {
        minOverlapArea = overlapArea
        bestPosition = {
          top: constrainedTop,
          left: constrainedLeft,
          position: pos.position
        }
      }
    }

    return bestPosition
  }, [spotlightBounds, rectanglesOverlap])

  /**
   * Update tooltip position when spotlight bounds change
   */
  useEffect(() => {
    if (spotlightBounds && isVisible) {
      // Use requestAnimationFrame to ensure the tooltip DOM is ready
      requestAnimationFrame(() => {
        if (tooltipRef.current) {
          const position = calculateTooltipPosition()
          setTooltipPosition(position)
        }
      })
    }
  }, [spotlightBounds, isVisible, calculateTooltipPosition])

  /**
   * Handle user dismissing the spotlight
   */
  const handleDismiss = useCallback(() => {
    if (!currentFeature || isDismissingRef.current) return

    // Set dismissing flag to prevent route change effect from re-triggering
    isDismissingRef.current = true

    const dismissedFeatureId = currentFeature.id

    // Mark as seen and hide current spotlight
    markFeatureSeen(dismissedFeatureId)
    setIsVisible(false)
    setCurrentFeature(null)
    targetElementRef.current = null

    // Check for more unseen features after a delay
    // Important: We need to wait for the state update to propagate
    setTimeout(() => {
      // Get fresh unseen features - the markFeatureSeen should have updated by now
      const unseenFeatures = getUnseenFeaturesForRoute(location.pathname)

      // Filter out the feature we just dismissed (in case state hasn't updated yet)
      const filteredFeatures = unseenFeatures.filter(f => f.id !== dismissedFeatureId)

      if (filteredFeatures.length > 0) {
        const nextFeature = filteredFeatures[0]
        targetElementRef.current = null
        setCurrentFeature(nextFeature)

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const bounds = calculateSpotlightBounds(nextFeature)
            if (bounds) {
              scrollToTarget()

              setTimeout(() => {
                setSpotlightBounds(bounds)
                setIsVisible(true)
                isDismissingRef.current = false
              }, 150) // Reduced from 300ms
            }
          })
        })
      } else {
        // No more features, clear dismissing flag
        isDismissingRef.current = false
      }
    }, 400) // Reduced from 500ms
  }, [currentFeature, markFeatureSeen, getUnseenFeaturesForRoute, location.pathname, calculateSpotlightBounds, scrollToTarget])

  // Don't render if no feature or not visible
  if (!isVisible || !currentFeature || !spotlightBounds) {
    return null
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999]"
      style={{
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 300ms ease-in-out'
      }}
    >
      {/* Backdrop with SVG mask for spotlight cutout */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto cursor-pointer"
        style={{ zIndex: 9999 }}
        onClick={handleDismiss}
      >
        <defs>
          <mask id="auto-spotlight-mask">
            {/* White background - visible area */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cutout - transparent area (the spotlight) */}
            <rect
              x={spotlightBounds.left}
              y={spotlightBounds.top}
              width={spotlightBounds.width}
              height={spotlightBounds.height}
              rx={spotlightBounds.borderRadius}
              ry={spotlightBounds.borderRadius}
              fill="black"
            />
          </mask>
        </defs>
        {/* Semi-transparent backdrop using the mask */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.7)"
          mask="url(#auto-spotlight-mask)"
        />
      </svg>

      {/* Highlight border around the spotlight */}
      <div
        className="absolute border-2 border-blue-500 shadow-lg pointer-events-none transition-all duration-150"
        style={{
          top: `${spotlightBounds.top}px`,
          left: `${spotlightBounds.left}px`,
          width: `${spotlightBounds.width}px`,
          height: `${spotlightBounds.height}px`,
          borderRadius: `${spotlightBounds.borderRadius}px`,
          boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3)'
        }}
      />

      {/* Custom tooltip for feature highlight */}
      <div
        ref={tooltipRef}
        className="absolute bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 max-w-md pointer-events-auto transition-all duration-300"
        style={{
          top: tooltipPosition ? `${tooltipPosition.top}px` : '-9999px',
          left: tooltipPosition ? `${tooltipPosition.left}px` : '-9999px',
          opacity: tooltipPosition ? 1 : 0,
          zIndex: 10000
        }}
      >
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Dismiss feature highlight"
          >
            <X size={18} />
          </button>

          {/* Feature badge */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500 text-white">
              {currentFeature.badgeText || 'New'}
            </span>
          </div>

          {/* Content */}
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {currentFeature.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
              {currentFeature.description}
            </p>

            {/* Custom content section */}
            {currentFeature.content && (
              <div className="mt-4">
                {currentFeature.content.type === 'markdown' && (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <MarkdownRenderer content={currentFeature.content.source} />
                  </div>
                )}

                {currentFeature.content.type === 'image' && (
                  <div className="flex justify-center">
                    <img
                      src={currentFeature.content.source}
                      alt={currentFeature.content.alt || currentFeature.title}
                      className="rounded-lg shadow-md"
                      style={{
                        maxWidth: currentFeature.content.maxWidth
                          ? `${currentFeature.content.maxWidth}px`
                          : '100%',
                        maxHeight: currentFeature.content.maxHeight
                          ? `${currentFeature.content.maxHeight}px`
                          : '300px',
                        objectFit: 'contain'
                      }}
                    />
                  </div>
                )}

                {currentFeature.content.type === 'video' && (
                  <div className="flex justify-center">
                    <video
                      src={currentFeature.content.source}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="rounded-lg shadow-md"
                      style={{
                        maxWidth: currentFeature.content.maxWidth
                          ? `${currentFeature.content.maxWidth}px`
                          : '100%',
                        maxHeight: currentFeature.content.maxHeight
                          ? `${currentFeature.content.maxHeight}px`
                          : '300px',
                        objectFit: 'contain'
                      }}
                    >
                      {currentFeature.content.alt && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {currentFeature.content.alt}
                        </p>
                      )}
                    </video>
                  </div>
                )}
              </div>
            )}
          </div>

        {/* Got it button */}
        <div className="flex items-center justify-end">
          <Button onClick={handleDismiss} size="sm">
            Got it
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
