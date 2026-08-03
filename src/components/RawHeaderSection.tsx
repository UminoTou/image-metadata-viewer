interface RawHeaderSectionProps {
  rawHeader: string
}

function RawHeaderSection({ rawHeader }: RawHeaderSectionProps): JSX.Element {
  return (
    <div className="section-card">
      <h3>🔢 原始文件头 (前 128 字节)</h3>
      <pre className="raw-header">{rawHeader}</pre>
    </div>
  )
}

export default RawHeaderSection
