// Base adapter class with shared functionality
export {
  BaseAgentAdapter,
  wrapChildProcess,
  type UsageLimitResult,
  type AuthValidationResult,
  type UsageLimitCheckResult,
  type UsagePercentageResult
} from './base-adapter'

// Concrete adapter implementations
export { ClaudeCodeAdapter, claudeCodeAdapter } from './claude-code'
export { GeminiAdapter, geminiAdapter, GEMINI_RATE_LIMITS, GEMINI_MODEL_LIMITS } from './gemini'
export type { GeminiTier } from './gemini'
export { OpenRouterAdapter, openrouterAdapter } from './openrouter'
