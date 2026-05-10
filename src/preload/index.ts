import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcApi } from '../shared/types'

const api: IpcApi = {
  openFolder: (language) => ipcRenderer.invoke('open-folder', language),
  readFolderPath: (folderPath) => ipcRenderer.invoke('read-folder-path', folderPath),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  openAsset: (language) => ipcRenderer.invoke('open-asset', language),
  openOverlayImage: (language) => ipcRenderer.invoke('open-overlay-image', language),
  openAssetFolder: (language) => ipcRenderer.invoke('open-asset-folder', language),
  listAssetEffectFolders: () => ipcRenderer.invoke('list-asset-effect-folders'),
  readImageAsBase64: (filePath) => ipcRenderer.invoke('read-image-base64', filePath),
  saveProfile: (profile, language) => ipcRenderer.invoke('save-profile', profile, language),
  loadProfile: (language) => ipcRenderer.invoke('load-profile', language),
  setFullscreen: (flag) => ipcRenderer.invoke('set-fullscreen', flag),
  resetWindowSize: () => ipcRenderer.invoke('reset-window-size'),
  getWindowSize: () => ipcRenderer.invoke('get-window-size'),
  setWindowSize: (width, height) => ipcRenderer.invoke('set-window-size', width, height),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openDevTools: () => ipcRenderer.invoke('open-devtools'),
  listSystemFonts: () => ipcRenderer.invoke('list-system-fonts'),
  openTextFile: (language) => ipcRenderer.invoke('open-text-file', language),
  saveTextFile: (filePath, content) => ipcRenderer.invoke('save-text-file', filePath, content),
  loadImageEffectProfile: (folderPath) => ipcRenderer.invoke('load-image-effect-profile', folderPath),
  saveImageEffectProfile: (folderPath, imagePath, effects, timer) =>
    ipcRenderer.invoke('save-image-effect-profile', folderPath, imagePath, effects, timer),
  cleanupTextReaderTempFile: (tempFilePath) => ipcRenderer.invoke('cleanup-text-reader-temp-file', tempFilePath),
  loadRemoteImageAsDataUrl: (url) => ipcRenderer.invoke('load-remote-image-data-url', url),
  getRemoteImageStats: () => ipcRenderer.invoke('get-remote-image-stats'),
  onFullscreenChange: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, isFullscreen: boolean) => cb(isFullscreen)
    ipcRenderer.on('fullscreen-change', handler)
    return () => ipcRenderer.off('fullscreen-change', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
