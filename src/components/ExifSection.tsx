import { useState } from 'react'
import type { ExifEntry } from '../types/metadata'

interface ExifSectionProps {
  exif: ExifEntry[]
}

function ExifSection({ exif }: ExifSectionProps): JSX.Element {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<'tag_name' | 'value'>('tag_name')
  const [sortAsc, setSortAsc] = useState(true)

  const filtered = exif
    .filter(e => {
      if (!search) return true
      const s = search.toLowerCase()
      return e.tag_name.toLowerCase().includes(s) || e.value.toLowerCase().includes(s)
    })
    .sort((a, b) => {
      const cmp = a[sortKey].localeCompare(b[sortKey])
      return sortAsc ? cmp : -cmp
    })

  const toggleSort = (key: 'tag_name' | 'value'): void => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  return (
    <div className="section-card">
      <h3>📸 EXIF 数据 ({exif.length} 项)</h3>
      <div className="exif-controls">
        <input
          type="text"
          className="search-input"
          placeholder="搜索 EXIF 标签..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="exif-table-wrap">
        <table className="exif-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('tag_name')} className="sortable">
                标签 {sortKey === 'tag_name' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => toggleSort('value')} className="sortable">
                值 {sortKey === 'value' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry, i) => (
              <tr key={i}>
                <td className="exif-tag">{entry.tag_name}</td>
                <td className="exif-value">{entry.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="empty-text">无匹配的 EXIF 条目</p>
        )}
      </div>
    </div>
  )
}

export default ExifSection
