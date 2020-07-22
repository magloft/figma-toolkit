import { Command, command, option, Options, param } from 'clime'
import { writeFileSync } from 'fs'
import { stdout } from 'process'
import { FigmaDocument } from '../'

export class GenerateOptions extends Options {
  @option({ flag: 'v', description: 'verbose', toggle: true, default: false }) verbose = false
  @option({ flag: 'a', description: 'access token', default: process.env.FIGMA_ACCESS_TOKEN }) accessToken?: string
  @option({ flag: 'o', description: 'output file' }) output?: string
}

@command({ description: 'Generate SVG Icon Pack from Figma' })
export default class GenerateCommand extends Command {
  async execute(
    @param({ name: 'fileId', description: 'Figma File ID', required: true }) fileId: string,
    @param({ name: 'pageName', description: 'Figma Page Name', required: true }) pageName: string,
    { accessToken, verbose, output }: GenerateOptions
  ) {
    if (!accessToken) { return 'Missing Figma personal access token. Please provide via --access-token or FIGMA_ACCESS_TOKEN environment variable.' }
    this.log(`loading Figma document '${fileId}'`, verbose)
    const document = await FigmaDocument.load({ fileId, accessToken })
    this.log(`generating Icon Pack for page '${pageName}'`, verbose)
    const iconPack = await document.getIconPack(pageName)
    await iconPack.optimize()
    const contents = iconPack.export()
    const jsonData = JSON.stringify(contents, null, 2)
    if (output) {
      writeFileSync(output, jsonData, 'utf8')
    } else {
      stdout.write(jsonData)
    }
  }

  log(message: string, verbose = true) {
    if (!verbose) { return }
    console.info(`~> ${message}`)
  }
}
