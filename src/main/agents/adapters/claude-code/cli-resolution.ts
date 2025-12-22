/**
 * CLI Resolution Module
 *
 * Handles detection of Claude Code CLI and proper node resolution
 * for node manager installations (nvm, fnm, volta, asdf).
 */

import { exec } from 'child_process'
import { existsSync } from 'fs'
import { homedir, platform } from 'os'
import { dirname, join } from 'path'
import { promisify } from 'util'
import { logger } from '@main/utils/logger'

const execAsync = promisify(exec)

/**
 * Result of CLI execution resolution
 */
export interface CliExecution {
  /** The command to execute (node binary or CLI path) */
  command: string
  /** Additional args to prepend (CLI path if using node) */
  prependArgs: string[]
}

/**
 * Possible paths where Claude Code CLI might be installed
 */
export const POSSIBLE_PATHS =
  platform() === 'win32'
    ? [
        // npm global install on Windows
        join(process.env.APPDATA || '', 'npm', 'claude.cmd'),
        join(process.env.APPDATA || '', 'npm', 'claude'),
        // npm prefix on Windows
        join(process.env.PROGRAMFILES || '', 'nodejs', 'claude.cmd'),
        join(process.env.PROGRAMFILES || '', 'nodejs', 'claude'),
        // Local AppData npm
        join(process.env.LOCALAPPDATA || '', 'npm', 'claude.cmd'),
        join(process.env.LOCALAPPDATA || '', 'npm', 'claude'),
        // User profile npm
        join(homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
        join(homedir(), 'AppData', 'Roaming', 'npm', 'claude'),
        // nvm-windows
        join(
          process.env.NVM_HOME || join(homedir(), 'AppData', 'Roaming', 'nvm'),
          '*/claude.cmd'
        ),
        // Scoop
        join(homedir(), 'scoop', 'shims', 'claude.cmd'),
        // Chocolatey
        join(
          process.env.ChocolateyInstall || 'C:\\ProgramData\\chocolatey',
          'bin',
          'claude.cmd'
        )
      ]
    : [
        // npm global install (Unix)
        '/usr/local/bin/claude',
        '/usr/bin/claude',
        // homebrew (Apple Silicon)
        '/opt/homebrew/bin/claude',
        // homebrew (Intel)
        '/usr/local/Homebrew/bin/claude',
        // user local
        join(homedir(), '.local/bin/claude'),
        // npm global prefix
        join(homedir(), '.npm-global/bin/claude'),
        // npm packages
        join(homedir(), '.npm/bin/claude'),
        // yarn global
        join(homedir(), '.yarn/bin/claude'),
        // pnpm global
        join(homedir(), '.pnpm/bin/claude'),
        join(homedir(), '.local/share/pnpm/claude'),
        // nvm (try multiple node versions, sorted descending)
        join(homedir(), '.nvm/versions/node/*/bin/claude'),
        // volta
        join(homedir(), '.volta/bin/claude'),
        // fnm (Fast Node Manager)
        join(homedir(), '.fnm/node-versions/*/installation/bin/claude'),
        // asdf
        join(homedir(), '.asdf/installs/nodejs/*/bin/claude')
      ]

/**
 * Check if a path is within a node version manager installation
 */
export function isNodeManagerPath(path: string): boolean {
  return (
    path.includes('.nvm') ||
    path.includes('.fnm') ||
    path.includes('.volta') ||
    path.includes('.asdf') ||
    path.includes('nvm')
  )
}

/**
 * Find the node binary for a CLI path in a node manager installation
 *
 * Given a path like:
 *   ~/.nvm/versions/node/v22.14.0/lib/node_modules/@anthropic-ai/claude-code/cli.js
 * or:
 *   ~/.nvm/versions/node/v22.14.0/bin/claude
 *
 * Returns the node binary path:
 *   ~/.nvm/versions/node/v22.14.0/bin/node
 */
export function findNodeBinary(cliPath: string): string | null {
  // Pattern 1: Path contains /lib/node_modules/
  // e.g., .nvm/versions/node/v22.14.0/lib/node_modules/.../cli.js
  const libMatch = cliPath.match(
    /(.+[/\\](?:\.nvm|\.fnm|\.volta|\.asdf)[/\\](?:versions[/\\]node[/\\]|node-versions[/\\]|installs[/\\]nodejs[/\\])?v?[\d.]+(?:[/\\]installation)?)[/\\]lib[/\\]node_modules[/\\]/i
  )
  if (libMatch) {
    const nodeVersionDir = libMatch[1]
    const nodePath = join(nodeVersionDir, 'bin', 'node')
    if (existsSync(nodePath)) {
      logger.debug('[CliResolution] Found node via lib path:', nodePath)
      return nodePath
    }
  }

  // Pattern 2: Path is in /bin/ directory
  // e.g., .nvm/versions/node/v22.14.0/bin/claude
  const binDir = dirname(cliPath)
  if (binDir.endsWith('bin') && isNodeManagerPath(cliPath)) {
    const nodePath = join(binDir, 'node')
    if (existsSync(nodePath)) {
      logger.debug('[CliResolution] Found node in same bin dir:', nodePath)
      return nodePath
    }
  }

  // Pattern 3: Volta stores node differently
  // e.g., ~/.volta/tools/image/node/22.14.0/bin/node
  if (cliPath.includes('.volta')) {
    const voltaMatch = cliPath.match(/(.+[/\\]\.volta)[/\\]/i)
    if (voltaMatch) {
      // Volta uses shims, the actual node is resolved at runtime
      // For CLI execution, we can use the volta-managed node
      const voltaNodePath = join(voltaMatch[1], 'bin', 'node')
      if (existsSync(voltaNodePath)) {
        logger.debug('[CliResolution] Found volta node shim:', voltaNodePath)
        return voltaNodePath
      }
    }
  }

  logger.debug('[CliResolution] Could not find node binary for:', cliPath)
  return null
}

/**
 * Resolve how to execute a CLI path
 *
 * If the CLI is a .js file in a node manager path, returns the node binary
 * as the command with the CLI path as the first argument.
 *
 * Otherwise, returns the CLI path as the command directly.
 */
export function resolveCliExecution(cliPath: string): CliExecution {
  // Check if this is a .js file that needs node to execute
  const isJsFile = cliPath.endsWith('.js')
  const inNodeManager = isNodeManagerPath(cliPath)

  if (isJsFile && inNodeManager) {
    const nodePath = findNodeBinary(cliPath)
    if (nodePath) {
      logger.debug('[CliResolution] Using explicit node execution:', nodePath, cliPath)
      return {
        command: nodePath,
        prependArgs: [cliPath]
      }
    }
    // Fall through to direct execution if we can't find node
    logger.debug('[CliResolution] Could not find node, attempting direct execution')
  }

  return {
    command: cliPath,
    prependArgs: []
  }
}

/**
 * Find the Claude Code CLI executable
 *
 * Tries multiple strategies:
 * 1. Shell PATH lookup (which/where)
 * 2. Login shell PATH lookup (bash -l, zsh -l)
 * 3. Known installation paths
 * 4. Glob patterns for version managers
 */
export async function findClaudeCli(): Promise<string | null> {
  const isWindows = platform() === 'win32'
  const isMac = platform() === 'darwin'

  // Strategy 1: Check if 'claude' is in PATH
  try {
    if (isWindows) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await execAsync('where claude', { encoding: 'utf8', timeout: 5000, shell: true } as any)
      const stdout = String(result.stdout)
      const path = stdout.trim().split('\n')[0].trim()
      if (path && existsSync(path)) {
        logger.debug('[CliResolution] Found claude via where command:', path)
        return path
      }
    } else {
      // Try direct which (works if in system PATH)
      try {
        const result = await execAsync('which claude', {
          encoding: 'utf8',
          timeout: 3000
        } as Parameters<typeof execAsync>[1])
        const path = String(result.stdout).trim()
        if (path && existsSync(path)) {
          logger.debug('[CliResolution] Found claude via which:', path)
          return path
        }
      } catch {
        logger.debug('[CliResolution] which command failed, trying login shell')
      }

      // Strategy 2: Try bash login shell (loads ~/.bash_profile, ~/.bashrc)
      try {
        const result = await execAsync('bash -l -c "which claude"', {
          encoding: 'utf8',
          timeout: 5000
        } as Parameters<typeof execAsync>[1])
        const path = String(result.stdout).trim()
        if (path && existsSync(path)) {
          logger.debug('[CliResolution] Found claude via bash login shell:', path)
          return path
        }
      } catch {
        logger.debug('[CliResolution] bash login shell failed, trying zsh')
      }

      // Strategy 3: Try zsh login shell (common on modern macOS)
      if (isMac) {
        try {
          const result = await execAsync('zsh -l -c "which claude"', {
            encoding: 'utf8',
            timeout: 5000
          } as Parameters<typeof execAsync>[1])
          const path = String(result.stdout).trim()
          if (path && existsSync(path)) {
            logger.debug('[CliResolution] Found claude via zsh login shell:', path)
            return path
          }
        } catch {
          logger.debug('[CliResolution] zsh login shell failed, checking known locations')
        }
      }
    }
  } catch {
    logger.debug('[CliResolution] Could not find claude in PATH, checking known locations')
  }

  // Strategy 4: Check known installation paths
  for (const path of POSSIBLE_PATHS) {
    // Skip empty paths (can happen if env vars are undefined)
    if (!path || path.includes('undefined')) continue

    // Handle glob-like patterns (for nvm)
    if (path.includes('*')) {
      try {
        const { glob } = await import('glob')
        const matches = await glob(path.replace(/\\/g, '/'), { nodir: true })
        // Sort by version number (descending) to get latest version
        const sortedMatches = matches.sort((a, b) => b.localeCompare(a))
        if (sortedMatches.length > 0 && existsSync(sortedMatches[0])) {
          logger.debug('[CliResolution] Found claude via glob pattern:', sortedMatches[0])
          return sortedMatches[0]
        }
      } catch (err) {
        logger.debug('[CliResolution] glob pattern failed:', path, err)
      }
    } else if (existsSync(path)) {
      logger.debug('[CliResolution] Found claude at known path:', path)
      return path
    }
  }

  logger.debug('[CliResolution] Could not find claude executable')
  return null
}
