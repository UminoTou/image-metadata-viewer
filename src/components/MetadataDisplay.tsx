import type { ImageMetadata } from '../types/metadata'
import FileInfoSection from './FileInfoSection'
import ImageInfoSection from './ImageInfoSection'
import PngChunksSection from './PngChunksSection'
import ExifSection from './ExifSection'
import RawHeaderSection from './RawHeaderSection'
import AiGenerationSection from './AiGenerationSection'

interface MetadataDisplayProps {
  metadata: ImageMetadata
}

function MetadataDisplay({ metadata }: MetadataDisplayProps): JSX.Element {
  return (
    <div className="metadata-display">
      <h2 className="section-title">📋 元数据信息</h2>

      {metadata.ai && (
        <AiGenerationSection ai={metadata.ai} />
      )}

      <FileInfoSection file={metadata.file} />
      <ImageInfoSection image={metadata.image} />

      {metadata.png_chunks && (
        <PngChunksSection chunks={metadata.png_chunks} />
      )}

      {metadata.exif && metadata.exif.length > 0 && (
        <ExifSection exif={metadata.exif} />
      )}

      {metadata.raw_header && (
        <RawHeaderSection rawHeader={metadata.raw_header} />
      )}
    </div>
  )
}

export default MetadataDisplay
