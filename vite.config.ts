import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

// 移除从父进程继承的 ELECTRON_RUN_AS_NODE（它会阻止 Electron 进入浏览器模式）
delete process.env.ELECTRON_RUN_AS_NODE

// ⚠️ 必须显式声明：Vite 默认顺序是 ['.mjs','.js','.mts','.ts','.jsx','.tsx','.json']，
// `.js` 排在 `.ts/.tsx` 之前。而本仓库 src/、electron/ 下残留着一份 `tsc` 编译产物
// （已被 .gitignore 忽略，但文件仍在磁盘上），会把同名的 .ts/.tsx 源码顶掉
// —— 表现为「改了源码不生效」。
const TS_FIRST_EXTENSIONS = ['.mjs', '.ts', '.tsx', '.mts', '.js', '.jsx', '.json']

export default defineConfig({
  resolve: {
    extensions: TS_FIRST_EXTENSIONS
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          // vite-plugin-electron 的主进程构建不会继承根配置的 resolve，
          // 这里必须再写一次，否则 electron/main.ts 里的 `./metadata`
          // 仍会解析到残留的 electron/metadata.js
          resolve: {
            extensions: TS_FIRST_EXTENSIONS
          },
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
