import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcApi } from '../shared/types'

const api: IpcApi = {
  openFolder: (language) => ipcRenderer.invoke('open-folder', language),
  readFolderPath: (folderPath) => ipcRenderer.invoke('read-folder-path', folderPath),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  openAsset: (language) => ipcRenderer.invoke('open-asset', language),
  openAssetFolder: (language) => ipcRenderer.invoke('open-asset-folder', language),
  readImageAsBase64: (filePath) => ipcRenderer.invoke('read-image-base64', filePath),
  saveProfile: (profile, language) => ipcRenderer.invoke('save-profile', profile, language),
  loadProfile: (language) => ipcRenderer.invoke('load-profile', language),
  setFullscreen: (flag) => ipcRenderer.invoke('set-fullscreen', flag),
  listSystemFonts: () => ipcRenderer.invoke('list-system-fonts'),
  onFullscreenChange: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, isFullscreen: boolean) => cb(isFullscreen)
    ipcRenderer.on('fullscreen-change', handler)
    return () => ipcRenderer.off('fullscreen-change', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
