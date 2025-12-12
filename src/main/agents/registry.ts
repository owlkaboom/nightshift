/**
 * Agent Registry
 *
 * Manages available agent adapters and provides access to them.
 */

import type { AgentAdapter, AgentRegistry } from '@shared/types'
import { AGENT_IDS } from '@shared/types'
import { claudeCodeAdapter, geminiAdapter, openrouterAdapter } from './adapters'

/**
 * Agent registry implementation
 */
class AgentRegistryImpl implements AgentRegistry {
  private adapters: Map<string, AgentAdapter> = new Map()
  private defaultAdapterId: string = AGENT_IDS.CLAUDE_CODE

  constructor() {
    // Register built-in adapters
    this.register(claudeCodeAdapter)
    this.register(geminiAdapter)
    this.register(openrouterAdapter)
  }

  /**
   * Register an agent adapter
   */
  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.id, adapter)
  }

  /**
   * Get an adapter by ID
   */
  get(id: string): AgentAdapter | undefined {
    return this.adapters.get(id)
  }

  /**
   * Get all registered adapters
   */
  getAll(): AgentAdapter[] {
    return Array.from(this.adapters.values())
  }

  /**
   * Get available adapters (CLI is installed)
   */
  async getAvailable(): Promise<AgentAdapter[]> {
    const results: AgentAdapter[] = []

    for (const adapter of this.adapters.values()) {
      try {
        if (await adapter.isAvailable()) {
          results.push(adapter)
        }
      } catch {
        // Adapter check failed, skip
      }
    }

    return results
  }

  /**
   * Get the default adapter
   */
  getDefault(): AgentAdapter {
    const adapter = this.adapters.get(this.defaultAdapterId)
    if (!adapter) {
      throw new Error(`Default adapter '${this.defaultAdapterId}' not registered`)
    }
    return adapter
  }

  /**
   * Set the default adapter ID
   */
  setDefault(id: string): void {
    if (!this.adapters.has(id)) {
      throw new Error(`Cannot set default: adapter '${id}' not registered`)
    }
    this.defaultAdapterId = id
  }
}

/**
 * Singleton agent registry instance
 */
export const agentRegistry = new AgentRegistryImpl()
