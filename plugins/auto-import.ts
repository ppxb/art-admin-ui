import autoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default function createAutoImportPlugin() {
  return autoImport({
    imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
    dts: './src/types/auto-imports.d.ts',
    resolvers: [ElementPlusResolver()],
  })
}
