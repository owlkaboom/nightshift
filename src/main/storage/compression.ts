/**
 * File compression utilities for task logs
 *
 * Provides transparent gzip compression and decompression for log files
 * to reduce disk footprint (~80% size reduction).
 */

import { createGzip, createGunzip } from 'zlib'
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { unlink, stat, access } from 'fs/promises'
import { readFile } from 'fs/promises'

/**
 * Compress a file in-place, adding .gz extension
 * Returns the new path, or null if file doesn't exist
 *
 * @param filePath - Path to the file to compress
 * @returns Path to compressed file (.gz) or null if original doesn't exist
 */
export async function compressFile(filePath: string): Promise<string | null> {
  try {
    // Check if file exists and get its size
    const fileStats = await stat(filePath)
    if (!fileStats.isFile()) {
      console.warn('[Compression] Path is not a file:', filePath)
      return null
    }

    const compressedPath = `${filePath}.gz`

    // Create gzip compression stream
    const gzip = createGzip()
    const source = createReadStream(filePath)
    const destination = createWriteStream(compressedPath)

    // Compress the file
    await pipeline(source, gzip, destination)

    // Verify compressed file was created and get stats
    const compressedStats = await stat(compressedPath)
    const originalSize = fileStats.size
    const compressedSize = compressedStats.size
    const savings = ((1 - compressedSize / originalSize) * 100).toFixed(1)

    console.log(
      `[Compression] Compressed ${filePath.split('/').pop()}: ${originalSize} → ${compressedSize} bytes (${savings}% savings)`
    )

    // Delete original file after successful compression
    await unlink(filePath)

    return compressedPath
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      // File doesn't exist, not an error
      return null
    }
    console.error('[Compression] Failed to compress file:', filePath, err)
    throw err
  }
}

/**
 * Read a file, auto-detecting compression from extension
 * Transparently decompresses .gz files
 *
 * @param filePath - Base path to the file (without .gz extension)
 * @returns File contents as string, or null if file doesn't exist
 */
export async function readFileAutoDecompress(filePath: string): Promise<string | null> {
  const compressedPath = `${filePath}.gz`

  try {
    // First try compressed version
    await access(compressedPath)
    // File exists, decompress and read
    return await decompressAndRead(compressedPath)
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      // Some other error accessing the compressed file
      console.error('[Compression] Error accessing compressed file:', compressedPath, err)
      throw err
    }

    // Compressed version doesn't exist, try uncompressed
    try {
      await access(filePath)
      // Uncompressed file exists, read normally
      const content = await readFile(filePath, 'utf-8')
      return content
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // Neither compressed nor uncompressed file exists
        return null
      }
      // Some other error
      console.error('[Compression] Error reading uncompressed file:', filePath, err)
      throw err
    }
  }
}

/**
 * Decompress and read a .gz file
 *
 * @param compressedPath - Path to the .gz file
 * @returns Decompressed file contents
 */
async function decompressAndRead(compressedPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const gunzip = createGunzip()
    const source = createReadStream(compressedPath)

    gunzip.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    gunzip.on('end', () => {
      const content = Buffer.concat(chunks).toString('utf-8')
      resolve(content)
    })

    gunzip.on('error', (err) => {
      console.error('[Compression] Decompression error:', compressedPath, err)
      reject(err)
    })

    source.on('error', (err) => {
      console.error('[Compression] Read error:', compressedPath, err)
      reject(err)
    })

    source.pipe(gunzip)
  })
}

/**
 * Check if compressed version exists
 *
 * @param basePath - Base path to check (without .gz extension)
 * @returns Path to the actual file (compressed or uncompressed), or null if neither exists
 */
export async function getActualLogPath(basePath: string): Promise<string | null> {
  const compressedPath = `${basePath}.gz`

  try {
    await access(compressedPath)
    return compressedPath
  } catch {
    // Compressed doesn't exist, try uncompressed
    try {
      await access(basePath)
      return basePath
    } catch {
      // Neither exists
      return null
    }
  }
}
