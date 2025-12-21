/**
 * Frontmatter parsing and serialization utilities
 *
 * Handles conversion between Note objects and markdown files with YAML frontmatter
 */

import matter from 'gray-matter'
import type { Note, NoteStatus } from '@shared/types/note'

/**
 * Frontmatter schema for notes
 * Maps Note fields to YAML structure
 */
export interface NoteFrontmatter {
  id: string
  title: string
  status: NoteStatus
  projectRefs: string[]
  groupRefs: string[]
  tagRefs: string[]
  tags: string[]
  primaryProjectId: string | null
  linkedTaskIds: string[]
  linkedPlanningIds: string[]
  icon: string | null
  createdAt: string
  updatedAt: string
  isPinned: boolean
  wordCount: number
  groupId: string | null
  order: number
}

/**
 * Parse a markdown file with frontmatter into a Note object
 *
 * @param fileContent - Raw file content with YAML frontmatter
 * @returns Parsed Note object
 * @throws Error if frontmatter is invalid or missing required fields
 */
export function parseFrontmatter(fileContent: string): Note {
  const parsed = matter(fileContent)
  const fm = parsed.data as Partial<NoteFrontmatter>

  // Validate required fields
  if (!fm.id || typeof fm.id !== 'string') {
    throw new Error('Invalid or missing frontmatter field: id')
  }
  if (!fm.createdAt || typeof fm.createdAt !== 'string') {
    throw new Error('Invalid or missing frontmatter field: createdAt')
  }

  // Build Note object with defaults for optional fields
  const note: Note = {
    id: fm.id,
    title: fm.title ?? 'Untitled Note',
    content: parsed.content.trim(),
    htmlContent: '', // Computed on demand in UI
    excerpt: '', // Computed on demand in UI
    status: fm.status ?? 'draft',
    projectRefs: Array.isArray(fm.projectRefs) ? fm.projectRefs : [],
    groupRefs: Array.isArray(fm.groupRefs) ? fm.groupRefs : [],
    tagRefs: Array.isArray(fm.tagRefs) ? fm.tagRefs : [],
    tags: Array.isArray(fm.tags) ? fm.tags : [],
    primaryProjectId: fm.primaryProjectId ?? null,
    linkedTaskIds: Array.isArray(fm.linkedTaskIds) ? fm.linkedTaskIds : [],
    linkedPlanningIds: Array.isArray(fm.linkedPlanningIds) ? fm.linkedPlanningIds : [],
    icon: fm.icon ?? null,
    createdAt: fm.createdAt,
    updatedAt: fm.updatedAt ?? fm.createdAt,
    isPinned: fm.isPinned ?? false,
    wordCount: fm.wordCount ?? 0,
    groupId: fm.groupId ?? null,
    order: fm.order ?? 0
  }

  return note
}

/**
 * Serialize a Note object to markdown with YAML frontmatter
 *
 * @param note - Note object to serialize
 * @returns Markdown file content with frontmatter
 */
export function serializeFrontmatter(note: Note): string {
  const frontmatter: NoteFrontmatter = {
    id: note.id,
    title: note.title,
    status: note.status,
    projectRefs: note.projectRefs,
    groupRefs: note.groupRefs,
    tagRefs: note.tagRefs,
    tags: note.tags,
    primaryProjectId: note.primaryProjectId,
    linkedTaskIds: note.linkedTaskIds,
    linkedPlanningIds: note.linkedPlanningIds,
    icon: note.icon,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    isPinned: note.isPinned,
    wordCount: note.wordCount,
    groupId: note.groupId,
    order: note.order
  }

  return matter.stringify(note.content, frontmatter)
}

/**
 * Create a filename from a note title
 *
 * Slugifies the title and appends ID suffix for collision prevention
 * Example: "My Note Idea" -> "my-note-idea-abc123.md"
 *
 * @param title - Note title
 * @param id - Note ID
 * @returns Filename with .md extension
 */
export function createFilename(title: string, id: string): string {
  // Extract short ID suffix (last 6 chars)
  const idSuffix = id.split('_')[1]?.slice(-6) ?? id.slice(-6)

  // Slugify: lowercase, replace spaces/special chars with hyphens
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and hyphens)
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/--+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '') // Trim leading/trailing hyphens
    .slice(0, 100) // Limit length

  // Fallback for empty slugs
  const finalSlug = slug || 'untitled'

  return `${finalSlug}-${idSuffix}.md`
}

/**
 * Extract note ID from a filename
 *
 * @param filename - Filename to parse
 * @returns Note ID if found, null otherwise
 */
export function extractIdFromFilename(filename: string): string | null {
  // Match pattern: anything-{idSuffix}.md
  const match = filename.match(/-([a-z0-9]+)\.md$/)
  if (!match) return null

  // Reconstruct full ID (note_timestamp_random)
  // We only have the suffix, so we'll need to look it up in the index
  return match[1]
}
