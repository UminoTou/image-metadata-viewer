import { useState } from 'react'
import type { PngChunkData, TextChunk, ZtxtChunk, ITextChunk } from '../types/metadata'
import { parseLooseJson } from '../utils/loose-json'

interface PngChunksSectionProps {
  chunks: PngChunkData
}

function JsonTreeView({ data }: { data: unknown }): JSX.Element {
  if (data === null || data === undefined) return <span className="json-null">null</span>
  if (typeof data === 'boolean') return <span className="json-boolean">{String(data)}</span>
  if (typeof data === 'number') return <span className="json-number">{data}</span>
  if (typeof data === 'string') {
    if (data.length > 200) {
      return (
        <details className="json-details">
          <summary className="json-summary">"{data.substring(0, 100)}..."</summary>
          <pre className="json-pre">{data}</pre>
        </details>
      )
    }
    return <span className="json-string">"{data}"</span>
  }

  if (Array.isArray(data)) {
    return (
      <details className="json-details" open={data.length <= 3}>
        <summary className="json-summary">Array [{data.length}]</summary>
        <ul className="json-list">
          {data.map((item, i) => (
            <li key={i} className="json-item">
              <span className="json-index">{i}: </span>
              <JsonTreeView data={item} />
            </li>
          ))}
        </ul>
      </details>
    )
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    return (
      <details className="json-details" open={entries.length <= 5}>
        <summary className="json-summary">Object {'{'}{entries.length} keys{'}'}</summary>
        <ul className="json-list">
          {entries.map(([key, value]) => (
            <li key={key} className="json-item">
              <span className="json-key">"{key}": </span>
              <JsonTreeView data={value} />
            </li>
          ))}
        </ul>
      </details>
    )
  }

  return <span>{String(data)}</span>
}

function ChunkRow({ keyword, text, isJson }: { keyword: string; text: string; isJson: boolean }): JSX.Element {

  if (isJson) {
    // 用宽松解析：ComfyUI 的 prompt 块里可能出现 NaN / Infinity 这类非标准字面量
    const parsed = parseLooseJson(text)
    if (parsed === null) {
      return <pre className="chunk-text">{text}</pre>
    }
    return (
      <div className="chunk-row">
        <div className="chunk-keyword">{keyword}</div>
        <div className="chunk-json">
          <JsonTreeView data={parsed} />
        </div>
      </div>
    )
  }

  return (
    <div className="chunk-row">
      <div className="chunk-keyword">{keyword}</div>
      <pre className="chunk-text">{text.length > 1000 ? text.substring(0, 1000) + '\n... (truncated)' : text}</pre>
    </div>
  )
}

function PngChunksSection({ chunks }: PngChunksSectionProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<'tEXt' | 'zTXt' | 'iTXt'>(() => {
    if (chunks.t_ext_chunks.length > 0) return 'tEXt'
    if (chunks.ztxt_chunks.length > 0) return 'zTXt'
    return 'iTXt'
  })

  const tabs: { key: 'tEXt' | 'zTXt' | 'iTXt'; label: string; count: number }[] = [
    { key: 'tEXt', label: 'tEXt (文本)', count: chunks.t_ext_chunks.length },
    { key: 'zTXt', label: 'zTXt (压缩文本)', count: chunks.ztxt_chunks.length },
    { key: 'iTXt', label: 'iTXt (UTF-8)', count: chunks.itxt_chunks.length },
  ]

  return (
    <div className="section-card">
      <h3>📝 PNG 文本块</h3>
      <div className="tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div className="chunks-content">
        {activeTab === 'tEXt' && chunks.t_ext_chunks.length === 0 && (
          <p className="empty-text">无 tEXt 文本块</p>
        )}
        {activeTab === 'tEXt' && chunks.t_ext_chunks.map((chunk: TextChunk, i: number) => (
          <ChunkRow key={i} keyword={chunk.keyword} text={chunk.text} isJson={chunk.is_json} />
        ))}

        {activeTab === 'zTXt' && chunks.ztxt_chunks.length === 0 && (
          <p className="empty-text">无 zTXt 文本块</p>
        )}
        {activeTab === 'zTXt' && chunks.ztxt_chunks.map((chunk: ZtxtChunk, i: number) => (
          <ChunkRow key={i} keyword={chunk.keyword} text={chunk.text} isJson={chunk.is_json} />
        ))}

        {activeTab === 'iTXt' && chunks.itxt_chunks.length === 0 && (
          <p className="empty-text">无 iTXt 文本块</p>
        )}
        {activeTab === 'iTXt' && chunks.itxt_chunks.map((chunk: ITextChunk, i: number) => (
          <div key={i} className="chunk-row">
            <div className="chunk-keyword">{chunk.keyword}</div>
            {chunk.language_tag && <span className="chunk-meta">语言: {chunk.language_tag}</span>}
            {chunk.is_json && parseLooseJson(chunk.text) !== null ? (
              <div className="chunk-json">
                <JsonTreeView data={parseLooseJson(chunk.text)} />
              </div>
            ) : (
              <pre className="chunk-text">{chunk.text.length > 1000 ? chunk.text.substring(0, 1000) + '\n... (truncated)' : chunk.text}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default PngChunksSection
