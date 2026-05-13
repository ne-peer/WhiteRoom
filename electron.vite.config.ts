import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve, join } from 'path'
import { readdirSync } from 'fs'
import pkg from './package.json'
import { isPresetRasterListingFilename } from './src/shared/rasterSourceExtensions'

function scanAssetEffectFolders(): { name: string; count: number }[] {
  const basePath = join(__dirname, 'assets', 'asset-effect')
  try {
    return readdirSync(basePath, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => {
        const count = readdirSync(join(basePath, e.name))
          .filter(f => isPresetRasterListingFilename(f))
          .length
        return { name: e.name, count }
      })
      .filter(f => f.count > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(__dirname, 'src/main/index.ts')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(__dirname, 'src/preload/index.ts')
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html')
      }
    },
    plugins: [react()],
    define: {
      __ASSET_EFFECT_FOLDERS__: JSON.stringify(scanAssetEffectFolders()),
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@main': resolve(__dirname, 'src/main'),
        '@preload': resolve(__dirname, 'src/preload')
      }
    }
  }
})
