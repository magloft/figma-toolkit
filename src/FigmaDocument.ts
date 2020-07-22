import axios from 'axios'
import { Canvas, Client, ClientInterface, Component, FileResponse } from 'figma-js'
import { IconPack } from './IconPack'

export interface FigmaDocumentOptions {
  fileId: string
  accessToken: string
}

export class FigmaDocument {
  private client: ClientInterface
  private file!: FileResponse

  static async load(options: FigmaDocumentOptions) {
    const document = new FigmaDocument(options)
    await document.load()
    return document
  }

  constructor(private options: FigmaDocumentOptions) {
    this.client = Client({ personalAccessToken: this.options.accessToken })
  }

  async load() {
    this.file = (await this.client.file(this.options.fileId)).data
  }

  async getIconPack(pageName: string) {
    const { fileId } = this.options
    const page: Canvas = this.file.document.children.find((child) => child.name === pageName) as Canvas
    const components = page.children as Component[]
    const ids = components.map(({ id }) => id)
    const { images } = (await this.client.fileImages(fileId, { ids, format: 'svg', 'svg_include_id': true, 'svg_simplify_stroke': true })).data
    const icons = new Map<string, string>()
    await Promise.all(components.map(async ({ id, name }) => { icons.set(name, (await axios.get(images[id])).data) }))
    return new IconPack(icons)
  }
}
