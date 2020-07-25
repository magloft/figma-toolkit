import { Canvas, Client, ClientInterface, Component, FileResponse } from 'figma-js'
import { homedir } from 'os'
import { join } from 'path'
import { FigmaLoader } from './FigmaLoader'

export interface FigmaDocumentOptions {
  fileId: string
  accessToken: string
  cachePath?: string
}

export class FigmaDocument {
  private client: ClientInterface
  private file!: FileResponse
  private loader: FigmaLoader

  static async load(options: FigmaDocumentOptions) {
    const document = new FigmaDocument(options)
    await document.load()
    return document
  }

  constructor(private options: FigmaDocumentOptions) {
    this.client = Client({ personalAccessToken: this.options.accessToken })
    this.loader = new FigmaLoader(this.client, this.options.fileId, options.cachePath ?? join(homedir(), '.figma-toolkit.cache.json'))
  }

  async load() {
    this.file = (await this.client.file(this.options.fileId)).data
  }

  extractComponents(pages: Canvas[]) {
    return pages.reduce<Component[]>((arr, page) => {
      const components = page.children.filter((child) => child.type === 'COMPONENT') as Component[]
      arr.push(...components)
      return arr
    }, [])
  }

  async downloadComponents(components: Component[]) {
    const list = await this.loader.download(components)
    return list.reduce<{ [key: string]: string }>((obj, { name, contents }) => {
      if (contents) { obj[name] = contents }
      return obj
    }, {})
  }

  getPage(name: string) {
    return this.file.document.children.find((page) => page.name === name) as Canvas | undefined
  }

  getPages(name?: string) {
    if (name) {
      const page = this.getPage(name)
      return page ? [page] : []
    }
    return this.file.document.children as Canvas[]
  }
}
