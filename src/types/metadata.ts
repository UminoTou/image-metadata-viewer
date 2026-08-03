export interface ImageMetadata {
  file: FileInfo
  image: ImageInfo
  png_chunks: PngChunkData | null
  exif: ExifEntry[] | null
  raw_header: string | null
  ai: AiGenerationInfo | null
}

// AI Generation Metadata
export interface AiGenerationInfo {
  source: string           // e.g. "ComfyUI", "Stable Diffusion WebUI", "NovelAI"
  positive_prompt: string | null
  negative_prompt: string | null
  seed: number | null
  steps: number | null
  cfg_scale: number | null
  sampler: string | null
  scheduler: string | null
  width: number | null
  height: number | null
  model_name: string | null
  model_hash: string | null
  vae_name: string | null
  clip_name: string | null
  loras: LoraInfo[]
  denoise: number | null
  batch_size: number | null
  raw_params: string | null  // raw parameters text for reference
}

export interface LoraInfo {
  name: string
  strength: number | null
}

export interface FileInfo {
  file_name: string
  file_path: string
  file_size: number
  file_size_formatted: string
  md5_checksum: string
  mime_type: string
  file_type: string
  file_type_extension: string
}

export interface ImageInfo {
  image_width: number
  image_height: number
  megapixels: number
  bit_depth: number
  color_type: string
  has_alpha: boolean
  compression: string | null
  filter: string | null
  interlace: string | null
  format_name: string
  image_size: string
  frame_count: number | null
}

export interface PngChunkData {
  t_ext_chunks: TextChunk[]
  ztxt_chunks: ZtxtChunk[]
  itxt_chunks: ITextChunk[]
}

export interface TextChunk {
  keyword: string
  text: string
  is_json: boolean
}

export interface ZtxtChunk {
  keyword: string
  text: string
  is_json: boolean
}

export interface ITextChunk {
  keyword: string
  text: string
  language_tag: string | null
  translated_keyword: string | null
  is_compressed: boolean
  is_json: boolean
}

export interface ExifEntry {
  tag_name: string
  tag_id: string
  value: string
}
