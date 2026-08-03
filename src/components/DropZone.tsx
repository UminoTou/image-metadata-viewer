import { useState, useCallback, useEffect, type DragEvent } from 'react'

interface DropZoneProps {
  onFile: (filePath: string) => void
  filePath: string | null
  isLoading: boolean
  onReset: () => void
}

function DropZone({ onFile, filePath, isLoading, onReset }: DropZoneProps): JSX.Element {
  const [isDragging, setIsDragging] = useState(false)

  const handleClick = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/bmp,image/tiff,image/x-icon,image/avif,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tiff,.tif,.ico,.avif'
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0] as (File & { path?: string }) | undefined
      if (file?.path) {
        onFile(file.path)
      }
    }
    input.click()
  }, [onFile])

  // Listen for file drops via Electron's native file drop
  useEffect(() => {
    const handleDragOver = (e: globalThis.DragEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
    }

    const handleDragLeave = (e: globalThis.DragEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
    }

    const handleDrop = (e: globalThis.DragEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        const file = files[0]
        const path = (file as File & { path?: string }).path
        if (path) {
          onFile(path)
        }
      }
    }

    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDrop)

    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('drop', handleDrop)
    }
  }, [onFile])

  return (
    <div
      className={`dropzone ${isDragging ? 'dropzone--active' : ''} ${filePath ? 'dropzone--loaded' : ''}`}
      onClick={!filePath ? handleClick : undefined}
    >
      {isLoading ? (
        <div className="dropzone-content">
          <div className="spinner" />
          <span>正在分析...</span>
        </div>
      ) : filePath ? (
        <div className="dropzone-content">
          <span className="dropzone-filename">{filePath.split('\\').pop()?.split('/').pop()}</span>
          <button
            className="btn btn-sm"
            onClick={(e) => {
              e.stopPropagation()
              onReset()
              handleClick()
            }}
          >
            更换文件
          </button>
        </div>
      ) : (
        <div className="dropzone-content">
          <div className="dropzone-icon">📁</div>
          <p>拖放图片到此处</p>
          <p className="dropzone-hint">或点击浏览选择文件</p>
          <p className="dropzone-formats">
            支持 PNG / JPEG / GIF / WebP / BMP / TIFF / ICO / AVIF
          </p>
        </div>
      )}
    </div>
  )
}

export default DropZone
