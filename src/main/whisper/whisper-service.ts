/**
 * Local Whisper transcription service using @huggingface/transformers
 * Runs speech-to-text entirely offline using ONNX models
 *
 * Dependencies (@huggingface/transformers and wavefile) are installed
 * automatically to ~/.nightshift/whisper-deps/ on first use.
 */

import { join } from 'path'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import { createRequire } from 'module'
import { getAppDataDir } from '../utils/paths'

const execAsync = promisify(exec)

// Dynamic import for ESM module - these are optional dependencies
let pipeline: typeof import('@huggingface/transformers').pipeline | null = null
let WaveFile: typeof import('wavefile').WaveFile | null = null
let modulesAvailable: boolean | null = null
let depsInstalling = false
let depsInstallError: string | null = null

// Whisper dependencies to install
const WHISPER_DEPS = [
  '@huggingface/transformers@^3.8.1',
  'wavefile@^11.0.0',
  'onnxruntime-node@^1.21.0'
]

/**
 * Get the directory for user-installed Whisper dependencies
 */
function getWhisperDepsDir(): string {
  return join(getAppDataDir(), 'whisper-deps')
}

/**
 * Check if Whisper dependencies are installed in the user directory
 */
function areDepsInstalled(): boolean {
  const depsDir = getWhisperDepsDir()
  const nodeModules = join(depsDir, 'node_modules')
  return (
    existsSync(join(nodeModules, '@huggingface', 'transformers')) &&
    existsSync(join(nodeModules, 'wavefile'))
  )
}

/**
 * Get the installation status of Whisper dependencies
 */
export function getWhisperDepsStatus(): {
  installed: boolean
  installing: boolean
  error: string | null
  path: string
} {
  return {
    installed: areDepsInstalled(),
    installing: depsInstalling,
    error: depsInstallError,
    path: getWhisperDepsDir()
  }
}

/**
 * Install Whisper dependencies to the user directory
 * This runs npm install in ~/.nightshift/whisper-deps/
 */
export async function installWhisperDeps(
  onProgress?: (message: string) => void
): Promise<{ success: boolean; error?: string }> {
  if (depsInstalling) {
    return { success: false, error: 'Installation already in progress' }
  }

  if (areDepsInstalled()) {
    return { success: true }
  }

  depsInstalling = true
  depsInstallError = null

  const depsDir = getWhisperDepsDir()

  try {
    // Create deps directory
    if (!existsSync(depsDir)) {
      await mkdir(depsDir, { recursive: true })
    }

    // Create a minimal package.json
    const packageJson = {
      name: 'nightshift-whisper-deps',
      version: '1.0.0',
      private: true,
      dependencies: {}
    }
    await writeFile(join(depsDir, 'package.json'), JSON.stringify(packageJson, null, 2))

    onProgress?.('Installing Whisper dependencies (this may take a few minutes)...')
    console.log('[Whisper] Installing dependencies to:', depsDir)

    // Run npm install
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const depsString = WHISPER_DEPS.join(' ')

    const { stdout, stderr } = await execAsync(`${npmCmd} install ${depsString}`, {
      cwd: depsDir,
      timeout: 5 * 60 * 1000, // 5 minute timeout
      env: {
        ...process.env,
        // Ensure npm doesn't try to use a global config that might cause issues
        npm_config_global: 'false'
      }
    })

    if (stderr && !stderr.includes('npm warn') && !stderr.includes('npm WARN')) {
      console.warn('[Whisper] npm stderr:', stderr)
    }
    console.log('[Whisper] npm stdout:', stdout)

    // Reset module availability cache so it re-checks
    modulesAvailable = null

    onProgress?.('Whisper dependencies installed successfully')
    console.log('[Whisper] Dependencies installed successfully')

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    depsInstallError = message
    console.error('[Whisper] Failed to install dependencies:', message)
    return { success: false, error: message }
  } finally {
    depsInstalling = false
  }
}

/**
 * Ensure Whisper dependencies are available, installing if needed
 */
export async function ensureWhisperDeps(
  onProgress?: (message: string) => void
): Promise<boolean> {
  // First check if available from the app bundle
  if (await isWhisperAvailable()) {
    return true
  }

  // Check if already installed in user dir
  if (areDepsInstalled()) {
    // Re-check availability after confirming deps exist
    modulesAvailable = null
    return isWhisperAvailable()
  }

  // Try to install
  onProgress?.('Whisper dependencies not found, installing...')
  const result = await installWhisperDeps(onProgress)

  if (result.success) {
    modulesAvailable = null
    return isWhisperAvailable()
  }

  return false
}

