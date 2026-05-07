import { app, BrowserWindow, ipcMain, dialog, session, Menu } from 'electron'
import { join, extname } from 'path'
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { execFileSync } from 'child_process'
import type {
  AppProfile,
  AssetEffectFoldersResult,
  SaveProfileResult,
  LoadProfileResult,
  OpenFolderResult,
  OpenTextFileResult,
  UiLanguage,
} from '../shared/types'

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

const DIALOG_TEXT = {
  ja: {
    imageFolderTitle: '画像フォルダを選択',
    imageFileFilter: '画像ファイル',
    assetImageTitle: 'アセット画像を選択（透過PNG推奨）',
    assetFolderTitle: 'アセットフォルダを選択',
    overlayImageTitle: '直前オーバレイ画像を選択',
    saveProfileTitle: 'プロファイルを保存',
    loadProfileTitle: 'プロファイルを読み込む',
    textFileTitle: 'テキストファイルを選択',
    textFileFilter: 'テキストファイル',
  },
  en: {
    imageFolderTitle: 'Select Image Folder',
    imageFileFilter: 'Image Files',
    assetImageTitle: 'Select Asset Image (transparent PNG recommended)',
    assetFolderTitle: 'Select Asset Folder',
    overlayImageTitle: 'Select Pre-timer Overlay Image',
    saveProfileTitle: 'Save Profile',
    loadProfileTitle: 'Load Profile',
    textFileTitle: 'Select Text File',
    textFileFilter: 'Text Files',
  },
} satisfies Record<UiLanguage, Record<string, string>>

function getDialogText(language?: UiLanguage): typeof DIALOG_TEXT.ja {
  return DIALOG_TEXT[language === 'en' ? 'en' : 'ja']
}

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.includes(extname(filename).toLowerCase())
}

function readImagePaths(folderPath: string): string[] {
  return readdirSync(folderPath)
    .filter(isImageFile)
    .map(f => join(folderPath, f))
    .sort()
}

function getAssetEffectBasePath(): string | null {
  const candidates = [
    join(process.resourcesPath, 'asset-effect'),
    join(app.getAppPath(), 'assets', 'asset-effect'),
    join(process.cwd(), 'assets', 'asset-effect'),
  ]
  return candidates.find(candidate =>
    existsSync(candidate) && statSync(candidate).isDirectory()
  ) ?? null
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
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,  // ローカル画像ファイルのアクセスに必要
    }
  })

  win.setMenuBarVisibility(false)

  // 開発時
  if (process.env.NODE_ENV === 'development' || process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']!)
    if (process.env.WHITEROOM_OPEN_DEVTOOLS === '1') {
      win.webContents.openDevTools({ mode: 'detach' })
    }
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
    const images = readImagePaths(folderPath)
    return { canceled: false, folderPath, images }
  } catch {
    return { canceled: true }
  }
})

// フォルダ選択ダイアログ
ipcMain.handle('open-folder', async (_event, language?: UiLanguage): Promise<OpenFolderResult> => {
  const text = getDialogText(language)
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: text.imageFolderTitle
  })
  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true }
  }
  const folderPath = result.filePaths[0]
  const images = readImagePaths(folderPath)
  return { canceled: false, folderPath, images }
})

// アセット画像選択
ipcMain.handle('open-asset', async (_event, language?: UiLanguage) => {
  const text = getDialogText(language)
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: text.imageFileFilter, extensions: ['png', 'webp', 'gif'] }],
    title: text.assetImageTitle
  })
  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true }
  }
  return { canceled: false, filePath: result.filePaths[0] }
})

// 直前オーバレイ画像選択
ipcMain.handle('open-overlay-image', async (_event, language?: UiLanguage) => {
  const text = getDialogText(language)
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: text.imageFileFilter, extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] }],
    title: text.overlayImageTitle
  })
  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true }
  }
  return { canceled: false, filePath: result.filePaths[0] }
})

ipcMain.handle('open-asset-folder', async (_event, language?: UiLanguage) => {
  const text = getDialogText(language)
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: text.assetFolderTitle
  })
  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true }
  }
  const folderPath = result.filePaths[0]
  const images = readImagePaths(folderPath)
  return { canceled: false, folderPath, images }
})

ipcMain.handle('list-asset-effect-folders', async (): Promise<AssetEffectFoldersResult> => {
  try {
    const basePath = getAssetEffectBasePath()
    if (!basePath) return { folders: [] }

    const folders = readdirSync(basePath, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => {
        const folderPath = join(basePath, entry.name)
        return {
          name: entry.name,
          path: folderPath,
          images: readImagePaths(folderPath),
        }
      })
      .filter(folder => folder.images.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

    return { basePath, folders }
  } catch {
    return { folders: [] }
  }
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
ipcMain.handle('save-profile', async (_event, profile: AppProfile, language?: UiLanguage): Promise<SaveProfileResult> => {
  const text = getDialogText(language)
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'WhiteRoom Profile', extensions: ['json'] }],
    defaultPath: `${profile.name || 'profile'}.json`,
    title: text.saveProfileTitle
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
ipcMain.handle('load-profile', async (_event, language?: UiLanguage): Promise<LoadProfileResult> => {
  const text = getDialogText(language)
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'WhiteRoom Profile', extensions: ['json'] }],
    properties: ['openFile'],
    title: text.loadProfileTitle
  })
  if (result.canceled || !result.filePaths[0]) {
    return { success: false }
  }
  try {
    const filePath = result.filePaths[0]
    const raw = readFileSync(filePath, 'utf-8')
    const profile = JSON.parse(raw) as AppProfile
    return { success: true, profile, filePath }
  } catch (e: unknown) {
    return { success: false, error: String(e) }
  }
})

// フルスクリーン制御
ipcMain.handle('set-fullscreen', (_event, flag: boolean) => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.setFullScreen(flag)
})

ipcMain.handle('open-devtools', async () => {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (win) win.webContents.openDevTools({ mode: 'detach' })
})

ipcMain.handle('list-system-fonts', async (): Promise<string[]> => {
  return listSystemFonts()
})

// テキストファイル選択＆読み込み
ipcMain.handle('open-text-file', async (_event, language?: UiLanguage): Promise<OpenTextFileResult> => {
  const text = getDialogText(language)
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: text.textFileFilter, extensions: ['txt'] }],
    title: text.textFileTitle,
  })
  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true }
  }
  const filePath = result.filePaths[0]
  try {
    const buf = readFileSync(filePath)
    // UTF-8 BOM 除去
    let fileText = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF
      ? buf.slice(3).toString('utf-8')
      : buf.toString('utf-8')
    return { canceled: false, filePath, text: fileText }
  } catch {
    return { canceled: true }
  }
})

// ===== アプリ起動 =====

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)

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
