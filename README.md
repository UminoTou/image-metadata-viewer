# Image Metadata Viewer

本地图片元数据查看器，基于 Electron + React + TypeScript。

## 功能

- 拖放或浏览选择图片，查看完整元数据
- 支持 PNG / JPEG / GIF / WebP / BMP / TIFF / ICO / AVIF
- PNG 文本块解析（tEXt / zTXt / iTXt）
- EXIF 数据查看与搜索
- **AI 生成信息解析**：自动识别 ComfyUI、Stable Diffusion WebUI 等工具生成的图片，结构化展示提示词、参数、模型、LoRA
- 导出为 JSON / CSV / TXT / HTML / PDF

## 运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```
