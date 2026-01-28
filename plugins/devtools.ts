import VueDevTools from 'vite-plugin-vue-devtools'

export default function createDevtools(enable: string) {
  return enable === 'true' && VueDevTools()
}
