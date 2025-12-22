/**
 * OAuth Token Management Module
 *
 * Handles retrieval of OAuth tokens from platform-specific storage.
 * - macOS: System Keychain
 * - Linux: Credentials file in ~/.config/claude-code/
 * - Windows: Credentials file in %LOCALAPPDATA% or %APPDATA%
 */

import { exec } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { homedir, platform } from 'os'
import { join } from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Get the OAuth access token from the system keychain or credentials file
 *
 * This token is used to authenticate with Anthropic APIs for:
 * - Usage percentage queries
 * - Available models fetching
 */
export async function getOAuthToken(): Promise<string | null> {
  const currentPlatform = platform()

  if (currentPlatform === 'darwin') {
    // macOS: Use security command to get from Keychain
    try {
      const { stdout } = await execAsync(
        'security find-generic-password -s "Claude Code-credentials" -w'
      )
      const credentials = JSON.parse(stdout.trim())
      return credentials.claudeAiOauth?.accessToken || null
    } catch (error) {
      console.warn('[OAuth] Failed to get OAuth token from Keychain:', error)
    }
  } else if (currentPlatform === 'linux') {
    // Linux: Try to read from credentials file
    try {
      const credentialsPath = join(homedir(), '.config', 'claude-code', 'credentials.json')
      if (existsSync(credentialsPath)) {
        const credentials = JSON.parse(readFileSync(credentialsPath, 'utf-8'))
        return credentials.claudeAiOauth?.accessToken || null
      }
    } catch (error) {
      console.warn('[OAuth] Failed to read credentials file:', error)
    }
  } else if (currentPlatform === 'win32') {
    // Windows: Try credentials file in various locations
    // Claude Code CLI (Electron app) typically stores in LOCALAPPDATA
    const possibleCredentialPaths = [
      // LOCALAPPDATA (preferred for Electron apps)
      join(process.env.LOCALAPPDATA || '', 'claude-code', 'credentials.json'),
      join(process.env.LOCALAPPDATA || '', 'Claude Code', 'credentials.json'),
      // APPDATA fallback
      join(process.env.APPDATA || '', 'claude-code', 'credentials.json'),
      join(process.env.APPDATA || '', 'Claude Code', 'credentials.json')
    ]

    for (const credentialsPath of possibleCredentialPaths) {
      try {
        if (existsSync(credentialsPath)) {
          const credentials = JSON.parse(readFileSync(credentialsPath, 'utf-8'))
          if (credentials.claudeAiOauth?.accessToken) {
            return credentials.claudeAiOauth.accessToken
          }
        }
      } catch (error) {
        console.warn('[OAuth] Failed to read credentials file at', credentialsPath, ':', error)
      }
    }
  }

  return null
}
