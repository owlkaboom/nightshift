/**
 * Secure credential storage using Electron's safeStorage API
 *
 * This module provides encrypted storage for sensitive credentials like API keys.
 * It uses the OS-native encryption mechanisms:
 * - macOS: Keychain
 * - Windows: DPAPI (Data Protection API)
 * - Linux: Secret Service API (gnome-keyring, kwallet, etc.)
 *
 * The encrypted data is stored in a JSON file, with each value encrypted
 * using safeStorage before being written to disk.
 */

import { safeStorage } from 'electron'
import { join } from 'path'
import { getAppDataDir } from '../utils/paths'
import { readJson, writeJson } from './file-store'

/**
 * File name for encrypted credentials storage
 */
const SECURE_STORE_FILE = 'credentials.enc.json'

/**
 * Structure of the encrypted credentials file
 * Values are base64-encoded encrypted buffers
 */
interface EncryptedStore {
  version: number
  credentials: Record<string, string>
}

/**
 * Check if encryption is available on this platform
 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/**
 * Get the storage backend being used (useful for debugging)
 * Returns the backend name on Linux, or the platform name on other OSes
 */
export function getStorageBackend(): string {
  if (process.platform === 'linux') {
    return safeStorage.getSelectedStorageBackend()
  }
  return process.platform
}

/**
 * Get the path to the secure store file
 */
function getSecureStorePath(): string {
  return join(getAppDataDir(), SECURE_STORE_FILE)
}

/**
 * Load the encrypted store from disk
 */
async function loadStore(): Promise<EncryptedStore> {
  const path = getSecureStorePath()
  const store = await readJson<EncryptedStore>(path)

  if (!store) {
    return { version: 1, credentials: {} }
  }

  return store
}

/**
 * Save the encrypted store to disk
 */
async function saveStore(store: EncryptedStore): Promise<void> {
  const path = getSecureStorePath()
  await writeJson(path, store)
}

/**
 * Encrypt a string value using safeStorage
 * Returns base64-encoded encrypted buffer
 */
function encryptValue(value: string): string {
  if (!isEncryptionAvailable()) {
    // Fallback: On systems without secure storage (basic_text on Linux),
    // we still base64 encode but log a warning
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
    // Fallback: decode without decryption
    return buffer.toString('utf8')
  }

  try {
    return safeStorage.decryptString(buffer)
  } catch (error) {
    // If decryption fails (e.g., after OS reinstall or user change),
    // the credential is lost and should be re-entered
    console.error('[SecureStore] Failed to decrypt value:', error)
    throw new Error('Failed to decrypt credential. Please re-enter the value.')
  }
}

/**
 * Store a credential securely
 *
 * @param key - Unique identifier for the credential (e.g., 'gemini-api-key')
 * @param value - The secret value to store
 */
export async function setCredential(key: string, value: string): Promise<void> {
  const store = await loadStore()
  store.credentials[key] = encryptValue(value)
  await saveStore(store)
  console.log(`[SecureStore] Stored credential: ${key}`)
}

/**
 * Retrieve a stored credential
 *
 * @param key - Unique identifier for the credential
 * @returns The decrypted value, or null if not found
 */
export async function getCredential(key: string): Promise<string | null> {
  const store = await loadStore()
  const encrypted = store.credentials[key]

  if (!encrypted) {
    return null
  }

  try {
    return decryptValue(encrypted)
  } catch {
    // Credential exists but can't be decrypted
    // Remove the corrupted entry and return null
    await deleteCredential(key)
    return null
  }
}

/**
 * Delete a stored credential
 *
 * @param key - Unique identifier for the credential
 * @returns true if the credential was deleted, false if it didn't exist
 */
export async function deleteCredential(key: string): Promise<boolean> {
  const store = await loadStore()

  if (!(key in store.credentials)) {
    return false
  }

  delete store.credentials[key]
  await saveStore(store)
  console.log(`[SecureStore] Deleted credential: ${key}`)
  return true
}

/**
 * Check if a credential exists
 *
 * @param key - Unique identifier for the credential
 * @returns true if the credential exists
 */
export async function hasCredential(key: string): Promise<boolean> {
  const store = await loadStore()
  return key in store.credentials
}

/**
 * List all stored credential keys (not the values)
 *
 * @returns Array of credential keys
 */
export async function listCredentialKeys(): Promise<string[]> {
  const store = await loadStore()
  return Object.keys(store.credentials)
}

/**
 * Clear all stored credentials
 * Use with caution - this cannot be undone
 */
export async function clearAllCredentials(): Promise<void> {
  await saveStore({ version: 1, credentials: {} })
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
