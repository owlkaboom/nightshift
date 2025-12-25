/**
 * Project Analysis Module
 *
 * Exports all analysis functionality for technology detection,
 * pattern detection, and skill recommendations.
 */

// Main analyzer service
export {
  analyzeProject,
  getCachedAnalysis,
  clearAnalysisCache,
  clearAllAnalysisCache,
  detectProjectTechnologies,
  detectProjectPatterns,
  getProjectRecommendations,
  createSkillsFromRecommendations,
  updateRecommendationSelection,
  selectAllRecommendations,
  getSelectedRecommendationIds
} from './project-analyzer'

// Technology detection
export { detectTechnologies, detectTechnologiesWithThreshold } from './tech-detector'

// Pattern detection
export { detectPatterns, detectPatternsWithThreshold } from './pattern-detector'

// Skill recommendations
// Skill-related exports removed - skills feature has been removed from the codebase