// Available Whisper models (ordered by size)
export const WHISPER_MODELS = {
  'tiny.en': {
    id: 'Xenova/whisper-tiny.en',
    name: 'Tiny (English)',
    size: '~40MB',
    description: 'Fastest, English only'
  },
  'tiny': {
    id: 'Xenova/whisper-tiny',
    name: 'Tiny (Multilingual)',
    size: '~75MB',
    description: 'Fast, 99 languages'
  },
  'base.en': {
    id: 'Xenova/whisper-base.en',
    name: 'Base (English)',
    size: '~145MB',
    description: 'Good balance, English only'
  },
  'base': {
    id: 'Xenova/whisper-base',
    name: 'Base (Multilingual)',
    size: '~145MB',
    description: 'Good balance, 99 languages'
  },
  'small.en': {
    id: 'Xenova/whisper-small.en',
    name: 'Small (English)',
    size: '~465MB',
    description: 'Better accuracy, English only'
  },
  'small': {
    id: 'Xenova/whisper-small',
    name: 'Small (Multilingual)',
    size: '~465MB',
    description: 'Better accuracy, 99 languages'
  }
} as const

export type WhisperModelKey = keyof typeof WHISPER_MODELS

export interface TranscriptionResult {
  text: string
  chunks?: Array<{
    timestamp: [number, number]
    text: string
  }>
}

export interface WhisperStatus {
  isReady: boolean
  isLoading: boolean
  currentModel: WhisperModelKey | null
  error: string | null
  progress: number
}

// Singleton transcriber instance
let transcriber: Awaited<ReturnType<typeof import('@huggingface/transformers').pipeline>> | null = null
let currentModelKey: WhisperModelKey | null = null
let isLoading = false
let loadError: string | null = null
let loadProgress = 0

/**
 * Get the models cache directory
 */
function getModelsDir(): string {
  return join(getAppDataDir(), 'models', 'whisper')
}

/**
 * Try to load a module from the user-installed deps directory
 */
function tryLoadFromUserDeps<T>(moduleName: string): T | null {
  const depsDir = getWhisperDepsDir()
  const nodeModules = join(depsDir, 'node_modules')

  if (!existsSync(nodeModules)) {
    return null
  }

  try {
    // Create a require function that resolves from our custom node_modules
    const customRequire = createRequire(join(nodeModules, 'package.json'))
    return customRequire(moduleName) as T
  } catch (error) {
    console.log(`[Whisper] Could not load ${moduleName} from user deps:`, error)
    return null
  }
}

/**
 * Check if Whisper modules are available (from bundle or user-installed)
 */
export async function isWhisperAvailable(): Promise<boolean> {
  if (modulesAvailable !== null) {
    return modulesAvailable
  }

  // Try loading from bundled modules first
  try {
    await import('@huggingface/transformers')
    await import('wavefile')
    modulesAvailable = true
    console.log('[Whisper] Using bundled dependencies')
    return true
  } catch {
    // Bundled modules not available, try user-installed
  }

  // Try loading from user-installed deps
  const transformers = tryLoadFromUserDeps('@huggingface/transformers')
  const wavefile = tryLoadFromUserDeps('wavefile')

  if (transformers && wavefile) {
    modulesAvailable = true
    console.log('[Whisper] Using user-installed dependencies from:', getWhisperDepsDir())
    return true
  }

  modulesAvailable = false
  console.log('[Whisper] Dependencies not available - Whisper features disabled')
  return false
}

/**
 * Initialize the dynamic imports for ESM modules
 */
async function initModules(): Promise<void> {
  if (!(await isWhisperAvailable())) {
    throw new Error('Whisper dependencies not installed. Run ensureWhisperDeps() first.')
  }

  if (!pipeline) {
    // Try bundled first
    try {
      const transformers = await import('@huggingface/transformers')
      pipeline = transformers.pipeline
    } catch {
      // Fall back to user-installed
      const transformers = tryLoadFromUserDeps<typeof import('@huggingface/transformers')>('@huggingface/transformers')
      if (transformers) {
        pipeline = transformers.pipeline
      } else {
        throw new Error('Failed to load @huggingface/transformers')
      }
    }
  }

  if (!WaveFile) {
    // Try bundled first
    try {
      const wavefile = await import('wavefile')
      WaveFile = (wavefile as { default: { WaveFile: typeof import('wavefile').WaveFile } }).default.WaveFile
    } catch {
      // Fall back to user-installed
      const wavefile = tryLoadFromUserDeps<{ WaveFile: typeof import('wavefile').WaveFile }>('wavefile')
      if (wavefile) {
        WaveFile = wavefile.WaveFile
      } else {
        throw new Error('Failed to load wavefile')
      }
    }
  }
}

/**
 * Get the current status of the Whisper service
 */
export function getWhisperStatus(): WhisperStatus {
  return {
    isReady: transcriber !== null,
    isLoading,
    currentModel: currentModelKey,
    error: loadError,
    progress: loadProgress
  }
}

/**
 * Load a Whisper model for transcription
 * Downloads the model if not cached locally
 */
