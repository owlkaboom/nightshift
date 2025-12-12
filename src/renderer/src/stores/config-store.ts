/**
 * Zustand store for configuration state
 */

import { create } from 'zustand'
import type { AppConfig } from '@shared/types'
import { applyTheme, applySystemTheme, setupSystemThemeListener } from '@/lib/theme'

// Store cleanup function for system theme listener
let systemThemeCleanup: (() => void) | null = null

/**
 * Apply the current theme from config
 */
function applyConfigTheme(config: AppConfig): void {
  // Clean up previous system listener if any
  if (systemThemeCleanup) {
    systemThemeCleanup()
    systemThemeCleanup = null
  }

  if (config.theme === 'system') {
    // Apply based on system preference and set up listener
    applySystemTheme()
    systemThemeCleanup = setupSystemThemeListener(() => {
      applySystemTheme()
    })
  } else {
    // Apply specific theme
    applyTheme(config.theme)
  }
}

interface ConfigState {
  config: AppConfig | null
  loading: boolean
  error: string | null

  // Actions
  fetchConfig: () => Promise<void>
  updateConfig: (updates: Partial<AppConfig>) => Promise<void>
  resetConfig: () => Promise<void>
  setClaudeCodePath: (path: string) => Promise<void>
  setTheme: (theme: string) => Promise<void>
  clearError: () => void
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  loading: false,
  error: null,

  fetchConfig: async () => {
    set({ loading: true, error: null })
    try {
      const config = await window.api.getConfig()
      applyConfigTheme(config)
      set({ config, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch config',
        loading: false
      })
    }
  },

  updateConfig: async (updates: Partial<AppConfig>) => {
    set({ loading: true, error: null })
    try {
      const config = await window.api.updateConfig(updates)
      applyConfigTheme(config)
      set({ config, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update config',
        loading: false
      })
      throw error
    }
  },

  resetConfig: async () => {
    set({ loading: true, error: null })
    try {
      const config = await window.api.resetConfig()
      applyConfigTheme(config)
      set({ config, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to reset config',
        loading: false
      })
      throw error
    }
  },

  setClaudeCodePath: async (path: string) => {
    set({ loading: true, error: null })
    try {
      await window.api.setClaudeCodePath(path)
      // Refresh config to get updated value
      const config = await window.api.getConfig()
      set({ config, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to set Claude Code path',
        loading: false
      })
      throw error
    }
  },

  setTheme: async (theme: string) => {
    set({ loading: true, error: null })
    try {
      const config = await window.api.updateConfig({ theme })
      applyConfigTheme(config)
      set({ config, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to set theme',
        loading: false
      })
      throw error
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))
