/**
 * Keyboard shortcuts hook for handling global keyboard shortcuts
 */

import { useEffect, useCallback, useRef } from 'react'

export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  meta?: boolean // Cmd on Mac
  shift?: boolean
  alt?: boolean
  handler: () => void
  description: string
  // If true, the shortcut won't fire when focused on input/textarea
  ignoreInputs?: boolean
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean
}

/**
 * Check if the current platform is macOS
 */
export const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

/**
 * Get the modifier key display name (verbose)
 */
export function getModifierKey(): string {
  return isMac ? '⌘' : 'Ctrl'
}

/**
 * Platform-aware keyboard symbols
 */
export const kbd = {
  /** Command/Ctrl key */
  mod: isMac ? '⌘' : 'Ctrl',
  /** Shift key */
  shift: '⇧',
  /** Alt/Option key */
  alt: isMac ? '⌥' : 'Alt',
  /** Enter/Return key */
  enter: isMac ? '↵' : 'Enter',
}

/**
 * Format a keyboard shortcut for display
 * Takes Mac-style symbols and converts to platform-appropriate format with plus signs
 *
 * @example
 * formatKbd('⌘N') // "⌘+N" on Mac, "Ctrl+N" on Windows
 * formatKbd('⌘⇧P') // "⌘+⇧+P" on Mac, "Ctrl+Shift+P" on Windows
 */
export function formatKbd(macShortcut: string): string {
  if (isMac) {
    // On Mac, add + between modifiers and keys
    let result = macShortcut
      .replace(/⌘([^⇧⌥↵+])/g, '⌘+$1')
      .replace(/⇧([^⌘⌥↵+])/g, '⇧+$1')
      .replace(/⌥([^⌘⇧↵+])/g, '⌥+$1')

    // Handle multiple modifiers in sequence
    result = result
      .replace(/⌘⇧/g, '⌘+⇧+')
      .replace(/⌘⌥/g, '⌘+⌥+')
      .replace(/⇧⌥/g, '⇧+⌥+')
      .replace(/⌘⇧⌥/g, '⌘+⇧+⌥+')

    return result
  }

  // Convert Mac symbols to Windows equivalents
  let result = macShortcut
    .replace(/⌘/g, 'Ctrl+')
    .replace(/⇧/g, 'Shift+')
    .replace(/⌥/g, 'Alt+')
    .replace(/↵/g, 'Enter')

  // Clean up any double ++ that might occur
  result = result.replace(/\+\+/g, '+')

  // Remove trailing + if present
  if (result.endsWith('+')) {
    result = result.slice(0, -1)
  }

  return result
}

/**
 * Format a keyboard shortcut into separate parts for display with + separators
 * Takes Mac-style symbols and converts to platform-appropriate parts array
 * Parts are intended to be displayed with + signs between them
 *
 * @example
 * formatKbdParts('⌘N') // ["⌘", "N"] on Mac, ["Ctrl", "N"] on Windows
 * formatKbdParts('⌘⇧P') // ["⌘", "⇧", "P"] on Mac, ["Ctrl", "Shift", "P"] on Windows
 * formatKbdParts('⌘⇧I') // ["⌘", "⇧", "I"] on Mac, ["Ctrl", "Shift", "I"] on Windows
 */
export function formatKbdParts(macShortcut: string): string[] {
  const parts: string[] = []

  if (isMac) {
    // On Mac, split by each symbol
    for (const char of macShortcut) {
      if (char === '⌘' || char === '⇧' || char === '⌥' || char === '↵') {
        parts.push(char)
      } else if (char.match(/[a-zA-Z0-9\/,]/)) {
        parts.push(char)
      }
    }
    return parts
  }

  // On Windows, convert symbols to words and split
  const converted = macShortcut
    .replace(/⌘/g, 'Ctrl|')
    .replace(/⇧/g, 'Shift|')
    .replace(/⌥/g, 'Alt|')
    .replace(/↵/g, 'Enter|')

  // Split by delimiter and filter empty strings
  const splitParts = converted.split('|').filter(p => p.length > 0)

  return splitParts
}

/**
 * Format shortcut parts for display (returns array of key parts)
 */
export function formatShortcutParts(shortcut: KeyboardShortcut): string[] {
  const parts: string[] = []

  if (shortcut.ctrl || shortcut.meta) {
    parts.push(isMac ? 'Cmd' : 'Ctrl')
  }
  if (shortcut.shift) {
    parts.push('Shift')
  }
  if (shortcut.alt) {
    parts.push(isMac ? 'Opt' : 'Alt')
  }

  // Format key name
  let keyName = shortcut.key.toUpperCase()
  if (shortcut.key === ' ') keyName = 'Space'
  if (shortcut.key === 'Escape') keyName = 'Esc'
  if (shortcut.key === 'ArrowUp') keyName = 'Up'
  if (shortcut.key === 'ArrowDown') keyName = 'Down'
  if (shortcut.key === 'ArrowLeft') keyName = 'Left'
  if (shortcut.key === 'ArrowRight') keyName = 'Right'
  if (shortcut.key === 'Enter') keyName = 'Enter'
  if (shortcut.key === 'Backspace') keyName = 'Del'

  parts.push(keyName)

  return parts
}

