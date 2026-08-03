import { useState } from 'react'
import type { FileInfo } from '../types/metadata'

interface FileInfoSectionProps {
  file: FileInfo
}

function FileInfoSection({ file }: FileInfoSectionProps): JSX.Element {
  const [checksumCopied, setChecksumCopied] = useState(false)

  const copyChecksum = (): void => {
    navigator.clipboard.writeText(file.md5_checksum)
    setChecksumCopied(true)
    setTimeout(() => setChecksumCopied(false), 2000)
  }

  const rows: [string, string, boolean?][] = [
    ['checksum', file.md5_checksum, true],
    ['file_name', file.file_name],
    ['file_size', file.file_size_formatted],
    ['file_type', file.file_type],
    ['file_type_extension', file.file_type_extension],
    ['mime_type', file.mime_type]
  ]

  return (
    <div className="section-card">
      <h3>📄 文件信息</h3>
      <div className="metadata-table">
        {rows.map(([label, value, isChecksum]) => (
          <div key={label} className="metadata-row">
            <div className="metadata-label">{label}</div>
            <div className="metadata-value">
              {value}
              {isChecksum && (
                <button className="btn-copy" onClick={copyChecksum} title="复制">
                  {checksumCopied ? '✅' : '📋'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default FileInfoSection
