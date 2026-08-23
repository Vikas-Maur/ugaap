import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import neon from './neon-vite-plugin.ts'

const config = defineConfig(({ mode }) => {
  const configEnv = loadEnv(mode, process.cwd(), '')
  const configuredTtl = Number.parseInt(configEnv.PUBLIC_DATA_REVALIDATE_SECONDS ?? '21600', 10)
  const catalogueTtl = Number.isFinite(configuredTtl) && configuredTtl > 0 ? configuredTtl : 21600

  return {
    resolve: { tsconfigPaths: true },
    plugins: [
      devtools(),
      nitro({
        rollupConfig: { external: [/^@sentry\//] },
        routeRules: {
          '/catalogue/**': {
            headers: {
              'cache-control': `public, max-age=300, s-maxage=${catalogueTtl}, stale-while-revalidate=${catalogueTtl * 4}`,
            },
          },
        },
      }),
      neon,
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  }
})

export default config
