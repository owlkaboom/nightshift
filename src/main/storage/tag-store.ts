/**
 * Tag Store
 *
 * Manages CRUD operations for tags using JSON file storage.
 * Tags are persisted to ~/.nightshift/sync/tags.json
 */

import { promises as fs } from 'fs'
import path from 'path'
import type { Tag, TagsRegistry } from '@shared/types/tag'
import { generateTagId, isValidTagColor } from '@shared/types/tag'
import { getSyncDir } from '../utils/paths'

const TAGS_FILE = 'tags.json'

/**
 * Tag store class for managing tag persistence
 */
export class TagStore {
  private filePath: string
  private registry: TagsRegistry

  constructor() {
    this.filePath = path.join(getSyncDir(), TAGS_FILE)
    this.registry = { tags: [] }
  }

  /**
   * Initializes the tag store by loading from disk
   * Creates the file if it doesn't exist
   */
  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8')
      this.registry = JSON.parse(data)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create it with empty registry
        await this.save()
      } else {
        throw error
      }
    }
  }

  /**
   * Saves the current registry to disk
   */
  private async save(): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(this.registry, null, 2), 'utf-8')
  }

  /**
   * Retrieves all tags
   *
   * @returns Array of all tags sorted by name
   */
  async list(): Promise<Tag[]> {
    return [...this.registry.tags].sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Retrieves a specific tag by ID
   *
   * @param id - The tag ID to retrieve
   * @returns The tag if found, null otherwise
   */
  async get(id: string): Promise<Tag | null> {
    return this.registry.tags.find((tag) => tag.id === id) || null
  }

  /**
   * Creates a new tag
   *
   * @param name - The tag name
   * @param color - Optional hex color (defaults to null)
   * @returns The newly created tag
   * @throws Error if name is empty or color is invalid
   */
  async create(name: string, color?: string): Promise<Tag> {
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error('Tag name cannot be empty')
    }

    // Check for duplicate names (case-insensitive)
    const existingTag = this.registry.tags.find(
      (t) => t.name.toLowerCase() === trimmedName.toLowerCase()
    )
    if (existingTag) {
      throw new Error(`Tag with name "${trimmedName}" already exists`)
    }

    // Validate color if provided
    const tagColor = color || null
    if (tagColor && !isValidTagColor(tagColor)) {
      throw new Error(`Invalid color format: ${tagColor}. Expected hex format like #RRGGBB`)
    }

    const tag: Tag = {
      id: generateTagId(),
      name: trimmedName,
      color: tagColor,
      createdAt: new Date().toISOString()
    }

    this.registry.tags.push(tag)
    await this.save()

    return tag
  }

  /**
   * Updates an existing tag
   *
   * @param id - The tag ID to update
   * @param updates - Partial tag data to update
   * @returns The updated tag if found, null otherwise
   * @throws Error if updates are invalid
   */
  async update(id: string, updates: Partial<Omit<Tag, 'id' | 'createdAt'>>): Promise<Tag | null> {
    const tag = this.registry.tags.find((t) => t.id === id)
    if (!tag) {
      return null
    }

    // Validate name if being updated
    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim()
      if (!trimmedName) {
        throw new Error('Tag name cannot be empty')
      }

      // Check for duplicate names (case-insensitive, excluding self)
      const duplicate = this.registry.tags.find(
        (t) => t.id !== id && t.name.toLowerCase() === trimmedName.toLowerCase()
      )
      if (duplicate) {
        throw new Error(`Tag with name "${trimmedName}" already exists`)
      }

      tag.name = trimmedName
    }

    // Validate color if being updated
    if (updates.color !== undefined) {
      if (updates.color !== null && !isValidTagColor(updates.color)) {
        throw new Error(`Invalid color format: ${updates.color}. Expected hex format like #RRGGBB`)
      }
      tag.color = updates.color
    }

    await this.save()
    return tag
  }

  /**
   * Deletes a tag by ID
   *
   * @param id - The tag ID to delete
   * @returns True if the tag was deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    const initialLength = this.registry.tags.length
    this.registry.tags = this.registry.tags.filter((t) => t.id !== id)

    if (this.registry.tags.length < initialLength) {
      await this.save()
      return true
    }

    return false
  }

  /**
   * Retrieves tags by their IDs
   *
   * @param ids - Array of tag IDs to retrieve
   * @returns Array of found tags (may be shorter than input if some IDs don't exist)
   */
  async getByIds(ids: string[]): Promise<Tag[]> {
    return this.registry.tags.filter((tag) => ids.includes(tag.id))
  }

  /**
   * Searches tags by name (case-insensitive partial match)
   *
   * @param query - The search query
   * @returns Array of matching tags
   */
  async search(query: string): Promise<Tag[]> {
    const lowerQuery = query.toLowerCase().trim()
    if (!lowerQuery) {
      return this.list()
    }

    return this.registry.tags
      .filter((tag) => tag.name.toLowerCase().includes(lowerQuery))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Gets the total number of tags
   *
   * @returns The count of tags
   */
  async count(): Promise<number> {
    return this.registry.tags.length
  }
}

// Singleton instance
let tagStoreInstance: TagStore | null = null

/**
 * Gets the singleton TagStore instance
 *
 * @returns The TagStore instance
 */
export function getTagStore(): TagStore {
  if (!tagStoreInstance) {
    tagStoreInstance = new TagStore()
  }
  return tagStoreInstance
}
