import { useState, useCallback } from 'react'
import DropZone from './components/DropZone'
import MetadataDisplay from './components/MetadataDisplay'
import ExportPanel from './components/ExportPanel'
import useMetadata from './hooks/useMetadata'

function App(): JSX.Element {
  const { metadata, isLoading, error, analyzeFile } = useMetadata()
  const [filePath, setFilePath] = useState<string | null>(null)

  const handleFile = useCallback(
    async (path: string) => {
      setFilePath(path)
      await analyzeFile(path)
    },
    [analyzeFile]
  )

  const handleReset = useCallback(() => {
    setFilePath(null)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>📷 Image Metadata Viewer</h1>
        <span className="app-subtitle">本地图片元数据查看器</span>
      </header>

      <DropZone
        onFile={handleFile}
        filePath={filePath}
        isLoading={isLoading}
        onReset={handleReset}
      />

      {error && <div className="error-banner">{error}</div>}

      {isLoading && (
        <div className="loading-container">
          <div className="spinner" />
          <span>正在分析图片...</span>
        </div>
      )}

      {metadata && !isLoading && (
        <>
          <MetadataDisplay metadata={metadata} />
          <ExportPanel metadata={metadata} />
        </>
      )}

      {!metadata && !isLoading && !error && (
        <div className="empty-hint">
          拖放图片到上方区域，或点击浏览选择文件开始分析
        </div>
      )}
    </div>
  )
}

export default App
