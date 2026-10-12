import { readFile } from 'fs/promises'
import { createHash } from 'crypto'
import { basename } from 'path'
import { imageSize } from 'image-size'
import exifr from 'exifr'
import { parseLooseJson, isLooseJson } from '../src/utils/loose-json'
import type { ImageMetadata, FileInfo, ImageInfo, PngChunkData, TextChunk, ZtxtChunk, ITextChunk, ExifEntry, AiGenerationInfo, LoraInfo } from '../src/types/metadata'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const MIME_MAP: Record<string, { mime: string; type: string }> = {
  png: { mime: 'image/png', type: 'PNG' },
  jpg: { mime: 'image/jpeg', type: 'JPEG' },
  jpeg: { mime: 'image/jpeg', type: 'JPEG' },
  gif: { mime: 'image/gif', type: 'GIF' },
  webp: { mime: 'image/webp', type: 'WebP' },
  bmp: { mime: 'image/bmp', type: 'BMP' },
  tiff: { mime: 'image/tiff', type: 'TIFF' },
  tif: { mime: 'image/tiff', type: 'TIFF' },
  ico: { mime: 'image/x-icon', type: 'ICO' },
  avif: { mime: 'image/avif', type: 'AVIF' },
  svg: { mime: 'image/svg+xml', type: 'SVG' },
  heif: { mime: 'image/heif', type: 'HEIF' },
  heic: { mime: 'image/heic', type: 'HEIC' },
}

function getMimeAndType(ext: string): { mime_type: string; file_type: string; file_type_extension: string } {
  const entry = MIME_MAP[ext.toLowerCase()]
  return {
    mime_type: entry?.mime ?? 'application/octet-stream',
    file_type: entry?.type ?? ext.toUpperCase(),
    file_type_extension: ext.toLowerCase()
  }
}

function getRawHeader(bytes: Buffer): string {
  const header = bytes.subarray(0, Math.min(bytes.length, 128))
  return Array.from(header)
    .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ')
}

// Parse PNG IHDR chunk for bit_depth, color_type, compression, filter, interlace
function parsePngIhdr(bytes: Buffer): {
  bitDepth: number; colorType: string; compression: string; filter: string; interlace: string
} | null {
  try {
    // PNG signature is 8 bytes, then chunks start
    // IHDR must be the first chunk
    if (bytes.length < 33) return null
    const length = bytes.readUInt32BE(8)
    const type = bytes.subarray(12, 16).toString('ascii')
    if (type !== 'IHDR' || length !== 13) return null

    const data = bytes.subarray(16, 29)
    const bitDepth = data[8]
    const colorTypeByte = data[9]
    const compressionByte = data[10]
    const filterByte = data[11]
    const interlaceByte = data[12]

    const colorTypes: Record<number, string> = {
      0: 'Grayscale',
      2: 'RGB',
      3: 'Indexed',
      4: 'Grayscale + Alpha',
      6: 'RGBA'
    }

    return {
      bitDepth,
      colorType: colorTypes[colorTypeByte] ?? `Unknown (${colorTypeByte})`,
      compression: compressionByte === 0 ? 'Deflate/Inflate' : `Unknown (${compressionByte})`,
      filter: filterByte === 0 ? 'Adaptive' : `Unknown (${filterByte})`,
      interlace: interlaceByte === 0 ? 'Noninterlaced' : interlaceByte === 1 ? 'Adam7' : `Unknown (${interlaceByte})`
    }
  } catch {
    return null
  }
}

// Parse JPEG SOF marker for bit depth and component info
function parseJpegSof(bytes: Buffer): { bitDepth: number; components: number } | null {
  try {
    let offset = 2 // skip SOI marker
    while (offset < bytes.length - 1) {
      if (bytes[offset] !== 0xFF) return null
      const marker = bytes[offset + 1]
      offset += 2
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        // SOF marker found
        const length = bytes.readUInt16BE(offset)
        const data = bytes.subarray(offset + 2, offset + length)
        return {
          bitDepth: data[0],
          components: data[1]
        }
      }
      if (marker === 0xD9) break // EOI
      if (marker === 0x01) continue // TEM
      if (offset + 2 > bytes.length) break
      const segLength = bytes.readUInt16BE(offset)
      offset += segLength
    }
    return null
  } catch {
    return null
  }
}

