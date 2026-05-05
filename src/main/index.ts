import { app, BrowserWindow, ipcMain, dialog, session } from 'electron'
import { join, extname } from 'path'
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { execFileSync } from 'child_process'
import type { AppProfile, SaveProfileResult, LoadProfileResult, OpenFolderResult } from '../shared/types'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif']
const FALLBACK_FONTS = [
  'Meiryo',
  'BIZ UDPGothic',
  'Yu Gothic',
  'MS PGothic',
  'Arial',
  'Segoe UI',
  'Times New Roman',
  'Courier New',
]

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.includes(extname(filename).toLowerCase())
}

function normalizeFontName(name: string): string[] {
  const withoutType = name.replace(/\s*\([^)]+\)\s*$/u, '').trim()
  if (!withoutType) return []
  return withoutType
    .split(/\s*&\s*/u)
    .map(part => part.trim())
    .filter(Boolean)
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

function listWindowsFonts(): string[] {
  const command = [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    '$OutputEncoding = [System.Text.Encoding]::UTF8',
    "$paths = @('HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts', 'HKCU:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts')",
    'foreach ($path in $paths) {',
    '  if (Test-Path $path) {',
    '    (Get-ItemProperty -Path $path).PSObject.Properties |',
    "      Where-Object { $_.Name -notlike 'PS*' } |",
    '      ForEach-Object { $_.Name }',
    '  }',
    '}',
  ].join('\n')

  const output = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 }
  )

  return output
    .split(/\r?\n/u)
    .flatMap(line => normalizeFontName(line))
}

function listUnixFonts(): string[] {
  const output = execFileSync('fc-list', [':', 'family'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
  return output
    .split(/\r?\n/u)
    .flatMap(line => line.split(','))
    .map(name => name.trim())
    .filter(Boolean)
}

function listSystemFonts(): string[] {
  try {
    const fonts = process.platform === 'win32' ? listWindowsFonts() : listUnixFonts()
    return sortedUnique([...FALLBACK_FONTS, ...fonts])
  } catch (error) {
    console.warn('Failed to list system fonts:', error)
    return sortedUnique(FALLBACK_FONTS)
  }
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    frame: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,  // ローカル画像ファイルのアクセスに必要
    }
  })

  // 開発時
  if (process.env.NODE_ENV === 'development' || process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']!)
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../../dist/renderer/index.html'))
  }

  // フルスクリーン変更を renderer に通知
  win.on('enter-full-screen', () => {
    win.webContents.send('fullscreen-change', true)
  })
  win.on('leave-full-screen', () => {
    win.webContents.send('fullscreen-change', false)
  })

  return win
}

// ===== IPC ハンドラ =====

// フォルダパスを直接渡して画像一覧を取得（D&D用）
ipcMain.handle('read-folder-path', async (_event, folderPath: string): Promise<OpenFolderResult> => {
  try {
    const images = readdirSync(folderPath)
      .filter(isImageFile)
      .map(f => join(folderPath, f))
      .sort()
    return { canceled: false, folderPath, images }
  } catch {
    return { canceled: true }
  }
})

// フォルダ選択ダイアログ
ipcMain.handle('open-folder', async (): Promise<OpenFolderResult> => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: '画像フォルダを選択'
  })
  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true }
  }
  const folderPath = result.filePaths[0]
  const images = readdirSync(folderPath)
    .filter(isImageFile)
    .map(f => join(folderPath, f))
    .sort()
  return { canceled: false, folderPath, images }
})

// アセット画像選択
ipcMain.handle('open-asset', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: '画像ファイル', extensions: ['png', 'webp', 'gif'] }],
    title: 'アセット画像を選択（透過PNG推奨）'
  })
  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true }
  }
  return { canceled: false, filePath: result.filePaths[0] }
})

ipcMain.handle('open-asset-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'アセットフォルダを選択'
  })
  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true }
  }
  const folderPath = result.filePaths[0]
  const images = readdirSync(folderPath)
    .filter(isImageFile)
    .map(f => join(folderPath, f))
    .sort()
  return { canceled: false, folderPath, images }
})

// 画像をBase64で読み込み
ipcMain.handle('read-image-base64', async (_event, filePath: string): Promise<string> => {
  try {
    const data = readFileSync(filePath)
    const ext = extname(filePath).toLowerCase().replace('.', '')
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'png' ? 'image/png'
      : ext === 'gif' ? 'image/gif'
      : ext === 'webp' ? 'image/webp'
      : 'image/jpeg'
    return `data:${mime};base64,${data.toString('base64')}`
  } catch {
    return ''
  }
})

// プロファイル保存
ipcMain.handle('save-profile', async (_event, profile: AppProfile): Promise<SaveProfileResult> => {
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'WhiteRoom Profile', extensions: ['json'] }],
    defaultPath: `${profile.name || 'profile'}.json`,
    title: 'プロファイルを保存'
  })
  if (result.canceled || !result.filePath) {
    return { success: false }
  }
  try {
    writeFileSync(result.filePath, JSON.stringify(profile, null, 2), 'utf-8')
    return { success: true, filePath: result.filePath }
  } catch (e: unknown) {
    return { success: false, error: String(e) }
  }
})

// プロファイル読み込み
ipcMain.handle('load-profile', async (): Promise<LoadProfileResult> => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'WhiteRoom Profile', extensions: ['json'] }],
    properties: ['openFile'],
    title: 'プロファイルを読み込む'
  })
  if (result.canceled || !result.filePaths[0]) {
    return { success: false }
  }
  try {
    const raw = readFileSync(result.filePaths[0], 'utf-8')
    const profile = JSON.parse(raw) as AppProfile
    return { success: true, profile }
  } catch (e: unknown) {
    return { success: false, error: String(e) }
  }
})

// フルスクリーン制御
ipcMain.handle('set-fullscreen', (_event, flag: boolean) => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.setFullScreen(flag)
})

ipcMain.handle('list-system-fonts', async (): Promise<string[]> => {
  return listSystemFonts()
})

// ===== アプリ起動 =====

app.whenReady().then(() => {
  // ローカルファイルプロトコル許可
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' data: file: blob:; worker-src blob:"]
      }
    })
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
