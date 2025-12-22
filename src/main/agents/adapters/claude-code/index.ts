/**
 * Claude Code Adapter Module
 *
 * Exports the Claude Code CLI adapter and related utilities.
 */

export { ClaudeCodeAdapter, claudeCodeAdapter } from './adapter'
export { findClaudeCli, resolveCliExecution, isNodeManagerPath, POSSIBLE_PATHS } from './cli-resolution'
export type { CliExecution } from './cli-resolution'
export { detectRateLimit, detectUsageLimit, detectAuthError, parseLine, parseOutputStream } from './output-parser'
export type { UsageLimitResult } from './output-parser'
export { getOAuthToken } from './oauth'
export { fetchUsagePercentage, fetchAvailableModels, clearModelsCache } from './api'
export type { UsagePercentage } from './api'
export * from './constants'
