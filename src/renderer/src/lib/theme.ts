/**
 * Theme utility functions for applying themes to the DOM
 */

import { themes, getTheme, getDefaultTheme, type ThemeDefinition } from '@shared/themes'

/**
 * Apply a theme to the document by setting CSS variables
 */
export function applyTheme(themeId: string): void {
  const theme = getTheme(themeId) || getDefaultTheme()
  applyThemeColors(theme)
}

/**
 * Apply theme based on system preference (for 'system' theme setting)
 */
export function applySystemTheme(): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const theme = prefersDark ? getTheme('dark')! : getTheme('light')!
  applyThemeColors(theme)
}

/**
 * Apply theme colors to the document
 */
function applyThemeColors(theme: ThemeDefinition): void {
  const root = document.documentElement
  const { colors } = theme

  // Set CSS variables
  root.style.setProperty('--background', colors.background)
  root.style.setProperty('--foreground', colors.foreground)
  root.style.setProperty('--card', colors.card)
  root.style.setProperty('--card-foreground', colors.cardForeground)
  root.style.setProperty('--popover', colors.popover)
  root.style.setProperty('--popover-foreground', colors.popoverForeground)
  root.style.setProperty('--primary', colors.primary)
  root.style.setProperty('--primary-foreground', colors.primaryForeground)
  root.style.setProperty('--secondary', colors.secondary)
  root.style.setProperty('--secondary-foreground', colors.secondaryForeground)
  root.style.setProperty('--muted', colors.muted)
  root.style.setProperty('--muted-foreground', colors.mutedForeground)
  root.style.setProperty('--accent', colors.accent)
  root.style.setProperty('--accent-foreground', colors.accentForeground)
  root.style.setProperty('--destructive', colors.destructive)
  root.style.setProperty('--destructive-foreground', colors.destructiveForeground)
  root.style.setProperty('--border', colors.border)
  root.style.setProperty('--input', colors.input)
  root.style.setProperty('--ring', colors.ring)

  // Toggle dark class for Tailwind's dark: variants
  root.classList.toggle('dark', theme.isDark)
}

/**
 * Set up system theme preference listener
 * Returns cleanup function
 */
export function setupSystemThemeListener(onSystemChange: () => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  const handler = () => onSystemChange()
  mediaQuery.addEventListener('change', handler)

  return () => mediaQuery.removeEventListener('change', handler)
}

/**
 * Get all available themes
 */
export function getAvailableThemes() {
  return themes
}

/**
 * Check if a theme ID is valid
 */
export function isValidTheme(themeId: string): boolean {
  return themeId === 'system' || themes.some((t) => t.id === themeId)
}
