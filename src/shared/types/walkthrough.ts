/**
 * Walkthrough and Feature Highlights Type Definitions
 *
 * Defines the data structures for the user walkthrough system and feature highlights.
 */

/**
 * Represents a single step in the walkthrough tour
 */
export interface WalkthroughStep {
  /** Unique identifier for this step */
  id: string
  /** CSS selector for the element to highlight (e.g., '[data-tour="board"]') */
  targetSelector: string
  /** Title displayed in the tooltip */
  title: string
  /** Description text explaining this feature */
  description: string
  /** Optional route to navigate to before showing this step */
  route?: string
  /** Preferred position for the tooltip relative to the target */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
  /** Additional padding around the spotlight (in pixels) */
  spotlightPadding?: number
  /** Callback executed before showing this step */
  beforeShow?: () => void | Promise<void>
}

/**
 * Custom content for feature highlights
 */
export interface FeatureContent {
  /** Type of content */
  type: 'markdown' | 'image' | 'video'
  /** Content source (markdown text, image URL, or video URL) */
  source: string
  /** Alt text for images/videos */
  alt?: string
  /** Maximum width for images/videos (in pixels) */
  maxWidth?: number
  /** Maximum height for images/videos (in pixels) */
  maxHeight?: number
}

/**
 * Represents a feature highlight for new functionality
 */
export interface FeatureHighlight {
  /** Unique identifier for this feature */
  id: string
  /** CSS selector for the element to badge and highlight */
  targetSelector: string
  /** Title for the feature spotlight */
  title: string
  /** Description of the new feature */
  description: string
  /** Optional custom content (markdown, image, GIF) */
  content?: FeatureContent
  /** Optional route(s) where this feature is located - can be a single route or array of routes */
  route?: string | string[]
  /** Badge text (defaults to "New") */
  badgeText?: string
  /** Optional priority to control display order (lower = shown first) */
  priority?: number
}

/**
 * Persisted walkthrough state (stored in localStorage)
 */
export interface WalkthroughState {
  /** Whether the user has completed the walkthrough */
  walkthroughCompleted: boolean
  /** Whether the user has explicitly skipped the walkthrough */
  walkthroughSkipped: boolean
  /** List of feature IDs the user has acknowledged */
  seenFeatures: string[]
  /** Whether feature spotlights are enabled */
  spotlightsEnabled: boolean
}

/**
 * Tooltip position calculation result
 */
export interface TooltipPosition {
  top: number
  left: number
  position: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * Spotlight bounds for highlighting UI elements
 */
export interface SpotlightBounds {
  top: number
  left: number
  width: number
  height: number
  borderRadius?: number
}

/**
 * Walkthrough context value
 */
export interface WalkthroughContextValue {
  /** Whether the walkthrough is currently active */
  isActive: boolean
  /** Current step index (0-based) */
  currentStepIndex: number
  /** Total number of steps */
  totalSteps: number
  /** Current step data */
  currentStep: WalkthroughStep | null
  /** Start the walkthrough from the beginning */
  startWalkthrough: () => void
  /** Skip/cancel the walkthrough */
  skipWalkthrough: () => void
  /** Move to the next step */
  nextStep: () => void
  /** Move to the previous step */
  previousStep: () => void
  /** Jump to a specific step by index */
  goToStep: (index: number) => void
  /** Complete the walkthrough */
  completeWalkthrough: () => void
  /** Mark a feature as seen */
  markFeatureSeen: (featureId: string) => void
  /** Get unseen features for the current route */
  getUnseenFeaturesForRoute: (route: string) => FeatureHighlight[]
  /** Check if a feature has been seen */
  hasSeenFeature: (featureId: string) => boolean
}
