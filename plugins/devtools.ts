import VueDevTools from 'vite-plugin-vue-devtools'

export default function createDevtoolsPlugin(enable: string) {
  return enable === 'true' && VueDevTools()
}
