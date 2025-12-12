/**
 * Notes Cache Manager
 *
 * Provides in-memory caching of notes with file watching for external changes.
 * Notes are loaded on app startup and kept in sync via file system watcher.
 */

import { watch, type FSWatcher } from 'chokidar'
import type { Note, NoteStatus } from '@shared/types/note'
import { getVaultPath } from './vault-store'
import { broadcastToAll } from '../../utils/broadcast'
import { parseFrontmatter } from './frontmatter'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { extractExcerpt, countWords } from '@shared/types/note'

/**
 * Cache state
 */
let notesCache: Map<string, Note> = new Map()
let cacheInitialized = false
let fileWatcher: FSWatcher | null = null

/**
 * Initialize the notes cache
 * Loads all notes into memory and sets up file watching
 */
export async function initializeNotesCache(vaultStore: {
  loadNotes: () => Promise<Note[]>
}): Promise<void> {
  console.log('[NotesCache] Initializing notes cache...')

  try {
    // Load all notes into cache
    const notes = await vaultStore.loadNotes()
    notesCache.clear()
    for (const note of notes) {
      notesCache.set(note.id, note)
    }

    cacheInitialized = true
    console.log(`[NotesCache] Cache initialized with ${notes.length} notes`)

    // Setup file watcher
    await setupFileWatcher()
  } catch (error) {
    console.error('[NotesCache] Failed to initialize cache:', error)
    throw error
  }
}

/**
 * Setup file watcher for vault directory
 */
async function setupFileWatcher(): Promise<void> {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    console.warn('[NotesCache] Cannot setup file watcher: vault path not set')
    return
  }

  // Clean up existing watcher
  if (fileWatcher) {
    await fileWatcher.close()
  }

  console.log('[NotesCache] Setting up file watcher for:', vaultPath)

  fileWatcher = watch(vaultPath, {
    ignoreInitial: true,
    ignored: /(^|[\/\\])\../, // Ignore dotfiles
    persistent: true,
    depth: 10, // Watch subdirectories
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50
    }
  })

  fileWatcher
    .on('add', (filePath) => handleFileAdded(filePath))
    .on('change', (filePath) => handleFileChanged(filePath))
    .on('unlink', (filePath) => handleFileDeleted(filePath))
    .on('error', (error) => console.error('[NotesCache] File watcher error:', error))
}

/**
 * Handle file added event
 */
async function handleFileAdded(filePath: string): Promise<void> {
  if (!filePath.endsWith('.md')) return

  try {
    console.log('[NotesCache] File added:', filePath)
    const note = await loadNoteFromFile(filePath)
    if (note) {
      notesCache.set(note.id, note)
      broadcastToAll('notes:added', note)
    }
  } catch (error) {
    console.error('[NotesCache] Failed to handle file addition:', error)
  }
}

/**
 * Handle file changed event
 */
async function handleFileChanged(filePath: string): Promise<void> {
  if (!filePath.endsWith('.md')) return

  try {
    console.log('[NotesCache] File changed:', filePath)
    const note = await loadNoteFromFile(filePath)
    if (note) {
      notesCache.set(note.id, note)
      broadcastToAll('notes:updated', note)
    }
  } catch (error) {
    console.error('[NotesCache] Failed to handle file change:', error)
  }
}

/**
 * Handle file deleted event
 */
async function handleFileDeleted(filePath: string): Promise<void> {
  if (!filePath.endsWith('.md')) return

  try {
    console.log('[NotesCache] File deleted:', filePath)

    // Find note by filename
    const filename = path.basename(filePath)
    let deletedNoteId: string | null = null

    for (const [noteId] of notesCache.entries()) {
      // Match by filename pattern (we don't have full metadata after deletion)
      if (filename.includes(noteId.split('-').pop() || '')) {
        deletedNoteId = noteId
        break
      }
    }

    if (deletedNoteId) {
      notesCache.delete(deletedNoteId)
      broadcastToAll('notes:deleted', deletedNoteId)
    }
  } catch (error) {
    console.error('[NotesCache] Failed to handle file deletion:', error)
  }
}

/**
 * Load note from file path
 */
