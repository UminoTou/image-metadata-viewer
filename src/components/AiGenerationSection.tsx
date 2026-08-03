import { useState } from 'react'
import type { AiGenerationInfo } from '../types/metadata'

interface AiGenerationSectionProps {
  ai: AiGenerationInfo
}

function PromptBlock({ label, text }: { label: string; text: string | null }): JSX.Element | null {
  if (!text) return null
  return (
    <div className="ai-prompt-block">
      <div className="ai-prompt-label">{label}</div>
      <div className="ai-prompt-text">{text}</div>
    </div>
  )
}

function ParamTag({ label, value }: { label: string; value: string | number | null | undefined }): JSX.Element | null {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="ai-param-tag">
      <span className="ai-param-label">{label}</span>
      <span className="ai-param-value">{String(value)}</span>
    </div>
  )
}

function AiGenerationSection({ ai }: AiGenerationSectionProps): JSX.Element {
  const [showRaw, setShowRaw] = useState(false)

  const sizeStr = ai.width && ai.height ? `${ai.width} × ${ai.height}` : null

  return (
    <div className="section-card ai-section">
      <h3>🤖 AI 生成信息</h3>

      {/* Source */}
      <div className="ai-source-badge">
        <span className="ai-source-label">来源工具</span>
        <span className="ai-source-value">{ai.source}</span>
      </div>

      {/* Prompts */}
      <PromptBlock label="正向提示词 (Positive Prompt)" text={ai.positive_prompt} />
      <PromptBlock label="反向提示词 (Negative Prompt)" text={ai.negative_prompt} />

      {/* Generation Parameters Grid */}
      <div className="ai-params-grid">
        <ParamTag label="Seed" value={ai.seed} />
        <ParamTag label="Steps" value={ai.steps} />
        <ParamTag label="CFG Scale" value={ai.cfg_scale} />
        <ParamTag label="Sampler" value={ai.sampler} />
        <ParamTag label="Scheduler" value={ai.scheduler} />
        <ParamTag label="Denoise" value={ai.denoise} />
        <ParamTag label="Size" value={sizeStr} />
        <ParamTag label="Batch Size" value={ai.batch_size} />
      </div>

      {/* Models */}
      {(ai.model_name || ai.model_hash || ai.vae_name || ai.clip_name) && (
        <div className="ai-models-section">
          <h4 className="ai-subtitle">🧩 使用模型</h4>
          <div className="ai-models-grid">
            {ai.model_name && (
              <div className="ai-model-item">
                <span className="ai-model-label">Checkpoint / UNET</span>
                <span className="ai-model-name">{ai.model_name}</span>
              </div>
            )}
            {ai.model_hash && (
              <div className="ai-model-item">
                <span className="ai-model-label">Model Hash</span>
                <code className="ai-model-hash">{ai.model_hash}</code>
              </div>
            )}
            {ai.vae_name && (
              <div className="ai-model-item">
                <span className="ai-model-label">VAE</span>
                <span className="ai-model-name">{ai.vae_name}</span>
              </div>
            )}
            {ai.clip_name && (
              <div className="ai-model-item">
                <span className="ai-model-label">CLIP</span>
                <span className="ai-model-name">{ai.clip_name}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LoRAs */}
      {ai.loras.length > 0 && (
        <div className="ai-loras-section">
          <h4 className="ai-subtitle">🔌 LoRA</h4>
          <table className="ai-loras-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>强度</th>
              </tr>
            </thead>
            <tbody>
              {ai.loras.map((lora, i) => (
                <tr key={i}>
                  <td className="ai-lora-name">{lora.name}</td>
                  <td className="ai-lora-strength">{lora.strength ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Raw parameters */}
      {ai.raw_params && (
        <div className="ai-raw-section">
          <button
            className="btn btn-sm ai-expand-btn"
            onClick={() => setShowRaw(!showRaw)}
          >
            {showRaw ? '收起原始参数' : '查看原始参数'}
          </button>
          {showRaw && (
            <pre className="chunk-text ai-raw-text">{ai.raw_params}</pre>
          )}
        </div>
      )}
    </div>
  )
}

export default AiGenerationSection
