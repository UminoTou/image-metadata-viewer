/**
 * 宽松 JSON 解析 —— 兼容 Python `json.dumps` 产出的非标准字面量。
 *
 * 背景：ComfyUI 的 PNG `prompt` 文本块由 Python 序列化，遇到 float('nan')
 * 会写出 `"is_changed": [NaN]` 这种令牌。严格 JSON 规范里没有 NaN，
 * `JSON.parse` 会直接抛错，导致整块工作流元数据解析失败。
 *
 * 策略：先按标准 JSON 解析；失败则把「字符串字面量之外」的
 * NaN / Infinity / -Infinity 替换成 null，再解析一次。
 */

const NON_FINITE_LITERAL = /(^|[^\w."'-])(-?Infinity|NaN)(?![\w"])/g

/**
 * 把字符串字面量之外的非法数值令牌替换为 null。
 * 逐字符扫描以区分「JSON 结构」和「字符串内容」，
 * 避免误伤 `{"text": "contains NaN here"}` 这种正常内容。
 */
function replaceNonFiniteLiterals(text: string): string {
  let out = ''
  let segmentStart = 0
  let i = 0

  while (i < text.length) {
    if (text[i] !== '"') {
      i++
      continue
    }

    // 到了字符串起点：先处理它之前的结构片段
    out += text.slice(segmentStart, i).replace(NON_FINITE_LITERAL, '$1null')

    const stringStart = i
    i++
    while (i < text.length) {
      if (text[i] === '\\') {
        i += 2
        continue
      }
      if (text[i] === '"') {
        i++
        break
      }
      i++
    }
    // 原样保留整个字符串字面量（含转义序列）
    out += text.slice(stringStart, i)
    segmentStart = i
  }

  out += text.slice(segmentStart).replace(NON_FINITE_LITERAL, '$1null')
  return out
}

/**
 * 解析宽松 JSON。失败返回 null，不抛异常。
 * @param text 待解析文本
 * @returns 解析结果；无法解析时为 null
 */
export function parseLooseJson<T = unknown>(text: string): T | null {
  if (typeof text !== 'string') return null

  try {
    return JSON.parse(text) as T
  } catch {
    // 走宽松模式
  }

  try {
    return JSON.parse(replaceNonFiniteLiterals(text)) as T
  } catch {
    return null
  }
}

/**
 * 判断文本是否可被解析为 JSON（严格或宽松任一成立即可）。
 */
export function isLooseJson(text: string): boolean {
  return parseLooseJson(text) !== null
}
