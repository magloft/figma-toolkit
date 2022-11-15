import { Command, command, option, Options, param } from 'clime'
import { Canvas, Component } from 'figma-js'
import { writeFileSync } from 'fs'
import { stdout } from 'process'
import { FigmaDocument } from '..'
import { FigmaInput } from '../classes/FigmaInput'
import { FigmaPack } from '../classes/FigmaPack'

export class ExportOptions extends Options {
  @option({ flag: 'v', description: 'verbose', toggle: true, default: false }) verbose = false
  @option({ flag: 'a', description: 'access token', default: process.env.FIGMA_ACCESS_TOKEN }) accessToken?: string
  @option({ flag: 'o', description: 'output file' }) output?: string
}

@command({ description: 'Export figma page to svg' })
export default class ExportCommand extends Command {
  async execute(
    @param({ name: 'input', description: 'figma file page "FILE_ID/PAGE_NAME"', required: true }) input: FigmaInput,
    { accessToken, verbose, output }: ExportOptions
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
    const contents = iconPack.exportJson()
    if (output) {
      writeFileSync(output, contents, 'utf8')
    } else {
      stdout.write(contents)
    }
  }

  log(message: string, verbose = true) {
    if (!verbose) { return }
    console.info(`~> ${message}`)
  }
}
