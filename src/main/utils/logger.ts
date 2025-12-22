/**
 * File Logger with Rotation
 *
 * Writes logs to ~/.nightshift/logs/nightshift.log with automatic rotation.
 * - Max file size: 10MB
 * - Max files kept: 5
 * - On rotation: nightshift.log → nightshift.log.1 → nightshift.log.2 → ... → deleted
 */

import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, renameSync, WriteStream } from 'fs'
import { join } from 'path'
import { getLogsDir } from './paths'

/** Maximum size of a single log file (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024

/** Maximum number of log files to keep (including active log) */
const MAX_FILES = 5

/** Current log file name */
const LOG_FILE_NAME = 'nightshift.log'

/**
 * Logger class that handles file writing with rotation
 */
class FileLogger {
  private stream: WriteStream | null = null
  private currentSize = 0
  private logsDir: string
  private initialized = false
  private debugEnabled = false
  private originalConsoleLog: typeof console.log
  private originalConsoleError: typeof console.error
  private originalConsoleWarn: typeof console.warn

  constructor() {
    this.logsDir = getLogsDir()
    // Store original console methods
    this.originalConsoleLog = console.log.bind(console)
    this.originalConsoleError = console.error.bind(console)
    this.originalConsoleWarn = console.warn.bind(console)
    // Check env variable for debug mode
    this.debugEnabled = process.env.DEBUG === 'true'
  }

