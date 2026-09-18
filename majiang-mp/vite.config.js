import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

/* 让分包目录下的 static 资源能按绝对路径引用。
 *
 * uni-app 的 copy 插件已经会把 <分包root>/static/** 拷进产物（见
 * vite-plugin-uni/dist/plugins/copy.js 里的 parseSubpackagesRootOnce），
 * 但负责解析的 uni:static 插件只认 /static/** 和 /uni_modules/x/static/**，
 * 于是 <image src="/pkg-cards/static/..."> 会被 rollup 当成模块去解析并报错。
 * 这里补上分包那一段，行为和 uni:static 保持一致：直接把路径原样当 URL 返回。
 */
const SUBPACKAGE_STATIC = /^\/pkg-[\w-]+\/static\/.+\.\w+$/

function subpackageStatic() {
  return {
    name: 'majiang:subpackage-static',
    enforce: 'pre',
    resolveId(id) {
      return SUBPACKAGE_STATIC.test(id) ? id : undefined
    },
    load(id) {
      return SUBPACKAGE_STATIC.test(id) ? `export default ${JSON.stringify(id)}` : undefined
    },
  }
}

export default defineConfig({
  plugins: [
    subpackageStatic(),
    uni(),
  ],
})
