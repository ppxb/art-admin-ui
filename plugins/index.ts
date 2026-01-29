import type { PluginOption } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'

import createAppInfoPlugin from './app-info'
import createAutoImportPlugin from './auto-import'
import creaetComponentsPlugin from './components'
import createCompressionPlugin from './compression'
import createDevtoolsPlugin from './devtools'
import createElementPlusPlugin from './element-plus'

export default function createVitePlugins(viteEnv: ImportMetaEnv) {
  const { VITE_ENABLE_DEVTOOLS, VITE_APP_VERSION } = viteEnv

  const vitePlugins: (PluginOption | PluginOption[])[] = [vue(), tailwindcss()]
  vitePlugins.push(createAppInfoPlugin(VITE_APP_VERSION))
  vitePlugins.push(createAutoImportPlugin())
  vitePlugins.push(creaetComponentsPlugin())
  vitePlugins.push(createElementPlusPlugin())
  vitePlugins.push(createDevtoolsPlugin(VITE_ENABLE_DEVTOOLS))
  vitePlugins.push(createCompressionPlugin())
  return vitePlugins
}