  /**
   * Enable or disable debug logging
   */
  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled
    if (this.initialized) {
      this.log('info', `Debug logging ${enabled ? 'enabled' : 'disabled'}`)
    }
  }

  /**
   * Check if debug logging is enabled
   */
  isDebugEnabled(): boolean {
    return this.debugEnabled
  }

  /**
   * Get the logs directory path
   */
  getLogsDir(): string {
    return this.logsDir
  }

  /**
   * Log a debug message (only if debug mode is enabled)
   */
  debug(...args: unknown[]): void {
    if (!this.debugEnabled) return
    this.originalConsoleLog('[DEBUG]', ...args)
    this.writeToFile('debug', ...args)
  }

  /**
   * Log an info message (always shown)
   */
  info(...args: unknown[]): void {
    this.originalConsoleLog('[INFO]', ...args)
    this.writeToFile('info', ...args)
  }

  /**
   * Initialize the logger - creates directory and opens file stream
   */
  initialize(): void {
    if (this.initialized) return

    try {
      // Ensure logs directory exists
      if (!existsSync(this.logsDir)) {
        mkdirSync(this.logsDir, { recursive: true })
      }

      // Clean up old timestamped logs from previous versions
      this.cleanupLegacyLogs()

      // Open the current log file
      this.openLogFile()

      // Override console methods to also write to file
      this.hookConsole()

      this.initialized = true
      this.log('info', 'Logger initialized')
    } catch (error) {
      // Don't break the app if logging fails
      this.originalConsoleError('[Logger] Failed to initialize:', error)
    }
  }

  /**
   * Get the path for the current log file
   */
  private getCurrentLogPath(): string {
    return join(this.logsDir, LOG_FILE_NAME)
  }

  /**
   * Get the path for a rotated log file (e.g., nightshift.log.1)
   */
  private getRotatedLogPath(index: number): string {
    return join(this.logsDir, `${LOG_FILE_NAME}.${index}`)
  }

  /**
   * Open the current log file stream
   */
  private openLogFile(): void {
    const logPath = this.getCurrentLogPath()

    // Get current file size if it exists
    try {
      if (existsSync(logPath)) {
        this.currentSize = statSync(logPath).size
      } else {
        this.currentSize = 0
      }
    } catch {
      this.currentSize = 0
    }

    this.stream = createWriteStream(logPath, { flags: 'a' })

    // Handle stream errors gracefully
    this.stream.on('error', (err) => {
      this.originalConsoleError('[Logger] Stream error:', err)
      this.stream = null
    })
  }

  /**
   * Clean up legacy timestamped log files from previous versions
   */
  private cleanupLegacyLogs(): void {
    try {
      const files = readdirSync(this.logsDir)
        .filter(f => f.startsWith('nightshift-') && f.endsWith('.log'))

      for (const file of files) {
        try {
          const filePath = join(this.logsDir, file)
          unlinkSync(filePath)
          this.originalConsoleLog('[Logger] Removed legacy log file:', file)
        } catch {
          // Ignore deletion errors
        }
      }
    } catch {
      // Ignore errors during cleanup
    }
  }

  /**
   * Rotate log files when size limit is reached
   * nightshift.log → nightshift.log.1 → nightshift.log.2 → ... → deleted
   */
  private rotateLogs(): void {
    try {
      // Close current stream
      if (this.stream) {
        this.stream.end()
        this.stream = null
      }

      // Delete the oldest log file if it exists (nightshift.log.{MAX_FILES-1})
      const oldestLogPath = this.getRotatedLogPath(MAX_FILES - 1)
      if (existsSync(oldestLogPath)) {
        try {
          unlinkSync(oldestLogPath)
          this.originalConsoleLog('[Logger] Removed oldest log file:', `${LOG_FILE_NAME}.${MAX_FILES - 1}`)
        } catch {
          // Ignore deletion errors
        }
      }

      // Shift existing rotated logs: .1 → .2, .2 → .3, etc.
      for (let i = MAX_FILES - 2; i >= 1; i--) {
        const sourcePath = this.getRotatedLogPath(i)
        const destPath = this.getRotatedLogPath(i + 1)

        if (existsSync(sourcePath)) {
          try {
            renameSync(sourcePath, destPath)
          } catch {
            // Ignore rename errors
          }
        }
      }

      // Rotate current log to .1
      const currentLogPath = this.getCurrentLogPath()
      const rotatedLogPath = this.getRotatedLogPath(1)

      if (existsSync(currentLogPath)) {
        try {
          renameSync(currentLogPath, rotatedLogPath)
          this.originalConsoleLog('[Logger] Rotated log file:', LOG_FILE_NAME, '→', `${LOG_FILE_NAME}.1`)
        } catch {
          // Ignore rename errors
        }
      }

      // Open a fresh log file
      this.openLogFile()
    } catch (error) {
      this.originalConsoleError('[Logger] Error during log rotation:', error)
      // Try to open log file anyway
      this.openLogFile()
    }
  }

  /**
   * Check if current log file needs rotation
   */
  private checkRotation(): void {
    if (this.currentSize >= MAX_FILE_SIZE) {
      this.rotateLogs()
    }
  }

  /**
   * Write a message to the log file
   */
  private writeToFile(level: string, ...args: unknown[]): void {
    if (!this.stream) return

    try {
      const timestamp = new Date().toISOString()
      const message = args.map(arg => {
        if (typeof arg === 'string') return arg
        if (arg instanceof Error) return `${arg.message}\n${arg.stack}`
        try {
          return JSON.stringify(arg)
        } catch {
          return String(arg)
        }
      }).join(' ')

      const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`
      const bytes = Buffer.byteLength(logLine, 'utf8')

      this.stream.write(logLine)
      this.currentSize += bytes

      this.checkRotation()
    } catch {
      // Ignore write errors
    }
  }

  /**
   * Hook into console methods to capture all logs
   */
  private hookConsole(): void {
    console.log = (...args: unknown[]) => {
      this.originalConsoleLog(...args)
      this.writeToFile('info', ...args)
    }

    console.error = (...args: unknown[]) => {
      this.originalConsoleError(...args)
      this.writeToFile('error', ...args)
    }

    console.warn = (...args: unknown[]) => {
      this.originalConsoleWarn(...args)
      this.writeToFile('warn', ...args)
    }
  }

  /**
   * Log a message at a specific level
   */
  log(level: 'info' | 'warn' | 'error', ...args: unknown[]): void {
    switch (level) {
      case 'info':
        console.log(...args)
        break
      case 'warn':
        console.warn(...args)
        break
      case 'error':
        console.error(...args)
        break
    }
  }

  /**
   * Close the logger stream
   */
  close(): void {
    if (this.stream) {
      this.stream.end()
      this.stream = null
    }
    // Restore original console methods
    console.log = this.originalConsoleLog
    console.error = this.originalConsoleError
    console.warn = this.originalConsoleWarn
    this.initialized = false
  }
}

/** Singleton logger instance */
export const logger = new FileLogger()

/**
 * Initialize the file logger
 * Call this early in the app startup
 */
export function initializeLogger(): void {
  logger.initialize()
}

/**
 * Close the file logger
 * Call this during app shutdown
 */
export function closeLogger(): void {
  logger.close()
}
