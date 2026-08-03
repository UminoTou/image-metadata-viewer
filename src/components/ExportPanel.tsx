import { useState } from 'react'
import type { ImageMetadata } from '../types/metadata'
import { exportAsJSON, exportAsCSV, exportAsTXT, exportAsHTML, exportAsPDF } from '../utils/export'

interface ExportPanelProps {
  metadata: ImageMetadata
}

function ExportPanel({ metadata }: ExportPanelProps): JSX.Element {
  const [pdfLoading, setPdfLoading] = useState(false)

  const handlePdf = async (): Promise<void> => {
    setPdfLoading(true)
    try {
      await exportAsPDF(metadata)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setPdfLoading(false)
    }
  }

  const buttons = [
    { label: 'JSON', onClick: () => exportAsJSON(metadata), className: 'btn-json' },
    { label: 'CSV', onClick: () => exportAsCSV(metadata), className: 'btn-csv' },
    { label: 'TXT', onClick: () => exportAsTXT(metadata), className: 'btn-txt' },
    { label: 'HTML', onClick: () => exportAsHTML(metadata), className: 'btn-html' },
    { label: pdfLoading ? '生成中...' : 'PDF', onClick: handlePdf, className: 'btn-pdf', disabled: pdfLoading },
  ]

  return (
    <div className="export-panel">
      <span className="export-label">导出为:</span>
      {buttons.map(btn => (
        <button
          key={btn.label}
          className={`btn btn-export ${btn.className}`}
          onClick={btn.onClick}
          disabled={btn.disabled}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}

export default ExportPanel
