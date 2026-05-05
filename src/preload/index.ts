import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from '../shared/types'

const api: IpcApi = {
  openFolder: () => ipcRenderer.invoke('open-folder'),
  readFolderPath: (folderPath) => ipcRenderer.invoke('read-folder-path', folderPath),
  openAsset: () => ipcRenderer.invoke('open-asset'),
  openAssetFolder: () => ipcRenderer.invoke('open-asset-folder'),
  readImageAsBase64: (filePath) => ipcRenderer.invoke('read-image-base64', filePath),
  saveProfile: (profile) => ipcRenderer.invoke('save-profile', profile),
  loadProfile: () => ipcRenderer.invoke('load-profile'),
  setFullscreen: (flag) => ipcRenderer.invoke('set-fullscreen', flag),
  listSystemFonts: () => ipcRenderer.invoke('list-system-fonts'),
  onFullscreenChange: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, isFullscreen: boolean) => cb(isFullscreen)
    ipcRenderer.on('fullscreen-change', handler)
    return () => ipcRenderer.off('fullscreen-change', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
