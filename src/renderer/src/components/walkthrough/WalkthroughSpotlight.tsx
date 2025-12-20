/**
 * WalkthroughSpotlight Component
 *
 * Creates a spotlight effect that highlights a target element with a backdrop overlay.
 * Manages positioning, animations, and rendering of the tooltip.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { SpotlightBounds } from '@shared/types/walkthrough'
import { useWalkthrough } from './WalkthroughProvider'
import { WalkthroughTooltip } from './WalkthroughTooltip'
import { WalkthroughNavigator } from './WalkthroughNavigator'

/**
 * Spotlight component that highlights the current walkthrough step's target element
 */
export const WalkthroughSpotlight: React.FC = () => {
  const { isActive, currentStep, skipWalkthrough } = useWalkthrough()
  const [spotlightBounds, setSpotlightBounds] = useState<SpotlightBounds | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const targetElementRef = useRef<Element | null>(null)

  /**
   * Calculate spotlight bounds for the target element
   */
  const calculateSpotlightBounds = useCallback((): SpotlightBounds | null => {
    if (!currentStep) return null

    // Use cached element if selector hasn't changed
    let targetElement = targetElementRef.current
    if (!targetElement || targetElement.matches?.(currentStep.targetSelector) === false) {
      targetElement = document.querySelector(currentStep.targetSelector)
      targetElementRef.current = targetElement
    }

    if (!targetElement) {
      if (import.meta.env.DEV) {
        console.warn(`[WalkthroughSpotlight] Target element not found: ${currentStep.targetSelector}`)
      }
      return null
    }

    const rect = targetElement.getBoundingClientRect()
    const padding = currentStep.spotlightPadding || 8

    // Cache computed style (expensive operation)
    const computedStyle = window.getComputedStyle(targetElement)
    const borderRadius = parseInt(computedStyle.borderRadius) || 8

    return {
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      borderRadius: borderRadius + padding / 2
    }
  }, [currentStep])

  /**
   * Update spotlight bounds on scroll, resize, or step change
   */
  const updateSpotlight = useCallback(() => {
    const bounds = calculateSpotlightBounds()
    setSpotlightBounds(bounds)
  }, [calculateSpotlightBounds])

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
   * Set up spotlight when walkthrough becomes active or step changes
   */
  useEffect(() => {
    if (!isActive || !currentStep) {
      setIsVisible(false)
      setSpotlightBounds(null)
      targetElementRef.current = null
      return
    }

    // Reset element cache when step changes
    targetElementRef.current = null

    // Use double RAF for better frame timing
    animationFrameRef.current = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Calculate bounds first (this caches the element)
        const bounds = calculateSpotlightBounds()

        if (bounds) {
          // Scroll to target
          scrollToTarget()

          // Reduced wait time - show spotlight sooner
          setTimeout(() => {
            setSpotlightBounds(bounds)
            setIsVisible(true)
          }, 150) // Reduced from 300ms
        }
      })
    })

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isActive, currentStep, calculateSpotlightBounds, scrollToTarget])

  /**
   * Update spotlight position on scroll and resize
   */
  useEffect(() => {
    if (!isActive || !isVisible) return

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
  }, [isActive, isVisible, updateSpotlight])

  if (!isActive || !currentStep || !spotlightBounds || !isVisible) {
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
        onClick={skipWalkthrough}
      >
        <defs>
          <mask id="spotlight-mask">
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
          mask="url(#spotlight-mask)"
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

      {/* Tooltip */}
      <WalkthroughTooltip spotlightBounds={spotlightBounds} />

      {/* Floating navigation widget */}
      <WalkthroughNavigator />
    </div>,
    document.body
  )
}