// Parse BMP header for bit depth and compression
function parseBmpInfo(bytes: Buffer): { bitDepth: number; compression: string } | null {
  try {
    if (bytes.toString('ascii', 0, 2) !== 'BM') return null
    const dibHeaderOffset = 14
    const dibSize = bytes.readUInt32LE(dibHeaderOffset)
    const bitDepth = bytes.readUInt16LE(dibHeaderOffset + 14) // biBitCount

    let compression = 'None'
    if (dibSize >= 40) {
      const comp = bytes.readUInt32LE(dibHeaderOffset + 16) // biCompression
      const compNames: Record<number, string> = {
        0: 'BI_RGB (None)',
        1: 'BI_RLE8',
        2: 'BI_RLE4',
        3: 'BI_BITFIELDS',
        4: 'BI_JPEG',
        5: 'BI_PNG'
      }
      compression = compNames[comp] ?? `Unknown (${comp})`
    }

    return { bitDepth, compression }
  } catch {
    return null
  }
}

function detectFileTypeFromBytes(bytes: Buffer): string {
  const head = bytes.subarray(0, 12)
  // Check PNG
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47) return 'PNG'
  // Check JPEG
  if (head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF) return 'JPEG'
  // Check GIF
  if (head.toString('ascii', 0, 3) === 'GIF') return 'GIF'
  // Check WebP
  if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
      head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) return 'WebP'
  // Check BMP
  if (head[0] === 0x42 && head[1] === 0x4D) return 'BMP'
  // Check TIFF
  if ((head[0] === 0x49 && head[1] === 0x49) || (head[0] === 0x4D && head[1] === 0x4D)) return 'TIFF'
  // Check ICO
  if (head[0] === 0x00 && head[1] === 0x00 && head[2] === 0x01 && head[3] === 0x00) return 'ICO'
  // Check AVIF (ftypavif or ftypavis)
  if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
    const brand = head.toString('ascii', 8, 12)
    if (brand === 'avif' || brand === 'avis') return 'AVIF'
    if (brand === 'heic' || brand === 'heix' || brand === 'hevc') return 'HEIF'
  }
  return 'Unknown'
}

// ── AI Generation Metadata Parser ──

function parseAiMetadata(chunks: PngChunkData | null, exif: ExifEntry[] | null): AiGenerationInfo | null {
  // Try ComfyUI format first (JSON prompt chunk)
  if (chunks) {
    const allTextChunks = [
      ...chunks.t_ext_chunks,
      ...chunks.ztxt_chunks,
      ...chunks.itxt_chunks.map(c => ({ keyword: c.keyword, text: c.text }))
    ]

    // ComfyUI: prompt chunk is API-format JSON
    // ⚠️ ComfyUI 的 prompt 块由 Python 序列化，NaN / Infinity 会以裸字面量出现在 JSON 里，
    // 严格 JSON.parse 会直接抛错（本仓库实测：`"is_changed": [NaN]`），
    // 必须用宽松解析，否则整块 AI 生成信息都读不出来
    const promptChunk = allTextChunks.find(c => c.keyword === 'prompt')
    if (promptChunk) {
      const parsed = parseLooseJson<unknown>(promptChunk.text)
      if (isRecord(parsed)) {
        return parseComfyUIPrompt(parsed as ComfyPromptGraph)
      }
    }

    // A1111 / SD-WebUI: parameters chunk
    const paramsChunk = allTextChunks.find(c => c.keyword === 'parameters')
    if (paramsChunk) {
      return parseSdParameters(paramsChunk.text)
    }
  }

  // EXIF-based detection (for JPEG AI images)
  if (exif) {
    const software = exif.find(e => e.tag_name === 'Software')?.value ?? ''
    const description = exif.find(e => e.tag_name === 'ImageDescription')?.value ?? ''
    const userComment = exif.find(e => e.tag_name === 'UserComment')?.value ?? ''

    // Check Software tag for AI indicators
    const aiSoftware = ['NovelAI', 'Stable Diffusion', 'ComfyUI', 'Midjourney', 'DALL-E']
    if (aiSoftware.some(s => software.includes(s) || description.includes(s))) {
      return parseSdParameters(description || userComment || software)
    }
  }

  return null
}

// ── ComfyUI 图结构工具 ──

interface ComfyNodeLike {
  class_type?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputs?: Record<string, any>
}

