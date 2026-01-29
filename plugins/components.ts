import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import components from 'unplugin-vue-components/vite'

export default function createComponentsPlugin() {
  return components({
    dts: './src/types/components.d.ts',
    resolvers: [ElementPlusResolver()],
  })
}
