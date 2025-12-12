/**
 * Low-level JSON file operations with atomic writes
 * Provides safe read/write operations for JSON files
 */

import { readFile, writeFile, mkdir, access, rename, unlink } from 'fs/promises'
import { dirname } from 'path'

/**
 * Check if a file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Ensure a directory exists (creates it if it doesn't)
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true })
  } catch (error) {
    // Ignore if directory already exists
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }
}

/**
 * Read a JSON file and parse it
 * Returns null if file doesn't exist
 */
export async function readJson<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(path, 'utf-8')
    return JSON.parse(content) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

/**
 * Read a JSON file, returning a default value if it doesn't exist
 */
export async function readJsonWithDefault<T>(
  path: string,
  defaultValue: T
): Promise<T> {
  const result = await readJson<T>(path)
  return result ?? defaultValue
}

/**
 * Write data to a JSON file atomically
 * Uses write-to-temp-then-rename pattern to prevent data corruption
 */
export async function writeJson<T>(
  path: string,
  data: T,
  options: { pretty?: boolean } = {}
): Promise<void> {
  const { pretty = true } = options

  // Ensure directory exists
  await ensureDir(dirname(path))

  // Generate temp file path
  const tempPath = `${path}.tmp.${Date.now()}`

  try {
    // Write to temp file
    const content = pretty
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data)

    await writeFile(tempPath, content, 'utf-8')

    // Atomic rename
    await rename(tempPath, path)
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await unlink(tempPath)
    } catch {
      // Ignore cleanup errors
    }
    throw error
  }
}

/**
 * Delete a JSON file if it exists
 */
export async function deleteJson(path: string): Promise<boolean> {
  try {
    await unlink(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

/**
 * Update a JSON file with a transform function
 * Creates the file with default value if it doesn't exist
 */
export async function updateJson<T>(
  path: string,
  defaultValue: T,
  transform: (current: T) => T
): Promise<T> {
  const current = await readJsonWithDefault(path, defaultValue)
  const updated = transform(current)
  await writeJson(path, updated)
  return updated
}

/**
 * Append data to a file (for logs)
 */
export async function appendToFile(
  path: string,
  content: string
): Promise<void> {
  await ensureDir(dirname(path))

  // For appending, we don't need atomic writes
  const { appendFile } = await import('fs/promises')
  await appendFile(path, content, 'utf-8')
}

/**
 * Read a plain text file
 */
export async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

/**
 * Write a plain text file
 */
export async function writeText(path: string, content: string): Promise<void> {
  await ensureDir(dirname(path))
  await writeFile(path, content, 'utf-8')
}
