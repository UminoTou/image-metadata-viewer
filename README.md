# Image Metadata Viewer

本地图片元数据查看器，基于 Electron + React + TypeScript。

## 软件截图
<img width="700" alt="Snipaste_2026-08-03_11-51-40" src="https://github.com/user-attachments/assets/7b553cf0-d379-4f11-8d2c-a434750dbf3b" />


## 功能

- 拖放或浏览选择图片，查看完整元数据
- 支持 PNG / JPEG / GIF / WebP / BMP / TIFF / ICO / AVIF
- PNG 文本块解析（tEXt / zTXt / iTXt）
- EXIF 数据查看与搜索
- **AI 生成信息解析**：自动识别 ComfyUI、Stable Diffusion WebUI 等工具生成的图片，结构化展示提示词、参数、模型、LoRA
- 导出为 JSON / CSV / TXT / HTML / PDF

## 脚本

```bash
npm install         # 安装依赖
npm run dev         # 启动开发模式（Electron + Vite HMR）
npm run build       # 构建生产版本 → dist/ + dist-electron/
npm run typecheck   # TypeScript 类型检查（不生成文件）
npm run package     # 构建 + 打包为 Windows 安装程序 → release/
```

## Support
<img width="400" alt="赞助" src="https://github.com/user-attachments/assets/afb19019-bda0-4f74-b77f-d806d86ac3cf" />
