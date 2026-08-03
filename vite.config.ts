import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

// 移除从父进程继承的 ELECTRON_RUN_AS_NODE（它会阻止 Electron 进入浏览器模式）
delete process.env.ELECTRON_RUN_AS_NODE

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['image-size', 'exifr']
            }
          }
        }
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            rollupOptions: {
              output: {
                // 必须用 es 格式：sandbox:false + nodeIntegration:false 时
                // .mjs preload 不支持 require()，只支持 import
                format: 'es'
              }
            }
          }
        }
      },
      renderer: {}
    })
  ]
})
