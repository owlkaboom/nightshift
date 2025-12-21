/**
 * Vault Note Store
 *
 * File-based note storage using markdown files with YAML frontmatter
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Note, NoteStatus, CreateNoteData } from '@shared/types/note'
import {
  createNote,
  extractExcerpt,
  extractTitleFromContent,
  countWords
} from '@shared/types/note'
import { logger } from '@main/utils/logger'
import type { VaultIndex, VaultStats } from '@shared/types/vault'
import { parseFrontmatter, serializeFrontmatter, createFilename } from './frontmatter'
import * as notesCache from './notes-cache'

/**
 * In-memory index for fast lookups
 */
let vaultIndex: VaultIndex = {
  entries: new Map(),
  lastIndexed: 0
}

/**
 * Current vault path
 */
let currentVaultPath: string | null = null

/**
 * Initialize vault store with a vault path
 *
 * @param vaultPath - Path to vault directory
 * @throws Error if vault path is invalid
 */
export async function initializeVault(vaultPath: string): Promise<void> {
  // Verify directory exists
  try {
    const stat = await fs.stat(vaultPath)
    if (!stat.isDirectory()) {
      throw new Error(`Vault path is not a directory: ${vaultPath}`)
    }
  } catch (error) {
    throw new Error(`Invalid vault path: ${vaultPath}`)
  }

  currentVaultPath = vaultPath
  await rebuildIndex()

  // Initialize notes cache with file watching
  // This loads all notes into memory and sets up file watchers
  await notesCache.initializeNotesCache({ loadNotes })
  logger.debug('[VaultStore] Notes cache initialized')
}

/**
 * Get current vault path
 */
export function getVaultPath(): string | null {
  return currentVaultPath
}

/**
 * Ensure vault is initialized
 * @throws Error if vault is not initialized
 */
function ensureInitialized(): void {
  if (!currentVaultPath) {
    throw new Error('Vault not initialized. Please configure vault path in settings.')
  }
}

// ============ Index Management ============

/**
 * Rebuild the complete vault index
 */
export async function rebuildIndex(): Promise<void> {
  ensureInitialized()
  if (!currentVaultPath) throw new Error('Vault path is null')

  const newIndex: VaultIndex = {
    entries: new Map(),
    lastIndexed: Date.now()
  }

  await indexDirectory(currentVaultPath, '', newIndex)
  vaultIndex = newIndex
}

/**
 * Recursively index a directory
 */
async function indexDirectory(
  dirPath: string,
  relativePath: string,
  index: VaultIndex
): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      // Skip hidden directories
      if (entry.name.startsWith('.')) continue

      // Recurse into subdirectory
      const subPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
      await indexDirectory(fullPath, subPath, index)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      try {
        // Read file to get ID from frontmatter
        const content = await fs.readFile(fullPath, 'utf-8')
        const note = parseFrontmatter(content)
        const stat = await fs.stat(fullPath)

        index.entries.set(note.id, {
          id: note.id,
          filename: entry.name,
          title: note.title,
          mtime: stat.mtimeMs,
          folder: relativePath
        })
      } catch (error) {
        console.warn(`[VaultStore] Failed to index ${fullPath}:`, error)
      }
    }
  }
}

/**
 * Add or update an entry in the index
 */
async function updateIndexEntry(noteId: string, filename: string, folder: string): Promise<void> {
  ensureInitialized()
  if (!currentVaultPath) throw new Error('Vault path is null')
  const fullPath = path.join(currentVaultPath, folder, filename)
  const stat = await fs.stat(fullPath)
  const content = await fs.readFile(fullPath, 'utf-8')
  const note = parseFrontmatter(content)

  vaultIndex.entries.set(noteId, {
    id: noteId,
    filename,
    title: note.title,
    mtime: stat.mtimeMs,
    folder
  })
}

/**
 * Remove an entry from the index
 */
function removeIndexEntry(noteId: string): void {
  vaultIndex.entries.delete(noteId)
}

/**
 * Get file path for a note ID
 */
function getNotePath(noteId: string): string | null {
  const entry = vaultIndex.entries.get(noteId)
  if (!entry) return null

  ensureInitialized()
  if (!currentVaultPath) return null
  return path.join(currentVaultPath, entry.folder, entry.filename)
}

// ============ Core CRUD Operations ============

/**
 * Load all notes
 */
export async function loadNotes(): Promise<Note[]> {
  ensureInitialized()

  const notes: Note[] = []
  for (const entry of vaultIndex.entries.values()) {
    try {
      const note = await getNote(entry.id)
      if (note) notes.push(note)
    } catch (error) {
      console.warn(`[VaultStore] Failed to load note ${entry.id}:`, error)
    }
  }

  // Sort by updated date descending
  return notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

/**
 * Get a note by ID
 */
export async function getNote(noteId: string): Promise<Note | null> {
  const filePath = getNotePath(noteId)
  if (!filePath) return null

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const note = parseFrontmatter(content)

    // Compute derived fields on-demand
    note.excerpt = extractExcerpt(note.content)
    note.wordCount = countWords(note.content)

    return note
  } catch (error) {
    console.error(`[VaultStore] Failed to read note ${noteId}:`, error)
    return null
  }
}