/**
 * Format a shortcut for display (e.g., "Cmd+N" or "Ctrl+N")
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  return formatShortcutParts(shortcut).join(' + ')
}

/**
 * Hook for registering keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true } = options
  const shortcutsRef = useRef(shortcuts)

  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      // Check if focused on an input element
      const target = event.target as HTMLElement
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      // Check if a dialog/modal is open (role="dialog" is the standard accessibility attribute)
      const isDialogOpen = !!document.querySelector('[role="dialog"]')

      for (const shortcut of shortcutsRef.current) {
        // Skip if shortcut should ignore inputs and we're in an input
        if (shortcut.ignoreInputs !== false && isInputFocused) {
          // Only allow escape to work in inputs
          if (shortcut.key !== 'Escape') continue
        }

        // Skip if a dialog is open (only allow Escape to close dialogs)
        if (isDialogOpen && shortcut.key !== 'Escape') {
          continue
        }

        // Check key match (case insensitive)
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
        if (!keyMatch) continue

        // Check modifiers
        // For cross-platform support: ctrl OR meta can satisfy ctrl/meta requirement
        const modifierMatch = shortcut.ctrl || shortcut.meta
          ? (event.ctrlKey || event.metaKey)
          : (!event.ctrlKey && !event.metaKey)

        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
        const altMatch = shortcut.alt ? event.altKey : !event.altKey

        if (modifierMatch && shiftMatch && altMatch) {
          event.preventDefault()
          event.stopPropagation()
          shortcut.handler()
          return
        }
      }
    },
    [enabled]
  )

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, enabled])
}

/**
 * Shortcut categories for help dialog organization
 */
export type ShortcutCategory = 'navigation' | 'board' | 'task' | 'review' | 'notes' | 'general'

export interface CategorizedShortcut extends KeyboardShortcut {
  category: ShortcutCategory
}

/**
 * All available shortcuts organized by category
 */
export const ALL_SHORTCUTS: CategorizedShortcut[] = [
  // Navigation shortcuts (mnemonic keys: b=Board, p=Projects, t=Tags, n=Notes, a=plAnning, s=Schedule, ,=Settings)
  { key: 'b', handler: () => {}, description: 'Go to Board', category: 'navigation', ignoreInputs: true },
  { key: 'p', handler: () => {}, description: 'Go to Projects', category: 'navigation', ignoreInputs: true },
  { key: 't', handler: () => {}, description: 'Go to Tags', category: 'navigation', ignoreInputs: true },
  { key: 'n', handler: () => {}, description: 'Go to Notes', category: 'navigation', ignoreInputs: true },
  { key: 'a', handler: () => {}, description: 'Go to Planning', category: 'navigation', ignoreInputs: true },
  { key: 's', handler: () => {}, description: 'Go to Schedule', category: 'navigation', ignoreInputs: true },
  { key: ',', handler: () => {}, description: 'Go to Settings', category: 'navigation', ignoreInputs: true },
  { key: 'b', meta: true, handler: () => {}, description: 'Toggle sidebar', category: 'navigation' },
  { key: 'p', meta: true, handler: () => {}, description: 'Open process monitor', category: 'navigation' },

  // Board shortcuts
  { key: 'n', meta: true, handler: () => {}, description: 'New task', category: 'board' },
  { key: 'v', meta: true, shift: true, handler: () => {}, description: 'Voice task creation', category: 'board' },
  { key: 'Enter', meta: true, handler: () => {}, description: 'Start next task', category: 'board' },
  { key: 'r', meta: true, handler: () => {}, description: 'Refresh tasks', category: 'board' },
  { key: ' ', shift: true, handler: () => {}, description: 'Toggle auto-play', category: 'board' },
  { key: 'j', handler: () => {}, description: 'Navigate down / next card', category: 'board', ignoreInputs: true },
  { key: 'k', handler: () => {}, description: 'Navigate up / previous card', category: 'board', ignoreInputs: true },
  { key: 'h', handler: () => {}, description: 'Navigate left / previous column', category: 'board', ignoreInputs: true },
  { key: 'l', handler: () => {}, description: 'Navigate right / next column', category: 'board', ignoreInputs: true },
  { key: 'Enter', handler: () => {}, description: 'Open focused card', category: 'board', ignoreInputs: true },

  // Task shortcuts (when task is selected)
  { key: 'Backspace', meta: true, handler: () => {}, description: 'Delete selected task', category: 'task' },
  { key: 'd', meta: true, handler: () => {}, description: 'Clone selected task', category: 'task' },
  { key: 'x', handler: () => {}, description: 'Cancel running task', category: 'task', ignoreInputs: true },

  // Review shortcuts (in review view)
  { key: 'y', meta: true, handler: () => {}, description: 'Accept task', category: 'review' },
  { key: 'u', meta: true, handler: () => {}, description: 'Reject task', category: 'review' },
  { key: 'p', meta: true, shift: true, handler: () => {}, description: 'Re-prompt task', category: 'review' },

  // Notes shortcuts
  { key: 'n', meta: true, shift: true, handler: () => {}, description: 'Quick note capture', category: 'notes' },
  { key: 's', meta: true, handler: () => {}, description: 'Save note (in editor)', category: 'notes' },

  // General shortcuts
  { key: 'Escape', handler: () => {}, description: 'Close dialog/modal', category: 'general' },
  { key: '/', meta: true, handler: () => {}, description: 'Show keyboard shortcuts', category: 'general' },
]

export const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: 'Navigation',
  board: 'Board Actions',
  task: 'Task Actions',
  review: 'Review Actions',
  notes: 'Notes',
  general: 'General',
}
