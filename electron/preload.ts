import { contextBridge, ipcRenderer } from 'electron'

export interface AnalyzeResult {
  success: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
  error?: string
}

const api = {
  analyzeImage: (filePath: string): Promise<AnalyzeResult> =>
    ipcRenderer.invoke('analyze-image', filePath)
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