/**
 * Create a new note
 */
export async function createNoteRecord(data: CreateNoteData = {}): Promise<Note> {
  ensureInitialized()
  if (!currentVaultPath) throw new Error('Vault path is null')

  const note = createNote(data)
  const filename = createFilename(note.title, note.id)
  const folder = '' // Root folder for now (can be extended later)
  const filePath = path.join(currentVaultPath, folder, filename)

  // Serialize and write file
  const fileContent = serializeFrontmatter(note)
  await fs.writeFile(filePath, fileContent, 'utf-8')

  // Update index
  await updateIndexEntry(note.id, filename, folder)

  return note
}

/**
 * Update a note
 */
export async function updateNote(
  noteId: string,
  updates: Partial<Omit<Note, 'id' | 'createdAt'>>
): Promise<Note | null> {
  const existing = await getNote(noteId)
  if (!existing) return null

  // If content is being updated, regenerate derived fields
  let processedUpdates = { ...updates }
  if (updates.content !== undefined) {
    processedUpdates = {
      ...processedUpdates,
      excerpt: updates.excerpt ?? extractExcerpt(updates.content),
      wordCount: updates.wordCount ?? countWords(updates.content),
      title:
        updates.title ??
        (existing.title === 'Untitled Note' ||
        existing.title === extractTitleFromContent(existing.content)
          ? extractTitleFromContent(updates.content)
          : existing.title)
    }
  }

  const updated: Note = {
    ...existing,
    ...processedUpdates,
    updatedAt: new Date().toISOString()
  }

  // Check if title changed - might need to rename file
  const oldPath = getNotePath(noteId)
  if (!oldPath) return null

  ensureInitialized()
  if (!currentVaultPath) throw new Error('Vault path is null')

  const indexEntry = vaultIndex.entries.get(noteId)
  if (!indexEntry) return null

  let newFilename = indexEntry.filename
  if (updated.title !== existing.title) {
    newFilename = createFilename(updated.title, updated.id)
  }

  // Serialize and write
  const fileContent = serializeFrontmatter(updated)
  const newPath = path.join(currentVaultPath, indexEntry.folder, newFilename)

  await fs.writeFile(newPath, fileContent, 'utf-8')

  // Rename if filename changed
  if (newFilename !== indexEntry.filename) {
    if (oldPath !== newPath) {
      await fs.unlink(oldPath)
    }
  }

  // Update index
  await updateIndexEntry(noteId, newFilename, indexEntry.folder)

  return updated
}

/**
 * Delete a note
 */
export async function deleteNote(noteId: string): Promise<boolean> {
  const filePath = getNotePath(noteId)
  if (!filePath) return false

  try {
    await fs.unlink(filePath)
    removeIndexEntry(noteId)
    return true
  } catch (error) {
    console.error(`[VaultStore] Failed to delete note ${noteId}:`, error)
    return false
  }
}

// ============ Query Operations ============

/**
 * Get notes by primary project
 */
export async function getNotesByProject(projectId: string): Promise<Note[]> {
  const allNotes = await loadNotes()
  return allNotes.filter((note) => note.primaryProjectId === projectId)
}

/**
 * Get notes referencing a project (via @mentions)
 */
export async function getNotesReferencingProject(projectId: string): Promise<Note[]> {
  const allNotes = await loadNotes()
  return allNotes.filter((note) => note.projectRefs.includes(projectId))
}

/**
 * Get notes referencing a group (via #mentions) - legacy
 */
export async function getNotesReferencingGroup(groupId: string): Promise<Note[]> {
  const allNotes = await loadNotes()
  return allNotes.filter((note) => note.groupRefs.includes(groupId))
}

/**
 * Get notes referencing a tag (via #mentions)
 */
export async function getNotesReferencingTag(tagId: string): Promise<Note[]> {
  const allNotes = await loadNotes()
  return allNotes.filter((note) => note.tagRefs.includes(tagId))
}

/**
 * Search notes using in-memory full-text search
 */
