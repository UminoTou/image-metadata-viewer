import { useState, useCallback } from 'react'
import type { ImageMetadata } from '../types/metadata'

interface AnalyzeResult {
  success: boolean
  data?: ImageMetadata
  error?: string
}

interface UseMetadataReturn {
  metadata: ImageMetadata | null
  isLoading: boolean
  error: string | null
  analyzeFile: (filePath: string) => Promise<void>
  reset: () => void
}

function useMetadata(): UseMetadataReturn {
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyzeFile = useCallback(async (filePath: string) => {
    setIsLoading(true)
    setError(null)
    setMetadata(null)

    try {
      const result: AnalyzeResult = await window.electronAPI.analyzeImage(filePath)
      if (result.success && result.data) {
        setMetadata(result.data)
      } else {
        setError(result.error ?? '未知错误')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`分析失败: ${message}`)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setMetadata(null)
    setError(null)
  }, [])

  return { metadata, isLoading, error, analyzeFile, reset }
}

export default useMetadata
