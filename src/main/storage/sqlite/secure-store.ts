/**
 * SQLite Secure Credential Storage
 *
 * Uses SQLite for credential storage with Electron's safeStorage for encryption.
 * Values are encrypted using the OS-native encryption mechanisms before storage.
 */

import { safeStorage } from 'electron'
import { getDatabase } from '../database'

// ============ Encryption Helpers ============

/**
 * Check if encryption is available on this platform
 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/**
 * Get the storage backend being used
 */
export function getStorageBackend(): string {
  if (process.platform === 'linux') {
    return safeStorage.getSelectedStorageBackend()
  }
  return process.platform
}

/**
 * Encrypt a string value using safeStorage
 */
function encryptValue(value: string): string {
  if (!isEncryptionAvailable()) {
    console.warn(
      '[SecureStore] Encryption not available on this system. ' +
        'Credentials will be stored with basic encoding only.'
    )
    return Buffer.from(value, 'utf8').toString('base64')
  }

  const encrypted = safeStorage.encryptString(value)
  return encrypted.toString('base64')
}

/**
 * Decrypt a base64-encoded encrypted value
 */
function decryptValue(encoded: string): string {
  const buffer = Buffer.from(encoded, 'base64')

  if (!isEncryptionAvailable()) {
    return buffer.toString('utf8')
  }

  try {
    return safeStorage.decryptString(buffer)
  } catch (error) {
    console.error('[SecureStore] Failed to decrypt value:', error)
    throw new Error('Failed to decrypt credential. Please re-enter the value.')
  }
}

// ============ Credential Operations ============

/**
 * Store a credential securely
 */
export async function setCredential(key: string, value: string): Promise<void> {
  const db = getDatabase()
  const encrypted = encryptValue(value)

  db.prepare(`
    INSERT OR REPLACE INTO credentials (key, encrypted_value)
    VALUES (?, ?)
  `).run(key, encrypted)

  console.log(`[SecureStore] Stored credential: ${key}`)
}

/**
 * Retrieve a stored credential
 */
export async function getCredential(key: string): Promise<string | null> {
  const db = getDatabase()
  const row = db
    .prepare('SELECT encrypted_value FROM credentials WHERE key = ?')
    .get(key) as { encrypted_value: string } | undefined

  if (!row) {
    return null
  }

  try {
    return decryptValue(row.encrypted_value)
  } catch {
    // Credential exists but can't be decrypted - remove it
    await deleteCredential(key)
    return null
  }
}

/**
 * Delete a stored credential
 */
export async function deleteCredential(key: string): Promise<boolean> {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM credentials WHERE key = ?').run(key)

  if (result.changes > 0) {
    console.log(`[SecureStore] Deleted credential: ${key}`)
    return true
  }
  return false
}

/**
 * Check if a credential exists
 */
export async function hasCredential(key: string): Promise<boolean> {
  const db = getDatabase()
  const row = db
    .prepare('SELECT 1 FROM credentials WHERE key = ?')
    .get(key)

  return row !== undefined
}

/**
 * List all stored credential keys
 */
export async function listCredentialKeys(): Promise<string[]> {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT key FROM credentials')
    .all() as { key: string }[]

  return rows.map((r) => r.key)
}

/**
 * Clear all stored credentials
 */
export async function clearAllCredentials(): Promise<void> {
  const db = getDatabase()
  db.prepare('DELETE FROM credentials').run()
  console.log('[SecureStore] Cleared all credentials')
}

// ============ Agent-Specific Credential Helpers ============

/**
 * Generate a credential key for an agent's API key
 */
export function getAgentApiKeyId(agentId: string): string {
  return `agent:${agentId}:apiKey`
}

/**
 * Store an agent's API key securely
 */
export async function setAgentApiKey(agentId: string, apiKey: string): Promise<void> {
  await setCredential(getAgentApiKeyId(agentId), apiKey)
}

/**
 * Retrieve an agent's API key
 */
export async function getAgentApiKey(agentId: string): Promise<string | null> {
  return getCredential(getAgentApiKeyId(agentId))
}

/**
 * Delete an agent's API key
 */
export async function deleteAgentApiKey(agentId: string): Promise<boolean> {
  return deleteCredential(getAgentApiKeyId(agentId))
}

/**
 * Check if an agent has an API key stored
 */
export async function hasAgentApiKey(agentId: string): Promise<boolean> {
  return hasCredential(getAgentApiKeyId(agentId))
}
