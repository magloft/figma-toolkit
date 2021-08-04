import { Command, command, option, Options, param } from 'clime'
import { Canvas, Component } from 'figma-js'
import { FigmaDocument } from '..'
import { FigmaPack } from '../classes/FigmaPack'

class FigmaInput {
  constructor(public file: string, public page?: string) { }

  static cast(path: string): FigmaInput {
    const [fileId, page] = path.split('/')
    return new FigmaInput(fileId, page)
  }
}

export class DownloadOptions extends Options {
  @option({ flag: 'v', description: 'verbose', toggle: true, default: false }) verbose = false
  @option({ flag: 'a', description: 'access token', default: process.env.FIGMA_ACCESS_TOKEN }) accessToken?: string
  @option({ flag: 'o', description: 'output directory' }) output?: string
  @option({ flag: 'w', description: 'icon width' }) width?: number
  @option({ flag: 'h', description: 'icon height' }) height?: number
  @option({ flag: 'b', description: 'icon viewBox' }) viewBox?: string
  @option({ flag: 'f', description: 'icon fill' }) fill?: string
  @option({ flag: 'c', description: 'icon class name' }) className?: string
}

@command({ description: 'Download figma symbols to individual svg documents' })
export default class DownloadCommand extends Command {
  async execute(
    @param({ name: 'input', description: 'figma file page "FILE_ID/PAGE_NAME"', required: true }) input: FigmaInput,
    { accessToken, verbose, output, width, height, viewBox, fill, className }: DownloadOptions
  ) {
    if (!accessToken) { return 'Missing Figma personal access token. Please provide via --access-token or FIGMA_ACCESS_TOKEN environment variable.' }
    this.log(`loading Figma document '${input.file}'`, verbose)
    const document = await FigmaDocument.load({ fileId: input.file, accessToken })
    const pages = document.extract<Canvas>([document.root], 'CANVAS').filter((page) => input.page ? page.name === input.page : true)
    const components = document.extract<Component>(pages, 'COMPONENT')
    this.log('generating Icon Pack', verbose)
    const icons = await document.download(components)
    const iconPack = new FigmaPack(icons)
    await iconPack.optimize()
    iconPack.saveIcons(output, { width, height, viewBox, fill, className })
  }

  log(message: string, verbose = true) {
    if (!verbose) { return }
    console.info(`~> ${message}`)
  }
}