async function loadNoteFromFile(filePath: string): Promise<Note | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const note = parseFrontmatter(content)

    // Compute derived fields
    note.excerpt = extractExcerpt(note.content)
    note.wordCount = countWords(note.content)

    return note
  } catch (error) {
    console.error('[NotesCache] Failed to load note from file:', filePath, error)
    return null
  }
}

/**
 * Get all cached notes
 */
export function getCachedNotes(): Note[] {
  if (!cacheInitialized) {
    console.warn('[NotesCache] Cache not initialized, returning empty array')
    return []
  }

  return Array.from(notesCache.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

/**
 * Get a single cached note by ID
 */
export function getCachedNote(noteId: string): Note | null {
  return notesCache.get(noteId) || null
}

/**
 * Update note in cache (after save operation)
 */
export function updateNoteInCache(note: Note): void {
  notesCache.set(note.id, note)
}

/**
 * Remove note from cache (after delete operation)
 */
export function removeNoteFromCache(noteId: string): void {
  notesCache.delete(noteId)
}

/**
 * Get cached notes by project
 */
export function getCachedNotesByProject(projectId: string): Note[] {
  return getCachedNotes().filter((note) => note.primaryProjectId === projectId)
}

/**
 * Get cached notes referencing a project
 */
export function getCachedNotesReferencingProject(projectId: string): Note[] {
  return getCachedNotes().filter((note) => note.projectRefs.includes(projectId))
}

/**
 * Get cached notes referencing a group (legacy)
 */
export function getCachedNotesReferencingGroup(groupId: string): Note[] {
  return getCachedNotes().filter((note) => note.groupRefs.includes(groupId))
}

/**
 * Get cached notes referencing a tag
 */
export function getCachedNotesReferencingTag(tagId: string): Note[] {
  return getCachedNotes().filter((note) => note.tagRefs.includes(tagId))
}

/**
 * Search cached notes
 */
export function searchCachedNotes(query: string): Note[] {
  if (!query.trim()) {
    return getCachedNotes()
  }

  const allNotes = getCachedNotes()
  const lowerQuery = query.toLowerCase()

  // Simple relevance scoring
  const scored = allNotes
    .map((note) => {
      let score = 0
      const titleLower = note.title.toLowerCase()
      const contentLower = note.content.toLowerCase()

      // Title matches
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
 * Get pinned notes from cache
 */
export function getCachedPinnedNotes(): Note[] {
  return getCachedNotes().filter((note) => note.isPinned)
}

/**
 * Get recent notes from cache
 */
export function getCachedRecentNotes(limit = 10): Note[] {
  return getCachedNotes().slice(0, limit)
}

/**
 * Get notes by status from cache
 */
export function getCachedNotesByStatus(status: NoteStatus): Note[] {
  return getCachedNotes().filter((note) => note.status === status)
}

/**
 * Get notes by tag from cache
 */
export function getCachedNotesByTag(tag: string): Note[] {
  return getCachedNotes().filter((note) => note.tags.includes(tag))
}

/**
 * Get all unique tags from cache
 */
export function getCachedAllTags(): string[] {
  const tagSet = new Set<string>()
  for (const note of notesCache.values()) {
    for (const tag of note.tags) {
      tagSet.add(tag)
    }
  }
  return Array.from(tagSet).sort()
}

/**
 * Check if cache is initialized
 */
export function isCacheInitialized(): boolean {
  return cacheInitialized
}

/**
 * Shutdown the cache and file watcher
 */
export async function shutdownNotesCache(): Promise<void> {
  console.log('[NotesCache] Shutting down...')

  if (fileWatcher) {
    await fileWatcher.close()
    fileWatcher = null
  }

  notesCache.clear()
  cacheInitialized = false
}

/**
 * Rebuild cache from disk
 */
export async function rebuildNotesCache(vaultStore: {
  loadNotes: () => Promise<Note[]>
}): Promise<void> {
  console.log('[NotesCache] Rebuilding cache...')

  const notes = await vaultStore.loadNotes()
  notesCache.clear()
  for (const note of notes) {
    notesCache.set(note.id, note)
  }

  console.log(`[NotesCache] Cache rebuilt with ${notes.length} notes`)
  broadcastToAll('notes:cache-rebuilt', notes.length)
}
