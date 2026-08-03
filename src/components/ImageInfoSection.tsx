import type { ImageInfo } from '../types/metadata'

interface ImageInfoSectionProps {
  image: ImageInfo
}

function ImageInfoSection({ image }: ImageInfoSectionProps): JSX.Element {
  const rows: [string, string | number][] = [
    ['image_width', image.image_width],
    ['image_height', image.image_height],
    ['image_size', image.image_size],
    ['megapixels', `${image.megapixels} MP`],
    ['bit_depth', image.bit_depth],
    ['color_type', image.color_type],
  ]

  if (image.compression) {
    rows.push(['compression', image.compression])
  }
  if (image.filter) {
    rows.push(['filter', image.filter])
  }
  if (image.interlace) {
    rows.push(['interlace', image.interlace])
  }
  if (image.frame_count !== null) {
    rows.push(['frame_count', image.frame_count])
  }

  return (
    <div className="section-card">
      <h3>🖼️ 图片信息</h3>
      <div className="metadata-table">
        {rows.map(([label, value]) => (
          <div key={label} className="metadata-row">
            <div className="metadata-label">{label}</div>
            <div className="metadata-value">{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ImageInfoSection