export async function searchNotes(query: string): Promise<Note[]> {
  if (!query.trim()) {
    return loadNotes()
  }

  const allNotes = await loadNotes()
  const lowerQuery = query.toLowerCase()

  // Simple relevance scoring based on matches in different fields
  const scored = allNotes
    .map((note) => {
      let score = 0
      const titleLower = note.title.toLowerCase()
      const contentLower = note.content.toLowerCase()

      // Title matches are worth more
      if (titleLower.includes(lowerQuery)) score += 10
      // Tag exact matches
      if (note.tags.some((tag) => tag.toLowerCase() === lowerQuery)) score += 8
      // Content matches
      const contentMatches = (contentLower.match(new RegExp(lowerQuery, 'g')) || []).length
      score += contentMatches

      return { note, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.map(({ note }) => note)
}

/**
 * Get pinned notes
 */
export async function getPinnedNotes(): Promise<Note[]> {
  const allNotes = await loadNotes()
  return allNotes.filter((note) => note.isPinned)
}

/**
 * Get recent notes (last N updated)
 */
export async function getRecentNotes(limit = 10): Promise<Note[]> {
  const allNotes = await loadNotes()
  return allNotes.slice(0, limit)
}

/**
 * Get notes by status
 */
export async function getNotesByStatus(status: NoteStatus): Promise<Note[]> {
  const allNotes = await loadNotes()
  return allNotes.filter((note) => note.status === status)
}

/**
 * Get notes by tag
 */
export async function getNotesByTag(tag: string): Promise<Note[]> {
  const allNotes = await loadNotes()
  return allNotes.filter((note) => note.tags.includes(tag))
}

// ============ Link Operations ============

/**
 * Link a note to a task
 */
export async function linkNoteToTask(noteId: string, taskId: string): Promise<Note | null> {
  const note = await getNote(noteId)
  if (!note) return null

  if (!note.linkedTaskIds.includes(taskId)) {
    return updateNote(noteId, {
      linkedTaskIds: [...note.linkedTaskIds, taskId],
      status: note.status === 'draft' ? 'active' : note.status
    })
  }

  return note
}

/**
 * Unlink a note from a task
 */
export async function unlinkNoteFromTask(noteId: string, taskId: string): Promise<Note | null> {
  const note = await getNote(noteId)
  if (!note) return null

  return updateNote(noteId, {
    linkedTaskIds: note.linkedTaskIds.filter((id) => id !== taskId)
  })
}

/**
 * Link a note to a planning session
 */
export async function linkNoteToPlanningSession(
  noteId: string,
  planningId: string
): Promise<Note | null> {
  const note = await getNote(noteId)
  if (!note) return null

  if (!note.linkedPlanningIds.includes(planningId)) {
    return updateNote(noteId, {
      linkedPlanningIds: [...note.linkedPlanningIds, planningId]
    })
  }

  return note
}

/**
 * Unlink a note from a planning session
 */
export async function unlinkNoteFromPlanningSession(
  noteId: string,
  planningId: string
): Promise<Note | null> {
  const note = await getNote(noteId)
  if (!note) return null

  return updateNote(noteId, {
    linkedPlanningIds: note.linkedPlanningIds.filter((id) => id !== planningId)
  })
}

// ============ Bulk Operations ============

/**
 * Toggle pin status
 */
export async function toggleNotePin(noteId: string): Promise<Note | null> {
  const note = await getNote(noteId)
  if (!note) return null

  return updateNote(noteId, { isPinned: !note.isPinned })
}

/**
 * Archive a note
 */
export async function archiveNote(noteId: string): Promise<Note | null> {
  return updateNote(noteId, { status: 'archived' })
}

/**
 * Unarchive a note
 */
export async function unarchiveNote(noteId: string): Promise<Note | null> {
  return updateNote(noteId, { status: 'active' })
}

/**
 * Get all unique tags across notes
 */
export async function getAllTags(): Promise<string[]> {
  const allNotes = await loadNotes()
  const tagSet = new Set<string>()

  for (const note of allNotes) {
    for (const tag of note.tags) {
      tagSet.add(tag)
    }
  }

  return Array.from(tagSet).sort()
}

/**
 * Get vault statistics
 */
export async function getVaultStats(): Promise<VaultStats> {
  ensureInitialized()
  if (!currentVaultPath) throw new Error('Vault path is null')

  const allNotes = await loadNotes()
  const folders = new Set<string>()

  for (const entry of vaultIndex.entries.values()) {
    if (entry.folder) folders.add(entry.folder)
  }

  let totalSize = 0
  let latestMtime = 0

  for (const entry of vaultIndex.entries.values()) {
    const filePath = path.join(currentVaultPath, entry.folder, entry.filename)
    try {
      const stat = await fs.stat(filePath)
      totalSize += stat.size
      latestMtime = Math.max(latestMtime, stat.mtimeMs)
    } catch {
      // Skip files that can't be accessed
    }
  }

  return {
    totalNotes: allNotes.length,
    totalFolders: folders.size,
    sizeBytes: totalSize,
    lastModified: latestMtime
  }
}

// ============ Note Ordering Functions ============

/**
 * Reorder notes
 * Updates the order field for multiple notes at once
 */
export async function reorderNotes(noteOrders: Array<{ id: string; order: number; groupId?: string | null }>): Promise<void> {
  for (const { id, order, groupId } of noteOrders) {
    const updates: Partial<Note> = { order }
    if (groupId !== undefined) {
      updates.groupId = groupId
    }
    await updateNote(id, updates)
  }
}

/**
 * Move a note to a group
 */
export async function moveNoteToGroup(noteId: string, groupId: string | null): Promise<Note | null> {
  return updateNote(noteId, { groupId })
}

/**
 * Get notes by group ID
 */
export async function getNotesByGroup(groupId: string | null): Promise<Note[]> {
  const allNotes = await loadNotes()
  return allNotes
    .filter(note => note.groupId === groupId)
    .sort((a, b) => a.order - b.order)
}