export async function loadWhisperModel(
  modelKey: WhisperModelKey = 'tiny.en',
  onProgress?: (progress: number) => void
): Promise<void> {
  // Don't reload if already loaded
  if (transcriber && currentModelKey === modelKey) {
    return
  }

  // Don't start loading if already loading
  if (isLoading) {
    throw new Error('Model is already loading')
  }

  isLoading = true
  loadError = null
  loadProgress = 0

  try {
    await initModules()

    if (!pipeline) {
      throw new Error('Failed to load transformers module')
    }

    const modelInfo = WHISPER_MODELS[modelKey]
    if (!modelInfo) {
      throw new Error(`Unknown model: ${modelKey}`)
    }

    // Ensure models directory exists
    const modelsDir = getModelsDir()
    if (!existsSync(modelsDir)) {
      await mkdir(modelsDir, { recursive: true })
    }

    // Load the model with caching
    transcriber = await pipeline('automatic-speech-recognition', modelInfo.id, {
      cache_dir: modelsDir,
      progress_callback: (progress: unknown) => {
        // Handle different progress event types from transformers.js
        const progressInfo = progress as { progress?: number; status?: string }
        if (typeof progressInfo.progress === 'number') {
          loadProgress = progressInfo.progress
          onProgress?.(progressInfo.progress)
        }
      }
    })

    currentModelKey = modelKey
    loadProgress = 100
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Failed to load model'
    transcriber = null
    currentModelKey = null
    throw error
  } finally {
    isLoading = false
  }
}

/**
 * Unload the current model to free memory
 */
export function unloadWhisperModel(): void {
  transcriber = null
  currentModelKey = null
  loadProgress = 0
}

/**
 * Convert audio buffer to Float32Array at 16kHz for Whisper
 */
async function processAudioBuffer(audioBuffer: ArrayBuffer): Promise<Float32Array> {
  if (!WaveFile) {
    await initModules()
  }

  if (!WaveFile) {
    throw new Error('Failed to load wavefile module')
  }

  const wav = new WaveFile(new Uint8Array(audioBuffer))

  // Convert to 32-bit float
  wav.toBitDepth('32f')

  // Resample to 16kHz (Whisper requirement)
  wav.toSampleRate(16000)

  // Get samples
  const samples = wav.getSamples()

  // Handle stereo by taking first channel
  let audioData: Float64Array | Float32Array
  if (Array.isArray(samples)) {
    audioData = samples[0] as Float64Array
  } else {
    audioData = samples as Float64Array
  }

  // Convert Float64Array to Float32Array if necessary
  if (audioData instanceof Float64Array) {
    const float32 = new Float32Array(audioData.length)
    for (let i = 0; i < audioData.length; i++) {
      float32[i] = audioData[i]
    }
    return float32
  }

  return audioData as Float32Array
}

/**
 * Transcribe audio from a WAV buffer
 */
export async function transcribeAudio(
  audioBuffer: ArrayBuffer,
  options: {
    language?: string
    returnTimestamps?: boolean
  } = {}
): Promise<TranscriptionResult> {
  if (!transcriber) {
    throw new Error('Model not loaded. Call loadWhisperModel first.')
  }

  try {
    // Process the audio
    const audioData = await processAudioBuffer(audioBuffer)

    // Log audio duration for debugging
    const durationSeconds = audioData.length / 16000
    console.log(`[Whisper] Transcribing audio: ${durationSeconds.toFixed(2)}s (${audioData.length} samples)`)

    // Run transcription with chunk_length_s to handle longer audio
    // chunk_length_s: 30 means the model will process audio in 30-second chunks
    // This prevents truncation of longer recordings
    const result = await transcriber(audioData, {
      language: options.language,
      return_timestamps: options.returnTimestamps,
      chunk_length_s: 30,
      stride_length_s: 5
    }) as { text: string; chunks?: Array<{ timestamp: [number, number]; text: string }> }

    console.log(`[Whisper] Transcription complete: ${result.text.length} characters`)

    return {
      text: result.text.trim(),
      chunks: result.chunks
    }
  } catch (error) {
    throw new Error(
      `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Transcribe audio from a file path
 */
export async function transcribeFile(
  filePath: string,
  options: {
    language?: string
    returnTimestamps?: boolean
  } = {}
): Promise<TranscriptionResult> {
  const { readFile } = await import('fs/promises')
  const audioBuffer = await readFile(filePath)
  return transcribeAudio(audioBuffer.buffer, options)
}

/**
 * Save audio buffer to a temporary WAV file and return the path
 */
export async function saveTempAudio(audioBuffer: ArrayBuffer): Promise<string> {
  const tempDir = join(getAppDataDir(), 'temp')
  if (!existsSync(tempDir)) {
    await mkdir(tempDir, { recursive: true })
  }

  const tempPath = join(tempDir, `recording-${Date.now()}.wav`)
  await writeFile(tempPath, Buffer.from(audioBuffer))
  return tempPath
}

/**
 * Clean up a temporary audio file
 */
export async function cleanupTempAudio(filePath: string): Promise<void> {
  try {
    await unlink(filePath)
  } catch {
    // Ignore errors - file might already be deleted
  }
}
