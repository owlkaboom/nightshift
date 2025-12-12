/**
 * Tag System Types
 *
 * Tags provide a simple, flat organizational structure for projects and tasks.
 * Unlike the previous hierarchical Groups system, tags have no parent-child
 * relationships, making them easier to manage and reason about.
 */

/**
 * Represents a single tag that can be applied to projects and tasks
 */
export interface Tag {
  /** Unique identifier (tag_xxx format) */
  id: string
  /** Display name */
  name: string
  /** Optional color for visual distinction (hex format) */
  color: string | null
  /** ISO timestamp of creation */
  createdAt: string
}

/**
 * Registry container for all tags in the system
 */
export interface TagsRegistry {
  tags: Tag[]
}

/**
 * Predefined color palette for tags
 */
export const TAG_COLORS = [
  '#4A90D9', // Blue
  '#7B68EE', // Purple
  '#3CB371', // Green
  '#FF6B6B', // Red
  '#FFB347', // Orange
  '#20B2AA', // Teal
  '#DDA0DD', // Plum
  '#87CEEB'  // Sky Blue
] as const

/**
 * Generates a unique tag ID using timestamp and random suffix
 *
 * @returns A unique tag ID in format: tag_<timestamp><random>
 *
 * @example
 * const id = generateTagId() // "tag_abc123xyz"
 */
export function generateTagId(): string {
  return `tag_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Validates that a string is a valid tag ID
 *
 * @param id - The string to validate
 * @returns True if the ID matches the tag_xxx format
 */
export function isValidTagId(id: string): boolean {
  return /^tag_[a-z0-9]+$/.test(id)
}

/**
 * Validates that a color string is a valid hex color
 *
 * @param color - The color string to validate
 * @returns True if the color is a valid hex format (#RRGGBB)
 */
export function isValidTagColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color)
}
