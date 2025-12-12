/**
 * Vault types for file-based note storage
 */

import type { Note } from './note'

/**
 * Index entry for fast lookups without reading files
 */
export interface VaultIndexEntry {
  /** Note ID */
  id: string

  /** Filename in vault */
  filename: string

  /** Note title */
  title: string

  /** File modification timestamp */
  mtime: number

  /** Folder path relative to vault root (empty string for root) */
  folder: string
}

/**
 * Complete vault index
 */
export interface VaultIndex {
  /** Map of note ID to index entry */
  entries: Map<string, VaultIndexEntry>

  /** Last time index was built */
  lastIndexed: number
}

/**
 * Vault statistics
 */
export interface VaultStats {
  /** Total number of notes */
  totalNotes: number

  /** Number of folders */
  totalFolders: number

  /** Vault size in bytes */
  sizeBytes: number

  /** Last modified timestamp */
  lastModified: number
}

/**
 * Search result
 */
export interface VaultSearchResult {
  /** Matching note */
  note: Note

  /** Relevance score (0-1) */
  score: number

  /** Matching excerpts with context */
  matches: string[]
}

/**
 * Vault configuration
 */
export interface VaultConfig {
  /** Path to vault directory */
  path: string

  /** Whether to use subfolders for organization */
  useSubfolders: boolean

  /** Default folder for new notes */
  defaultFolder: string
}
