import elementPlus from 'unplugin-element-plus/vite'

export default function createElementPlusPlugin() {
  return elementPlus({
    useSource: true,
  })
}
