import Axios from 'axios'
import { createHash } from 'crypto'
import { ClientInterface, Component, FileImageParams } from 'figma-js'
import { existsSync, readFileSync, writeFileSync } from 'fs'

export class FigmaLoader {
  private cache: { [key: string]: string }

  constructor(private client: ClientInterface, private fileId: string, private cachePath: string) {
    this.cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {}
  }

  async download(components: Component[], params?: Partial<FileImageParams>) {
    const ids = components.map(({ id }) => id)
    const images = await this.exportImages(ids, params)
    const keys = Object.keys(this.cache)
    await Promise.all(images.map(async ({ url, hash }) => {
      if (keys.includes(hash)) { return }
      const response = await Axios.get<string>(url).catch(() => null)
      if (!response) { return }
      this.cache[hash] = response.data
    }))
    this.save()
    return components.map(({ id, name }) => {
      const image = images.find((img) => id === img.id)
      const contents = image ? this.cache[this.hash(image.url)] : null
      return { name, contents }
    })
  }

  save() {
    writeFileSync(this.cachePath, JSON.stringify(this.cache), 'utf8')
  }

  private async exportImages(ids: string[], params: Partial<FileImageParams> = { 'format': 'svg', 'svg_include_id': true, 'svg_simplify_stroke': true }) {
    const response = await this.client.fileImages(this.fileId, { ids, ...params })
    if (response.data.err) { return [] }
    return Object.entries(response.data.images).map(([id, url]) => ({ id, url, hash: this.hash(url) }))
  }

  private hash(data: string) {
    return createHash('md5').update(data).digest('hex')
  }
}