type ComfyPromptGraph = Record<string, ComfyNodeLike>

/** 连线引用形如 ["45", 1]：源节点 id + 输出槽位序号 */
function isNodeLink(value: unknown): value is [string | number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    (typeof value[0] === 'string' || typeof value[0] === 'number') &&
    typeof value[1] === 'number'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 严格取数：连线数组、对象、空串一律返回 null。
 * 之前直接 Number(inp.width) 会拿到 Number(['96', 0]) === NaN，
 * 于是「尺寸」显示成 NaN × NaN。
 * @param value 待转换的值
 * @returns 有限数字；无法转换时为 null
 */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

// `<lora:名称:权重>` 或 `<lora:名称:权重:clip权重>`（LoraManager / A1111 通用写法）
const LORA_TAG_PATTERN = /<lora:([^:>]+):(-?\d*\.?\d+)(?::(-?\d*\.?\d+))?>/gi

/** 抽出文本里所有 <lora:...> 标签 */
function extractLoraTags(text: string): LoraInfo[] {
  const found: LoraInfo[] = []
  for (const match of text.matchAll(LORA_TAG_PATTERN)) {
    found.push({ name: match[1], strength: toNumber(match[2]) })
  }
  return found
}

/** 去掉 LoRA 标签，只留正文 */
function stripLoraTags(text: string): string {
  return text.replace(LORA_TAG_PATTERN, ' ').replace(/\s+/g, ' ').trim()
}

/** 该字段是否只是「LoRA 标签容器」而非提示词正文（LoraManager 的 text 字段就是这种） */
function isLoraTagContainer(text: string): boolean {
  if (!text.includes('<lora:')) return false
  return stripLoraTags(text).length === 0
}

/** 正向 / 反向分支上承载提示词的字段优先级 */
const POSITIVE_FIELDS = ['positive', 'positive_prompt', 'text', 'prompt']
const NEGATIVE_FIELDS = ['negative', 'negative_prompt', 'text', 'prompt']
/** 兜底扫描时认的字段名（图里没连出提示词才会用到） */
const PROMPT_TEXT_FIELDS = ['text', 'positive', 'negative', 'prompt', 'positive_prompt', 'negative_prompt']

/**
 * 沿连线回溯，找到真正写着提示词的节点。
 * 采样器的 positive / negative 常先连到零化、拼接之类的中间节点，
 * 只看采样器自己那一层是拿不到文本的（这正是之前把 LoRA 标签当成正向提示词的原因：
 * 旧实现改成「哪个节点有 text 字段就用谁」，于是 LoraManager 的 text 被误收）。
 * @param nodes 节点表
 * @param ref 连线引用 [节点id, 槽位]
 * @param branch 处于正向还是反向分支
 * @param visited 已访问节点，防止成环
 * @param depth 递归深度上限
 * @returns 找到的提示词文本数组
 */
function resolvePromptText(
  nodes: ComfyPromptGraph,
  ref: unknown,
  branch: 'positive' | 'negative',
  visited: Set<string> = new Set(),
  depth = 0
): string[] {
  if (!isNodeLink(ref) || depth > 8) return []

  const nodeId = String(ref[0])
  if (visited.has(nodeId)) return []
  visited.add(nodeId)

  const node = nodes[nodeId]
  if (!node) return []

  const classType = node.class_type ?? ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inp: Record<string, any> = node.inputs ?? {}

  // 条件零化：文本在这里被丢弃，等价于「没有提示词」，继续上溯反而会找错
  if (/zero.?out/i.test(classType)) return []

  const fields = branch === 'positive' ? POSITIVE_FIELDS : NEGATIVE_FIELDS
  for (const field of fields) {
    const value = inp[field]
    if (typeof value === 'string' && value.trim() && !isLoraTagContainer(value)) {
      return [value.trim()]
    }
  }

  // 当前节点不是文本节点，继续沿条件输入往上找
  for (const field of ['conditioning', 'positive', 'negative', 'text', 'prompt']) {
    const found = resolvePromptText(nodes, inp[field], branch, visited, depth + 1)
    if (found.length > 0) return found
  }

  return []
}

function parseComfyUIPrompt(prompt: ComfyPromptGraph): AiGenerationInfo {
  let seed: number | null = null
  let steps: number | null = null
  let cfg: number | null = null
  let sampler: string | null = null
  let scheduler: string | null = null
  let width: number | null = null
  let height: number | null = null
  let modelName: string | null = null
  let vaeName: string | null = null
  let clipName: string | null = null
  let denoise: number | null = null
  let batchSize: number | null = null
  let samplerSeen = false
  let positiveFromGraph: string[] = []
  let negativeFromGraph: string[] = []
  const loras: LoraInfo[] = []
  const modelNames: string[] = []
  const positiveParts: string[] = []
  const negativeParts: string[] = []

  // Known negative prompt patterns (used when field name is ambiguous like "positive")
  const negativePattern = /^(worst quality|low quality|bad quality|bad anatomy|blurry|jpeg artifacts|lowres|malformed|mutated|poorly drawn|bad hands|missing fingers|extra fingers|fused fingers|too many fingers|deformed|disfigured|ugly|error|watermark|signature|username|artist name|censor)/i

  for (const node of Object.values(prompt)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n = node as any
    const inp: Record<string, any> = n.inputs ?? {}

    // ── Sampler: any node with seed + (steps or cfg) ──
    const hasSeed = inp.seed !== undefined || inp.noise_seed !== undefined
    const hasSampling = inp.steps !== undefined || inp.step !== undefined ||
      inp.cfg !== undefined || inp.cfg_scale !== undefined
    if (!samplerSeen && hasSeed && hasSampling) {
      samplerSeen = true
      seed = toNumber(inp.seed ?? inp.noise_seed)
      steps = toNumber(inp.steps ?? inp.step)
      cfg = toNumber(inp.cfg ?? inp.cfg_scale)
      denoise = toNumber(inp.denoise)
      if (inp.sampler_name !== undefined || inp.sampler !== undefined) {
        sampler = String(inp.sampler_name ?? inp.sampler)
      }
      if (inp.scheduler !== undefined) scheduler = String(inp.scheduler)
    }

    // ── 顺着 positive / negative 连线回溯真正的提示词节点 ──
    if (positiveFromGraph.length === 0) {
      positiveFromGraph = resolvePromptText(prompt, inp.positive ?? inp.positive_conditioning, 'positive')
    }
    if (negativeFromGraph.length === 0) {
      negativeFromGraph = resolvePromptText(prompt, inp.negative ?? inp.negative_conditioning, 'negative')
    }

    // ── Size ──
    if (width === null && height === null) {
      const literalWidth = toNumber(inp.width)
      const literalHeight = toNumber(inp.height)
      if (literalWidth !== null && literalHeight !== null) {
        width = literalWidth
        height = literalHeight
        batchSize = toNumber(inp.batch_size) ?? batchSize
      }
    }

    // 批次数：可能挂在 EmptyLatentImage，也可能挂在采样器，单独取
    if (batchSize === null) {
      batchSize = toNumber(inp.batch_size)
    }

    // EmptyLatentImage 的宽高常是连线（读出来是数组），
    // 真实数值可能落在 ResolutionPreset 节点的 resolution_json 里
    if (width === null && typeof inp.resolution_json === 'string') {
      const preset = parseLooseJson<Record<string, unknown>>(inp.resolution_json)
      const presetWidth = toNumber(preset?.width)
      const presetHeight = toNumber(preset?.height)
      if (presetWidth !== null && presetHeight !== null) {
        width = presetWidth
        height = presetHeight
      }
    }
    if (width === null && typeof inp.resolution === 'string') {
      const sizeMatch = inp.resolution.match(/(\d+)\s*[x×]\s*(\d+)/i)
      if (sizeMatch) {
        width = Number(sizeMatch[1])
        height = Number(sizeMatch[2])
      }
    }

    // ── Prompt: 只有连线回溯没拿到文本时，才走「按字段名猜」的兜底 ──
    if (positiveFromGraph.length === 0 || negativeFromGraph.length === 0) {
      for (const field of PROMPT_TEXT_FIELDS) {
        if (typeof inp[field] !== 'string' || !inp[field].trim()) continue
        const content = inp[field].trim()
        // LoRA 标签容器（如 LoraManager 的 text 字段）不是提示词
        if (isLoraTagContainer(content)) continue
        // Field named "negative" is always negative; content matching
        // negative keywords is negative regardless of field name
        const isNegativeField = field === 'negative' || field === 'negative_prompt'
        if (isNegativeField || negativePattern.test(content)) {
          if (negativeFromGraph.length === 0) negativeParts.push(content)
        } else if (positiveFromGraph.length === 0) {
          positiveParts.push(content)
        }
      }
    }

    // ── Model: any *_name field containing .safetensors / .ckpt / .pt ──
    for (const [key, value] of Object.entries(inp)) {
      if (typeof value !== 'string') continue
      if (!/\.(safetensors|ckpt|pt|pth|onnx|bin)$/i.test(value)) continue

      if (key === 'vae_name') {
        vaeName = vaeName || value
      } else if (key.startsWith('clip_name')) {
        clipName = clipName ? clipName + ' + ' + value : value
      } else if (key === 'lora_name') {
        loras.push({ name: value, strength: toNumber(inp.strength_model ?? inp.strength_clip ?? inp.strength) })
      } else if (!key.includes('lora') && !key.includes('vae') && !key.includes('clip')) {
        modelNames.push(value)
      }
    }

    // ── LoraManager：结构化 loras 字段 { __value__: [{ name, strength, active }] } ──
    const loraField = inp.loras
    const loraList = isRecord(loraField) ? loraField.__value__ : loraField
    if (Array.isArray(loraList)) {
      for (const item of loraList) {
        if (!isRecord(item)) continue
        const name = item.display_name ?? item.name ?? item.lora
        if (typeof name !== 'string' || !name.trim()) continue
        loras.push({ name: name.trim(), strength: toNumber(item.strength ?? item.weight) })
      }
    }

    // ── LoRA JSON string（被序列化成字符串的 LoRA 数组）──
    if (typeof inp.lora_str === 'string') {
      const loraArr = parseLooseJson<unknown>(inp.lora_str)
      if (Array.isArray(loraArr)) {
        for (const item of loraArr) {
          if (!isRecord(item)) continue
          const name = item.display_name ?? item.name ?? item.lora
          if (typeof name !== 'string' || !name.trim()) continue
          loras.push({ name: name.trim(), strength: toNumber(item.weight ?? item.strength) })
        }
      }
    }

    // ── <lora:名称:权重> 标签：LoraManager 的 text 字段只能靠这一手认出来 ──
    for (const value of Object.values(inp)) {
      if (typeof value === 'string' && value.includes('<lora:')) {
        loras.push(...extractLoraTags(value))
      }
    }
  }

  // Merge prompts：优先用连线回溯的结果，兜底才用按字段名猜的
  const positiveTexts = positiveFromGraph.length > 0 ? positiveFromGraph : positiveParts
  const negativeTexts = negativeFromGraph.length > 0 ? negativeFromGraph : negativeParts

  const joinTexts = (parts: string[]): string | null =>
    parts.length > 0 ? [...new Set(parts)].join(', ').replace(/,\s*,/g, ',') : null

  const positive = joinTexts(positiveTexts)
  const negative = joinTexts(negativeTexts)

  modelName = modelNames.length > 0 ? [...new Set(modelNames)].join(' + ') : null

  // LoRA 去重：结构化字段和 <lora:...> 标签常描述同一批 LoRA
  const loraMap = new Map<string, LoraInfo>()
  for (const lora of loras) {
    if (!loraMap.has(lora.name)) loraMap.set(lora.name, lora)
  }

  return {
    source: 'ComfyUI',
    positive_prompt: positive,
    negative_prompt: negative,
    seed,
    steps,
    cfg_scale: cfg,
    sampler,
    scheduler,
    width,
    height,
    model_name: modelName,
    model_hash: null,
    vae_name: vaeName,
    clip_name: clipName,
    loras: [...loraMap.values()],
    denoise,
    batch_size: batchSize,
    raw_params: null
  }
}

function parseSdParameters(text: string): AiGenerationInfo {
  let positive: string | null = null
  let negative: string | null = null
  let seed: number | null = null
  let steps: number | null = null
  let cfg: number | null = null
  let sampler: string | null = null
  let scheduler: string | null = null
  let width: number | null = null
  let height: number | null = null
  let modelName: string | null = null
  let modelHash: string | null = null
  let vaeName: string | null = null
  const loras: LoraInfo[] = []

  // Split into positive prompt and parameters lines
  const negIdx = text.indexOf('Negative prompt:')
  let paramsSection: string

  if (negIdx !== -1) {
    positive = text.substring(0, negIdx).trim()
    const afterNeg = text.substring(negIdx + 'Negative prompt:'.length)
    // Find where parameters start (first line starting with "Steps:" or similar)
    const stepsMatch = afterNeg.match(/\n\s*(Steps?:)/i)
    if (stepsMatch && stepsMatch.index !== undefined) {
      negative = afterNeg.substring(0, stepsMatch.index).trim()
      paramsSection = afterNeg.substring(stepsMatch.index).trim()
    } else {
      negative = afterNeg.trim()
      paramsSection = ''
    }
  } else {
    // No "Negative prompt:" marker — treat as raw params
    positive = null
    negative = null
    paramsSection = text.trim()
  }

  // Parse key=value or key: value pairs from params section
  const paramMap: Record<string, string> = {}
  // Match patterns like "Steps: 20" or "Steps:20" or "Steps=20"
  const paramRegex = /([A-Za-z_ ]+?)[:=]\s*(.+?)(?=,\s*(?:[A-Za-z_ ]+?)[:=]|$)/g
  let match: RegExpExecArray | null
  while ((match = paramRegex.exec(paramsSection)) !== null) {
    paramMap[match[1].trim().toLowerCase()] = match[2].trim()
  }

  // Also try comma-separated: "Steps: 20, Sampler: Euler a"
  const parts = paramsSection.split(/,\s*(?=[A-Z])/)
  for (const part of parts) {
    const colonIdx = part.indexOf(':')
    const eqIdx = part.indexOf('=')
    const sepIdx = colonIdx !== -1 ? colonIdx : eqIdx
    if (sepIdx !== -1) {
      const key = part.substring(0, sepIdx).trim().toLowerCase()
      const value = part.substring(sepIdx + 1).trim()
      if (!paramMap[key]) {
        paramMap[key] = value
      }
    }
  }

  // Map to fields
  seed = paramMap['seed'] ? Number(paramMap['seed']) : null
  steps = paramMap['steps'] ? Number(paramMap['steps']) : null
  cfg = paramMap['cfg scale'] ? Number(paramMap['cfg scale']) : (paramMap['cfg'] ? Number(paramMap['cfg']) : null)
  sampler = paramMap['sampler'] ?? null
  scheduler = paramMap['scheduler'] ?? null
  modelHash = paramMap['model hash'] ?? paramMap['model_hash'] ?? null
  modelName = paramMap['model'] ?? null

  // Size: "512x768"
  const size = paramMap['size']
  if (size) {
    const sizeMatch = size.match(/(\d+)\s*[x×]\s*(\d+)/i)
    if (sizeMatch) {
      width = Number(sizeMatch[1])
      height = Number(sizeMatch[2])
    }
  }

  // VAE
  vaeName = paramMap['vae'] ?? paramMap['vae hash'] ?? null

  // LoRA: "Add Details: 0.5" 这种键值对写法
  for (const [key, value] of Object.entries(paramMap)) {
    if (!key.includes('lora')) continue

    // `Lora hashes: "名称: 哈希, 名称: 哈希"` 是哈希清单，不是带权重的 LoRA 条目。
    // 之前会把整串当成一个名叫 "lora hashes" 的 LoRA 塞进表格（强度还是 null）
    if (key.includes('hash')) {
      for (const pair of value.matchAll(/([^,"]+?):\s*([0-9a-f]{6,})/gi)) {
        loras.push({ name: pair[1].trim(), strength: null })
      }
      continue
    }

    const strength = parseFloat(value)
    loras.push({ name: key, strength: isNaN(strength) ? null : strength })
  }
  // Also check "AddNet Module" style
  if (paramMap['addnet module 1']) {
    loras.push({ name: paramMap['addnet module 1'], strength: paramMap['addnet weight 1'] ? parseFloat(paramMap['addnet weight 1']) : null })
  }

  return {
    source: 'Stable Diffusion WebUI',
    positive_prompt: positive,
    negative_prompt: negative,
    seed,
    steps,
    cfg_scale: cfg,
    sampler,
    scheduler,
    width,
    height,
    model_name: modelName,
    model_hash: modelHash,
    vae_name: vaeName,
    clip_name: null,
    loras,
    denoise: null,
    batch_size: paramMap['batch size'] ? Number(paramMap['batch size']) : null,
    raw_params: text
  }
}

export async function analyzeImageFile(filePath: string): Promise<ImageMetadata> {
  const bytes = await readFile(filePath)
  const fileName = basename(filePath)
  const ext = fileName.split('.').pop() ?? ''

  // File info
  const md5 = createHash('md5').update(bytes).digest('hex')
  const { mime_type, file_type, file_type_extension } = getMimeAndType(ext)
  const detectedType = file_type === ext.toUpperCase() ? detectFileTypeFromBytes(bytes) : file_type

  const fileInfo: FileInfo = {
    file_name: fileName,
    file_path: filePath,
    file_size: bytes.length,
    file_size_formatted: formatFileSize(bytes.length),
    md5_checksum: md5,
    mime_type,
    file_type: detectedType,
    file_type_extension
  }

  // Image dimensions via image-size (pure JS)
  let imageWidth = 0
  let imageHeight = 0
  let bitDepth = 8
  let colorType = 'Unknown'
  let compression: string | null = null
  let filter: string | null = null
  let interlace: string | null = null
  let hasAlpha = false

  try {
    const dims = imageSize(bytes)
    imageWidth = dims.width ?? 0
    imageHeight = dims.height ?? 0

    // Get type from image-size result
    const isType = dims.type?.toUpperCase()
    if (isType) {
      const typeEntry = MIME_MAP[isType.toLowerCase()]
      if (typeEntry) {
        fileInfo.file_type = typeEntry.type
        fileInfo.mime_type = typeEntry.mime
      }
    }
  } catch {
    // Fallback: try dimension extraction from file signature
  }

  // Format-specific metadata
  const actualType = fileInfo.file_type

  if (actualType === 'PNG') {
    const ihdr = parsePngIhdr(bytes)
    if (ihdr) {
      bitDepth = ihdr.bitDepth
      colorType = ihdr.colorType
      compression = ihdr.compression
      filter = ihdr.filter
      interlace = ihdr.interlace
      hasAlpha = colorType.includes('Alpha')
    }
  } else if (actualType === 'JPEG') {
    const sof = parseJpegSof(bytes)
    if (sof) {
      bitDepth = sof.bitDepth
      colorType = sof.components === 1 ? 'Grayscale' : sof.components === 3 ? 'YCbCr' : sof.components === 4 ? 'CMYK' : `${sof.components} components`
    }
    compression = 'JPEG DCT'
    interlace = 'Baseline'
  } else if (actualType === 'GIF') {
    // GIF always uses a global color table; read from LSD
    if (bytes.length > 13) {
      const packed = bytes[10]
      const hasGlobalColorTable = (packed & 0x80) !== 0
      const colorRes = ((packed >> 4) & 0x07) + 1
      bitDepth = hasGlobalColorTable ? colorRes : 8
      colorType = 'Indexed'
    }
    compression = 'LZW'
    interlace = 'Noninterlaced'
  } else if (actualType === 'BMP') {
    const bmp = parseBmpInfo(bytes)
    if (bmp) {
      bitDepth = bmp.bitDepth
      compression = bmp.compression
      if (bitDepth <= 8) colorType = 'Indexed'
      else if (bitDepth === 16) colorType = 'HighColor'
      else if (bitDepth === 24) colorType = 'RGB'
      else if (bitDepth === 32) {
        colorType = 'RGBA'
        hasAlpha = true
      }
    }
  } else if (actualType === 'WebP') {
    colorType = 'RGB'
    compression = 'VP8'
  } else if (actualType === 'ICO') {
    colorType = 'RGBA'
    hasAlpha = true
  } else if (actualType === 'TIFF') {
    colorType = 'RGB'
  } else if (actualType === 'AVIF') {
    colorType = 'RGB'
  }

  const megapixels = Math.round((imageWidth * imageHeight) / 10000) / 100

  const imageInfo: ImageInfo = {
    image_width: imageWidth,
    image_height: imageHeight,
    megapixels,
    bit_depth: bitDepth,
    color_type: colorType,
    has_alpha: hasAlpha,
    compression,
    filter,
    interlace,
    format_name: actualType,
    image_size: `${imageWidth}x${imageHeight}`,
    frame_count: null
  }

  // PNG text chunks (tEXt, zTXt, iTXt)
  let pngChunks: PngChunkData | null = null
  if (actualType === 'PNG') {
    pngChunks = extractPngTextChunks(bytes)
  }

  // EXIF
  let exifEntries: ExifEntry[] | null = null
  try {
    const exifData = await exifr.parse(bytes, {
      translateKeys: true,
      translateValues: true,
      reviveValues: true
    })
    if (exifData) {
      exifEntries = Object.entries(exifData).map(([key, value]) => ({
        tag_name: key,
        tag_id: '',
        value: formatExifValue(value)
      }))
    }
  } catch {
    exifEntries = null
  }

  const rawHeader = getRawHeader(bytes)

  // AI generation metadata
  const ai = parseAiMetadata(pngChunks, exifEntries)

  return {
    file: fileInfo,
    image: imageInfo,
    png_chunks: pngChunks,
    exif: exifEntries,
    raw_header: rawHeader,
    ai
  }
}

function formatExifValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(v => formatExifValue(v)).join(', ')
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function extractPngTextChunks(bytes: Buffer): PngChunkData | null {
  const tExtChunks: TextChunk[] = []
  const ztxtChunks: ZtxtChunk[] = []
  const itxtChunks: ITextChunk[] = []

  try {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10]
    for (let i = 0; i < 8; i++) {
      if (bytes[i] !== signature[i]) return null
    }

    let offset = 8
    while (offset < bytes.length - 12) {
      const length = bytes.readUInt32BE(offset)
      offset += 4
      const type = bytes.subarray(offset, offset + 4).toString('ascii')
      offset += 4

      if (offset + length > bytes.length) break

      const data = bytes.subarray(offset, offset + length)

      if (type === 'tEXt') {
        const nullIdx = data.indexOf(0)
        if (nullIdx !== -1) {
          const keyword = data.subarray(0, nullIdx).toString('latin1')
          const text = data.subarray(nullIdx + 1).toString('latin1')
          tExtChunks.push({ keyword, text, is_json: tryParseJson(text) })
        }
      } else if (type === 'zTXt') {
        const nullIdx = data.indexOf(0)
        if (nullIdx !== -1) {
          const keyword = data.subarray(0, nullIdx).toString('latin1')
          const compressedData = data.subarray(nullIdx + 2)
          try {
            const zlib = require('zlib')
            const decompressed = zlib.inflateSync(compressedData)
            const text = decompressed.toString('latin1')
            ztxtChunks.push({ keyword, text, is_json: tryParseJson(text) })
          } catch {
            ztxtChunks.push({ keyword, text: '[Decompression failed]', is_json: false })
          }
        }
      } else if (type === 'iTXt') {
        const null1 = data.indexOf(0)
        if (null1 !== -1) {
          const keyword = data.subarray(0, null1).toString('utf-8')
          let pos = null1 + 1
          const compressionFlag = data[pos]
          pos += 1
          const compressionMethod = data[pos]
          pos += 1

          const null2 = data.indexOf(0, pos)
          const languageTag = null2 !== -1 ? data.subarray(pos, null2).toString('utf-8') : ''
          pos = null2 !== -1 ? null2 + 1 : pos

          const null3 = data.indexOf(0, pos)
          const translatedKeyword = null3 !== -1 ? data.subarray(pos, null3).toString('utf-8') : ''
          pos = null3 !== -1 ? null3 + 1 : pos

          const textBytes = data.subarray(pos)
          let text: string

          if (compressionFlag === 1 && compressionMethod === 0) {
            try {
              const zlib = require('zlib')
              const decompressed = zlib.inflateSync(textBytes)
              text = decompressed.toString('utf-8')
            } catch {
              text = '[Decompression failed]'
            }
          } else {
            text = textBytes.toString('utf-8')
          }

          itxtChunks.push({
            keyword,
            text,
            language_tag: languageTag || null,
            translated_keyword: translatedKeyword || null,
            is_compressed: compressionFlag === 1,
            is_json: tryParseJson(text)
          })
        }
      }

      offset += length + 4 // skip data + CRC

      if (type === 'IEND') break
    }
  } catch {
    return null
  }

  if (tExtChunks.length === 0 && ztxtChunks.length === 0 && itxtChunks.length === 0) {
    return null
  }

  return {
    t_ext_chunks: tExtChunks,
    ztxt_chunks: ztxtChunks,
    itxt_chunks: itxtChunks
  }
}

function tryParseJson(text: string): boolean {
  return isLooseJson(text)
}
