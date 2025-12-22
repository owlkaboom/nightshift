/**
 * Anthropic API Integration Module
 *
 * Handles API calls to Anthropic for usage data and model listings.
 */

import type { AgentModelInfo } from '@shared/types'
import { CLAUDE_CODE_MODELS } from '@shared/types'
import { logger } from '@main/utils/logger'
import { USAGE_API_URL, MODELS_API_URL, USER_AGENT, ANTHROPIC_BETA, MODELS_CACHE_DURATION } from './constants'
import { getOAuthToken } from './oauth'

/**
 * Usage percentage response
 */
export interface UsagePercentage {
  fiveHour: { utilization: number; resetsAt: string } | null
  sevenDay: { utilization: number; resetsAt: string } | null
  error: string | null
}

/**
 * Raw model from Anthropic API
 */
interface ApiModel {
  id: string
  display_name?: string
  created_at?: string
}

// Module-level cache for models
let cachedModels: AgentModelInfo[] | null = null
let modelsCacheTime = 0

/**
 * Get current usage percentage from the Anthropic API
 * Returns null values gracefully if token unavailable or API fails
 */
export async function fetchUsagePercentage(): Promise<UsagePercentage> {
  const unavailable = { fiveHour: null, sevenDay: null, error: null }

  try {
    const token = await getOAuthToken()
    if (!token) {
      // Token not available - usage info simply not accessible
      return unavailable
    }

    const response = await fetch(USAGE_API_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': ANTHROPIC_BETA,
        'User-Agent': USER_AGENT,
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      // API error - return unavailable without surfacing error to user
      return unavailable
    }

    const data = (await response.json()) as {
      five_hour?: { utilization: number; resets_at: string }
      seven_day?: { utilization: number; resets_at: string }
    }

    return {
      fiveHour: data.five_hour
        ? { utilization: data.five_hour.utilization, resetsAt: data.five_hour.resets_at }
        : null,
      sevenDay: data.seven_day
        ? { utilization: data.seven_day.utilization, resetsAt: data.seven_day.resets_at }
        : null,
      error: null
    }
  } catch {
    // Any error - usage info simply not available
    return unavailable
  }
}

/**
 * Format a model ID into a display name
 */
function formatModelName(id: string): string {
  // e.g., "claude-sonnet-4-20250514" -> "Claude Sonnet 4"
  // e.g., "claude-3-5-sonnet-20241022" -> "Claude 3.5 Sonnet"
  const parts = id.split('-')
  let name = ''

  for (const part of parts) {
    // Skip date suffixes (8 digits)
    if (/^\d{8}$/.test(part)) continue

    // Handle version numbers
    if (part === '3' || part === '4' || part === '5') {
      name += ` ${part}`
    } else if (/^\d+$/.test(part)) {
      // Other numbers (like "5" in "3-5") become decimals
      name = name.trimEnd() + `.${part}`
    } else {
      // Capitalize words
      name += ` ${part.charAt(0).toUpperCase() + part.slice(1)}`
    }
  }

  return name.trim()
}

/**
 * Extract the tier from a model ID
 */
function extractTier(modelId: string): string | undefined {
  const lower = modelId.toLowerCase()
  if (lower.includes('sonnet')) return 'sonnet'
  if (lower.includes('opus')) return 'opus'
  if (lower.includes('haiku')) return 'haiku'
  return undefined
}

/**
 * Extract version from model ID
 */
function extractVersion(modelId: string): string {
  const match = modelId.match(/(\d+)[-.](\d+)/)
  if (match) {
    return `${match[1]}.${match[2]}`
  }
  const simpleMatch = modelId.match(/(\d+)/)
  return simpleMatch ? simpleMatch[1] : '0'
}

/**
 * Compare version strings
 */
function compareVersions(a: string, b: string): number {
  const [majorA, minorA = 0] = a.split('.').map(Number)
  const [majorB, minorB = 0] = b.split('.').map(Number)
  if (majorA !== majorB) return majorA - majorB
  return minorA - minorB
}

/**
 * Fetch available models from the Anthropic API
 * Returns cached models if available and not expired
 * Falls back to hardcoded defaults on API failure
 */
export async function fetchAvailableModels(): Promise<AgentModelInfo[]> {
  // Return cached models if still valid
  const now = Date.now()
  if (cachedModels && now - modelsCacheTime < MODELS_CACHE_DURATION) {
    return cachedModels
  }

  try {
    const token = await getOAuthToken()
    if (!token) {
      console.warn('[API] No OAuth token available, using default models')
      return CLAUDE_CODE_MODELS
    }

    const response = await fetch(MODELS_API_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': ANTHROPIC_BETA,
        'User-Agent': USER_AGENT,
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      console.warn('[API] Models API error:', response.status)
      return CLAUDE_CODE_MODELS
    }

    const data = (await response.json()) as { data?: ApiModel[] }

    if (!data.data || !Array.isArray(data.data)) {
      console.warn('[API] Unexpected models API response format')
      return CLAUDE_CODE_MODELS
    }

    // Filter and transform models - only include Claude models suitable for coding
    const models: AgentModelInfo[] = data.data
      .filter((model) => {
        const id = model.id.toLowerCase()
        return (
          (id.includes('claude-sonnet') ||
            id.includes('claude-opus') ||
            id.includes('claude-haiku')) &&
          !id.includes('embedding')
        )
      })
      .map((model) => ({
        id: model.id,
        name: model.display_name || formatModelName(model.id),
        description: 'Claude model'
      }))

    // Group by tier and find the latest in each tier
    const tierGroups = new Map<string, AgentModelInfo[]>()
    for (const model of models) {
      const tier = extractTier(model.id)
      if (tier) {
        if (!tierGroups.has(tier)) {
          tierGroups.set(tier, [])
        }
        tierGroups.get(tier)!.push(model)
      }
    }

    // Sort each tier group by version
    for (const tierModels of tierGroups.values()) {
      tierModels.sort((a, b) => {
        const versionA = extractVersion(a.id)
        const versionB = extractVersion(b.id)
        return compareVersions(versionB, versionA) // Descending
      })
    }

    // Sort the final list: by tier (opus > sonnet > haiku), then by version
    const sorted = models.sort((a, b) => {
      const getModelRank = (id: string): number => {
        if (id.includes('opus')) return 3
        if (id.includes('sonnet')) return 2
        if (id.includes('haiku')) return 1
        return 0
      }
      const rankA = getModelRank(a.id)
      const rankB = getModelRank(b.id)
      if (rankA !== rankB) return rankB - rankA

      // Newer versions first
      const versionA = extractVersion(a.id)
      const versionB = extractVersion(b.id)
      return compareVersions(versionB, versionA)
    })

    // Mark the latest sonnet as default
    const latestSonnet = tierGroups.get('sonnet')?.[0]
    if (latestSonnet) {
      latestSonnet.isDefault = true
    } else if (sorted.length > 0) {
      sorted[0].isDefault = true
    }

    // Cache the results
    cachedModels = sorted.length > 0 ? sorted : CLAUDE_CODE_MODELS
    modelsCacheTime = now

    logger.debug(`[API] Fetched ${sorted.length} models from API`)
    return cachedModels
  } catch (error) {
    console.error('[API] Failed to fetch models:', error)
    return CLAUDE_CODE_MODELS
  }
}

/**
 * Clear the models cache
 * Useful for forcing a refresh
 */
export function clearModelsCache(): void {
  cachedModels = null
  modelsCacheTime = 0
}
