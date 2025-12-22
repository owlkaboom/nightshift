/**
 * Renderer process logger
 *
 * Provides consistent logging with debug mode support.
 * Debug logs are only shown when DEBUG=true in the environment or
 * when explicitly enabled via setDebugEnabled().
 */

class RendererLogger {
  private debugEnabled = false

  constructor() {
    // Check if debug mode is enabled via environment or localStorage
    this.debugEnabled =
      import.meta.env.DEV || localStorage.getItem('debug') === 'true'
  }

  /**
   * Enable or disable debug logging
   */
  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled
    localStorage.setItem('debug', enabled ? 'true' : 'false')
  }

  /**
   * Check if debug logging is enabled
   */
  isDebugEnabled(): boolean {
    return this.debugEnabled
  }

  /**
   * Log a debug message (only if debug mode is enabled)
   */
  debug(...args: unknown[]): void {
    if (!this.debugEnabled) return
    console.log('[DEBUG]', ...args)
  }

  /**
   * Log an info message
   */
  info(...args: unknown[]): void {
    console.log('[INFO]', ...args)
  }

  /**
   * Log a warning message
   */
  warn(...args: unknown[]): void {
    console.warn('[WARN]', ...args)
  }

  /**
   * Log an error message
   */
  error(...args: unknown[]): void {
    console.error('[ERROR]', ...args)
  }
}

/** Singleton logger instance for the renderer process */
export const logger = new RendererLogger()
