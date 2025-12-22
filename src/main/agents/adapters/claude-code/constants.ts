/**
 * Constants for Claude Code Adapter
 */

/** API endpoint for usage data */
export const USAGE_API_URL = 'https://api.anthropic.com/api/oauth/usage'

/** API endpoint for models list */
export const MODELS_API_URL = 'https://api.anthropic.com/v1/models'

/** Cache duration for models list (24 hours in ms) */
export const MODELS_CACHE_DURATION = 24 * 60 * 60 * 1000

/** User agent to use for API requests */
export const USER_AGENT = 'claude-code/2.0.32'

/** Beta header required for OAuth API */
export const ANTHROPIC_BETA = 'oauth-2025-04-20'
