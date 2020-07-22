import SVGO = require('svgo')
import { optimizeSvg } from './utils'

export class IconPack {
  constructor(private icons: Map<string, string>) {

  }

  async optimize(options: Partial<SVGO.Options> = {}) {
    const entries = Array.from(this.icons.entries())
    await Promise.all(entries.map(async ([name, contents]) => { this.icons.set(name, await optimizeSvg(contents, options)) }))
  }

  export() {
    return Array.from(this.icons.entries()).reduce<{ [key: string]: string }>((obj, [name, contents]) => {
      obj[name] = contents
      return obj
    }, {})
  }
}
