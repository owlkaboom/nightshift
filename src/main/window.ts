import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null

export function createWindow(): BrowserWindow {
  // Only set icon in dev mode - production uses app bundle icon
  const iconPath = is.dev ? join(__dirname, '../../build/icon.png') : undefined

  // Use platform-specific title bar styles
  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    title: 'Nightshift',
    width: 1400,
    height: 900,
    minWidth: 640, // Allow narrower windows for side-by-side layouts
    minHeight: 480, // Maintain usable height
    show: false,
    autoHideMenuBar: true,
    // Use hiddenInset on macOS for custom title bar, default on Windows/Linux for native title bar
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    // Traffic light positioning only needed on macOS
    ...(isMac && { trafficLightPosition: { x: 15, y: 15 } }),
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
