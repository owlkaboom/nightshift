/**
 * Tag Store
 *
 * Zustand store for managing tag state in the renderer process
 */

import { create } from 'zustand'
import type { Tag } from '@shared/types'

interface TagStore {
  /** All tags loaded from the main process */
  tags: Tag[]

  /** Whether tags are currently being loaded */
  loading: boolean

  /** Load all tags from the main process */
  loadTags: () => Promise<void>

  /** Create a new tag */
  createTag: (name: string, color?: string) => Promise<Tag>

  /** Update an existing tag */
  updateTag: (id: string, updates: Partial<Omit<Tag, 'id' | 'createdAt'>>) => Promise<void>

  /** Delete a tag */
  deleteTag: (id: string) => Promise<void>

  /** Search tags by name */
  searchTags: (query: string) => Promise<Tag[]>

  /** Get tags by IDs */
  getTagsByIds: (ids: string[]) => Tag[]
}

export const useTagStore = create<TagStore>((set, get) => ({
  tags: [],
  loading: false,

  loadTags: async () => {
    set({ loading: true })
    try {
      const tags = await window.api.listTags()
      set({ tags, loading: false })
    } catch (error) {
      console.error('Failed to load tags:', error)
      set({ loading: false })
    }
  },

  createTag: async (name: string, color?: string) => {
    const tag = await window.api.createTag(name, color)
    set((state) => ({ tags: [...state.tags, tag].sort((a, b) => a.name.localeCompare(b.name)) }))
    return tag
  },

  updateTag: async (id: string, updates: Partial<Omit<Tag, 'id' | 'createdAt'>>) => {
    const updated = await window.api.updateTag(id, updates)
    if (updated) {
      set((state) => ({
        tags: state.tags
          .map((t) => (t.id === id ? updated : t))
          .sort((a, b) => a.name.localeCompare(b.name))
      }))
    }
  },

  deleteTag: async (id: string) => {
    const success = await window.api.deleteTag(id)
    if (success) {
      set((state) => ({ tags: state.tags.filter((t) => t.id !== id) }))
    }
  },

  searchTags: async (query: string) => {
    return await window.api.searchTags(query)
  },

  getTagsByIds: (ids: string[]) => {
    const { tags } = get()
    return tags.filter((tag) => ids.includes(tag.id))
  }
}))
