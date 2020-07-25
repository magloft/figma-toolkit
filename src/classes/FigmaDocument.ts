import Axios from 'axios'
import { createHash } from 'crypto'
import { Client, ClientInterface, Component, FileImageParams, FileResponse, Node } from 'figma-js'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export interface FigmaDocumentOptions {
  fileId: string
  accessToken: string
  cachePath?: string
}

export class FigmaDocument {
  private client: ClientInterface
  private file!: FileResponse
  private cache: { [key: string]: string }

  static async load(options: FigmaDocumentOptions) {
    const document = new FigmaDocument(options)
    await document.loadFile()
    return document
  }

  constructor(private options: FigmaDocumentOptions) {
    this.client = Client({ personalAccessToken: this.options.accessToken })
    this.cache = existsSync(this.cachePath) ? JSON.parse(readFileSync(this.cachePath, 'utf8')) : {}
  }

  async loadFile() {
    this.file = (await this.client.file(this.options.fileId)).data
  }

  extract<T = Node>(nodes: Node[], type?: string, result: T[] = []) {
    for (const node of nodes) {
      if (!type || node.type === type) { result.push(node as unknown as T) }
      const { children } = (node as { children?: Node[] })
      if (children) { this.extract(children, type, result) }
    }
    return result as T[]
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
    this.writeCache()
    return components.reduce<{ [key: string]: string }>((obj, { id, name }) => {
      const image = images.find((img) => id === img.id)
      const contents = image ? this.cache[this.hash(image.url)] : null
      if (contents) { obj[name] = contents }
      return obj
    }, {})
  }

  writeCache() {
    writeFileSync(this.cachePath, JSON.stringify(this.cache), 'utf8')
  }

  private async exportImages(ids: string[], params: Partial<FileImageParams> = { 'format': 'svg', 'svg_include_id': true, 'svg_simplify_stroke': true }) {
    const response = await this.client.fileImages(this.options.fileId, { ids, ...params })
    if (response.data.err) { return [] }
    return Object.entries(response.data.images).map(([id, url]) => ({ id, url, hash: this.hash(url) }))
  }

  private hash(data: string) {
    return createHash('md5').update(data).digest('hex')
  }

  get root() {
    return this.file.document
  }

  private get cachePath() {
    return this.options.cachePath ?? join(homedir(), '.figma-toolkit.cache.json')
  }
}
