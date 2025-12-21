/**
 * Terminal launcher utility for opening commands in a new terminal window
 * Supports macOS, Linux, and Windows
 */

import { spawn } from 'child_process'
import { platform } from 'os'

export interface TerminalLaunchOptions {
  /**
   * The command to run in the terminal
   */
  command: string

  /**
   * Arguments to pass to the command
   */
  args?: string[]

  /**
   * Working directory for the command
   */
  cwd?: string

  /**
   * Environment variables
   */
  env?: Record<string, string>

  /**
   * Title for the terminal window
   */
  title?: string

  /**
   * Whether to keep the terminal open after the command completes
   */
  keepOpen?: boolean
}

/**
 * Launch a command in a new terminal window
 * Returns a promise that resolves when the terminal window is launched (not when the command completes)
 */
export async function launchInTerminal(options: TerminalLaunchOptions): Promise<void> {
  const currentPlatform = platform()

  switch (currentPlatform) {
    case 'darwin':
      return launchInTerminalMacOS(options)
    case 'linux':
      return launchInTerminalLinux(options)
    case 'win32':
      return launchInTerminalWindows(options)
    default:
      throw new Error(`Unsupported platform: ${currentPlatform}`)
  }
}

/**
 * Launch in macOS Terminal.app or iTerm2
 */
async function launchInTerminalMacOS(options: TerminalLaunchOptions): Promise<void> {
  const { command, args = [], cwd, title, keepOpen = false } = options

  // Build the full command
  const fullCommand = [command, ...args].map((s) => s.replace(/'/g, "'\\''")).join(' ')

  // Build the AppleScript
  let script = ''

  // Change directory if needed
  if (cwd) {
    script += `cd '${cwd.replace(/'/g, "'\\''")}' && `
  }

  // Add the command
  script += fullCommand

  // Keep terminal open if requested
  if (keepOpen) {
    script += '; exec $SHELL'
  }

  // Set the title if provided
  const titleScript = title
    ? `tell window 1 to set custom title to "${title.replace(/"/g, '\\"')}"`
    : ''

  const osascript = `
    tell application "Terminal"
      activate
      do script "${script.replace(/"/g, '\\"').replace(/\$/g, '\\$')}"
      ${titleScript}
    end tell
  `

  return new Promise((resolve, reject) => {
    const proc = spawn('osascript', ['-e', osascript], {
      stdio: 'ignore',
      detached: true
    })

    proc.on('error', reject)
    proc.on('spawn', () => {
      proc.unref()
      resolve()
    })
  })
}

/**
 * Launch in Linux terminal emulator
 * Tries gnome-terminal, konsole, xterm in that order
 */
async function launchInTerminalLinux(options: TerminalLaunchOptions): Promise<void> {
  const { command, args = [], cwd, title, keepOpen = false } = options

  // Build the full command
  let fullCommand = [command, ...args].map((s) => `'${s.replace(/'/g, "'\\''")}'`).join(' ')

  // Change directory if needed
  if (cwd) {
    fullCommand = `cd '${cwd.replace(/'/g, "'\\''")}' && ${fullCommand}`
  }

  // Keep terminal open if requested
  if (keepOpen) {
    fullCommand += '; exec $SHELL'
  }

  // Try different terminal emulators
  const terminals = [
    {
      name: 'gnome-terminal',
      args: ['--', 'bash', '-c', fullCommand],
      titleArgs: title ? ['--title', title] : []
    },
    {
      name: 'konsole',
      args: ['-e', 'bash', '-c', fullCommand],
      titleArgs: title ? ['--title', title] : []
    },
    {
      name: 'xterm',
      args: ['-e', 'bash', '-c', fullCommand],
      titleArgs: title ? ['-T', title] : []
    },
    {
      name: 'x-terminal-emulator',
      args: ['-e', 'bash', '-c', fullCommand],
      titleArgs: title ? ['-T', title] : []
    }
  ]

  // Try each terminal in order
  for (const terminal of terminals) {
    try {
      await tryLaunchTerminal(
        terminal.name,
        [...terminal.titleArgs, ...terminal.args],
        options.env
      )
      return
    } catch {
      // Try next terminal
      continue
    }
  }

  throw new Error('No supported terminal emulator found')
}

/**
 * Launch in Windows Terminal, cmd.exe, or PowerShell
 */
async function launchInTerminalWindows(options: TerminalLaunchOptions): Promise<void> {
  const { command, args = [], cwd, title, keepOpen = false } = options

  // Build the full command
  const fullCommand = [command, ...args].join(' ')

  // Try Windows Terminal first (modern), then fall back to cmd.exe
  const useWindowsTerminal = await checkWindowsTerminal()

  if (useWindowsTerminal) {
    // Use Windows Terminal
    const wtArgs = ['--title', title || 'Nightshift']

    if (cwd) {
      wtArgs.push('--startingDirectory', cwd)
    }

    wtArgs.push('--', 'cmd.exe', '/c')

    if (keepOpen) {
      wtArgs.push(`${fullCommand} & pause`)
    } else {
      wtArgs.push(fullCommand)
    }

    return new Promise((resolve, reject) => {
      const proc = spawn('wt', wtArgs, {
        stdio: 'ignore',
        detached: true,
        shell: false,
        env: options.env
      })

      proc.on('error', reject)
      proc.on('spawn', () => {
        proc.unref()
        resolve()
      })
    })
  } else {
    // Fall back to cmd.exe
    const cmdArgs = ['/c', 'start']

    if (title) {
      cmdArgs.push(`"${title}"`)
    } else {
      cmdArgs.push('""') // Empty title
    }

    cmdArgs.push('cmd.exe', '/k')

    if (cwd) {
      cmdArgs.push(`cd /d "${cwd}" &&`)
    }

    cmdArgs.push(fullCommand)

    if (!keepOpen) {
      cmdArgs.push('&& exit')
    }

    return new Promise((resolve, reject) => {
      const proc = spawn('cmd.exe', cmdArgs, {
        stdio: 'ignore',
        detached: true,
        shell: false,
        env: options.env
      })

      proc.on('error', reject)
      proc.on('spawn', () => {
        proc.unref()
        resolve()
      })
    })
  }
}

/**
 * Try to launch a terminal emulator
 */
function tryLaunchTerminal(
  terminal: string,
  args: string[],
  env?: Record<string, string>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(terminal, args, {
      stdio: 'ignore',
      detached: true,
      env: { ...process.env, ...env }
    })

    proc.on('error', reject)
    proc.on('spawn', () => {
      proc.unref()
      resolve()
    })
  })
}

/**
 * Check if Windows Terminal (wt.exe) is available
 */
async function checkWindowsTerminal(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('where', ['wt'], {
      stdio: 'ignore'
    })

    proc.on('error', () => resolve(false))
    proc.on('close', (code) => resolve(code === 0))
  })
}
