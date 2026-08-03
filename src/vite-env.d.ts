/// <reference types="vite/client" />

import type { AnalyzeResult } from '../electron/preload'

declare global {
  interface Window {
    electronAPI: {
      analyzeImage: (filePath: string) => Promise<AnalyzeResult>
    }
  }
}
