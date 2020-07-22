import * as cheerio from 'cheerio'
import * as htmlMinifier from 'html-minifier'
import * as SVGO from 'svgo'

export const SVGO_OPTIONS: SVGO.Options = {
  plugins: [
    { convertShapeToPath: false },
    { mergePaths: false },
    { inlineStyles: { onlyMatchedOnce: false } },
    { removeAttrs: { attrs: '(fill|stroke.*)' } },
    { removeViewBox: false },
    { removeTitle: true },
    { removeHiddenElems: true }
  ]
}

export async function optimizeSvg(svgString: string, options: Partial<SVGO.Options> = {}) {
  const svgo = new SVGO({ ...SVGO_OPTIONS, ...options })
  const { data } = await svgo.optimize(svgString)
  const $ = cheerio.load(data, { xmlMode: true })
  const xml = $('svg').html()!
  return htmlMinifier.minify(xml, { collapseWhitespace: true, keepClosingSlash: true })
}
