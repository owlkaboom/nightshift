/**
 * FeatureBadge Component
 *
 * Displays a "New" or "Improved" badge on UI elements for feature highlights.
 * Automatically hides once the user has seen the feature.
 */

import React, { useEffect, useState } from 'react'
import { useWalkthrough } from './WalkthroughProvider'
import { getFeatureById } from './features'

interface FeatureBadgeProps {
  /** ID of the feature to badge */
  featureId: string
  /** Position of the badge relative to the parent element */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  /** Whether to show a pulsing animation */
  pulse?: boolean
  /** Custom badge text (overrides feature's default) */
  badgeText?: string
}

/**
 * Badge component that marks new or improved features
 */
export const FeatureBadge: React.FC<FeatureBadgeProps> = ({
  featureId,
  position = 'top-right',
  pulse = true,
  badgeText
}) => {
  const { hasSeenFeature, markFeatureSeen, isActive } = useWalkthrough()
  const [isVisible, setIsVisible] = useState(false)
  const [shouldPulse, setShouldPulse] = useState(pulse)

  const feature = getFeatureById(featureId)

  useEffect(() => {
    if (!feature) {
      console.warn(`[FeatureBadge] Feature not found: ${featureId}`)
      return undefined
    }

    // Don't show badge during walkthrough tour
    if (isActive) {
      setIsVisible(false)
      return undefined
    }

    // Show badge if user hasn't seen this feature
    const seen = hasSeenFeature(featureId)
    setIsVisible(!seen)

    // Stop pulsing after a few seconds to avoid being too distracting
    if (!seen && pulse) {
      const timer = setTimeout(() => {
        setShouldPulse(false)
      }, 5000)
      return () => clearTimeout(timer)
    }

    return undefined
  }, [featureId, feature, hasSeenFeature, pulse, isActive])

  /**
   * Mark feature as seen when user interacts with the badged element
   */
  const handleInteraction = () => {
    if (!hasSeenFeature(featureId)) {
      markFeatureSeen(featureId)
      setIsVisible(false)
    }
  }

  // Listen for clicks on parent element
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const badgeElement = document.querySelector(`[data-feature="${featureId}"]`)

      if (badgeElement && (badgeElement.contains(target) || badgeElement === target)) {
        handleInteraction()
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [featureId, hasSeenFeature, markFeatureSeen])

  if (!isVisible || !feature) {
    return null
  }

  const positionClasses = {
    'top-right': 'top-0 right-0 translate-x-1/2 -translate-y-1/2',
    'top-left': 'top-0 left-0 -translate-x-1/2 -translate-y-1/2',
    'bottom-right': 'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
    'bottom-left': 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2'
  }

  const displayText = badgeText || feature.badgeText || 'New'

  return (
    <span
      className={`
        absolute z-10 pointer-events-none
        inline-flex items-center justify-center
        px-2 py-0.5 text-xs font-medium
        rounded-full
        bg-blue-500 text-white
        shadow-lg
        transition-all duration-300
        ${positionClasses[position]}
        ${shouldPulse ? 'animate-pulse' : ''}
      `}
      style={{
        animation: shouldPulse ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : undefined
      }}
    >
      {displayText}
      {/* Decorative ping effect */}
      {shouldPulse && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
      )}
    </span>
  )
}

/**
 * Wrapper component that adds the feature badge and data attribute to its children
 */
interface FeatureBadgeWrapperProps extends FeatureBadgeProps {
  children: React.ReactNode
  /** Additional className for the wrapper */
  className?: string
}

export const FeatureBadgeWrapper: React.FC<FeatureBadgeWrapperProps> = ({
  children,
  featureId,
  position,
  pulse,
  badgeText,
  className = ''
}) => {
  return (
    <div className={`relative ${className}`} data-feature={featureId}>
      <FeatureBadge
        featureId={featureId}
        position={position}
        pulse={pulse}
        badgeText={badgeText}
      />
      {children}
    </div>
  )
}
