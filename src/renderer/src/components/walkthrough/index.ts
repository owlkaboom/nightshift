/**
 * Walkthrough Components
 *
 * Export all walkthrough-related components and utilities.
 */

export { WalkthroughProvider, useWalkthrough } from './WalkthroughProvider'
export { WalkthroughSpotlight } from './WalkthroughSpotlight'
export { WalkthroughTooltip } from './WalkthroughTooltip'
export { WalkthroughNavigator } from './WalkthroughNavigator'
export { WalkthroughPrompt, AutoWalkthroughPrompt } from './WalkthroughPrompt'
export { FeatureBadge, FeatureBadgeWrapper } from './FeatureBadge'
export { AutoFeatureSpotlight } from './AutoFeatureSpotlight'

export { walkthroughSteps, getStepById, getStepIndex, getTotalSteps } from './steps'
export {
  featureHighlights,
  getFeaturesForRoute,
  getFeatureById,
  getUnseenFeaturesForRoute
} from './features'
