/**
 * Test: Model Alias Resolution
 *
 * Tests the model alias system that automatically maps semantic aliases
 * (e.g., "sonnet", "opus") to the latest version of each model tier.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { AgentModelInfo } from '@shared/types'
import { BaseAgentAdapter } from '@main/agents/adapters/base-adapter'

// Mock adapter for testing
class TestAdapter extends BaseAgentAdapter {
  readonly id = 'test'
  readonly name = 'Test Adapter'
  protected readonly possiblePaths = []
  protected readonly cliCommand = 'test'
  protected readonly defaultModels: AgentModelInfo[] = []

  async fetchAvailableModels(): Promise<AgentModelInfo[]> {
    return this.mockModels
  }

  mockModels: AgentModelInfo[] = []

  invoke() {
    throw new Error('Not implemented')
  }

  async validateAuth() {
    return { isValid: true, requiresReauth: false }
  }

  async triggerReauth() {
    return { success: true }
  }

  async checkUsageLimits() {
    return { canProceed: true }
  }

  async getUsagePercentage() {
    return { fiveHour: null, sevenDay: null, error: null }
  }

  getProjectConfigFiles() {
    return []
  }

  getCapabilities() {
    return {
      supportsSkills: false,
      supportsProjectConfig: false,
      supportsContextFiles: false,
      supportsNonInteractiveMode: true,
      supportsPauseResume: false
    }
  }

  setCustomPath() {}

  async testCli() {
    return { success: true }
  }
}

describe('Model Alias Resolution', () => {
  let adapter: TestAdapter

  beforeEach(() => {
    adapter = new TestAdapter()
  })

  describe('extractTier', () => {
    it('should extract tier from Claude model IDs', () => {
      expect(adapter['extractTier']('claude-sonnet-4-5')).toBe('sonnet')
      expect(adapter['extractTier']('claude-opus-4-5')).toBe('opus')
      expect(adapter['extractTier']('claude-haiku-3-5')).toBe('haiku')
    })

    it('should extract tier from Gemini model IDs', () => {
      expect(adapter['extractTier']('gemini-2.5-pro')).toBe('pro')
      expect(adapter['extractTier']('gemini-2.5-flash')).toBe('flash')
    })

    it('should return undefined for unknown tiers', () => {
      expect(adapter['extractTier']('gpt-4o')).toBeUndefined()
    })
  })

  describe('extractVersion', () => {
    it('should extract version from model IDs', () => {
      expect(adapter['extractVersion']('claude-sonnet-4-5')).toBe('4.5')
      expect(adapter['extractVersion']('claude-opus-4-6')).toBe('4.6')
      expect(adapter['extractVersion']('gemini-2.5-pro')).toBe('2.5')
      expect(adapter['extractVersion']('gemini-2.0-flash')).toBe('2.0')
    })

    it('should handle single version numbers', () => {
      expect(adapter['extractVersion']('claude-3-opus')).toBe('3')
      expect(adapter['extractVersion']('gpt-4')).toBe('4')
    })

    it('should return "0" for models without version numbers', () => {
      expect(adapter['extractVersion']('unknown-model')).toBe('0')
    })
  })

  describe('compareVersions', () => {
    it('should compare major versions correctly', () => {
      expect(adapter['compareVersions']('4.0', '3.0')).toBeGreaterThan(0)
      expect(adapter['compareVersions']('3.0', '4.0')).toBeLessThan(0)
      expect(adapter['compareVersions']('3.0', '3.0')).toBe(0)
    })

    it('should compare minor versions correctly', () => {
      expect(adapter['compareVersions']('4.5', '4.0')).toBeGreaterThan(0)
      expect(adapter['compareVersions']('4.0', '4.5')).toBeLessThan(0)
      expect(adapter['compareVersions']('4.5', '4.5')).toBe(0)
    })

    it('should handle missing minor versions', () => {
      expect(adapter['compareVersions']('4', '3.5')).toBeGreaterThan(0)
      expect(adapter['compareVersions']('3.5', '4')).toBeLessThan(0)
    })
  })

  describe('enrichModelsWithAliases', () => {
    it('should mark latest model in each tier with alias', () => {
      const models: AgentModelInfo[] = [
        { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
        { id: 'claude-sonnet-4-0', name: 'Claude Sonnet 4.0' },
        { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' }
      ]

      const enriched = adapter['enrichModelsWithAliases'](models)

      const sonnet45 = enriched.find((m) => m.id === 'claude-sonnet-4-5')
      const sonnet40 = enriched.find((m) => m.id === 'claude-sonnet-4-0')
      const opus45 = enriched.find((m) => m.id === 'claude-opus-4-5')

      expect(sonnet45?.alias).toBe('sonnet')
      expect(sonnet45?.isLegacy).toBe(false)

      expect(sonnet40?.alias).toBeUndefined()
      expect(sonnet40?.isLegacy).toBe(true)

      expect(opus45?.alias).toBe('opus')
      expect(opus45?.isLegacy).toBe(false)
    })

    it('should set tier and version for all models', () => {
      const models: AgentModelInfo[] = [
        { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }
      ]

      const enriched = adapter['enrichModelsWithAliases'](models)

      expect(enriched[0].tier).toBe('sonnet')
      expect(enriched[0].version).toBe('4.5')

      expect(enriched[1].tier).toBe('pro')
      expect(enriched[1].version).toBe('2.5')
    })
  })

  describe('resolveModelAlias', () => {
    beforeEach(() => {
      adapter.mockModels = [
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
        { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
        { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }
      ]
    })

    it('should resolve alias to latest model in tier', async () => {
      const resolved = await adapter.resolveModelAlias('sonnet')
      expect(resolved).toBe('claude-sonnet-4-6') // Latest sonnet
    })

    it('should pass through full model IDs unchanged', async () => {
      const resolved = await adapter.resolveModelAlias('claude-sonnet-4-5')
      expect(resolved).toBe('claude-sonnet-4-5')
    })

    it('should pass through OpenRouter-style model IDs', async () => {
      const resolved = await adapter.resolveModelAlias('anthropic/claude-sonnet-4')
      expect(resolved).toBe('anthropic/claude-sonnet-4')
    })

    it('should resolve opus alias', async () => {
      const resolved = await adapter.resolveModelAlias('opus')
      expect(resolved).toBe('claude-opus-4-5')
    })

    it('should resolve pro alias', async () => {
      const resolved = await adapter.resolveModelAlias('pro')
      expect(resolved).toBe('gemini-2.5-pro')
    })

    it('should fall back to default model for unknown alias', async () => {
      adapter.mockModels = [
        { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', isDefault: true },
        { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' }
      ]

      // Use an alias without dashes (dashes are treated as full model IDs)
      const resolved = await adapter.resolveModelAlias('unknownalias')
      expect(resolved).toBe('claude-sonnet-4-5') // Default model
    })
  })

  describe('getAvailableModels', () => {
    it('should return models enriched with alias information', async () => {
      adapter.mockModels = [
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
        { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
        { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' }
      ]

      const models = await adapter.getAvailableModels()

      expect(models.length).toBe(3)

      const sonnet46 = models.find((m) => m.id === 'claude-sonnet-4-6')
      expect(sonnet46?.alias).toBe('sonnet')
      expect(sonnet46?.tier).toBe('sonnet')
      expect(sonnet46?.version).toBe('4.6')
      expect(sonnet46?.isLegacy).toBe(false)

      const sonnet45 = models.find((m) => m.id === 'claude-sonnet-4-5')
      expect(sonnet45?.alias).toBeUndefined()
      expect(sonnet45?.isLegacy).toBe(true)
    })
  })
})
