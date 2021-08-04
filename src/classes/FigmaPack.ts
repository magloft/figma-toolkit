import * as cheerio from 'cheerio'
import { mkdirpSync, writeFileSync } from 'fs-extra'
import * as htmlMinifier from 'html-minifier'
import { join, resolve } from 'path'
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

export interface SaveIconsOptions {
  width?: number
  height?: number
  viewBox?: string
  className?: string
  fill?: string
}

export class FigmaPack {
  constructor(private icons: { [key: string]: string }) { }

  async optimize(options: Partial<SVGO.Options> = {}) {
    await Promise.all(Object.entries(this.icons).map(async ([name, contents]) => {
      this.icons[name] = await this.optimizeSvg(contents, options)
    }))
  }

  exportObject() {
    return this.icons
  }

  exportJson() {
    return JSON.stringify(this.exportObject(), null, 2)
  }

  saveIcons(output: string = '.', { width, height, viewBox, fill, className }: SaveIconsOptions = {}) {
    const dir = resolve(output ?? '.')
    mkdirpSync(dir)

    const attributes: string[] = []
    if (width) { attributes.push(`width="${width}"`) }
    if (height) { attributes.push(`height="${height}"`) }
    if (viewBox) { attributes.push(`viewBox="${viewBox}"`) }
    if (fill) { attributes.push(`fill="${fill}"`) }
    if (className) { attributes.push(`class="${className}"`) }
    const attr = attributes.join(' ')

    for (const [name, icon] of Object.entries(this.icons)) {
      const data = `<svg ${attr} xmlns="http://www.w3.org/2000/svg">${icon}</svg>`
      const filepath = join(dir, `${name}.svg`)
      writeFileSync(filepath, data, 'utf8')
    }
  }

  async optimizeSvg(svgString: string, options: Partial<SVGO.Options> = {}) {
    const svgo = new SVGO({ ...SVGO_OPTIONS, ...options })
    const { data } = await svgo.optimize(svgString)
    const $ = cheerio.load(data, { xmlMode: true })
    const xml = $('svg').html()!
    return htmlMinifier.minify(xml, { collapseWhitespace: true, keepClosingSlash: true })
  }
}
