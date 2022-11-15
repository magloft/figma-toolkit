import { constantCase } from 'change-case'
import { Command, command, option, Options, param } from 'clime'
import { Canvas, Component } from 'figma-js'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { Project, QuoteKind, VariableDeclarationKind } from 'ts-morph'
import { SemicolonPreference } from 'typescript'
import { FigmaDocument } from '../classes/FigmaDocument'
import { FigmaInput } from '../classes/FigmaInput'
import { FigmaPack } from '../classes/FigmaPack'

export class ReactOptions extends Options {
  @option({ flag: 'v', description: 'verbose', toggle: true, default: false }) verbose = false
  @option({ flag: 'a', description: 'access token', default: process.env.FIGMA_ACCESS_TOKEN }) accessToken?: string
  @option({ flag: 'o', description: 'output file', required: true }) output!: string
}

const FORMAT_OPTIONS = {
  semicolons: SemicolonPreference.Remove,
  ensureNewLineAtEndOfFile: true,
  baseIndentSize: 0,
  indentSize: 2,
  tabSize: 2,
  convertTabsToSpaces: true
}

@command({ description: 'Export figma page to svg' })
export default class ReactCommand extends Command {
  async execute(
    @param({ name: 'input', description: 'figma file page "FILE_ID/PAGE_NAME"', required: true }) input: FigmaInput,
    { accessToken, verbose, output }: ReactOptions
  ) {
    if (!accessToken) { return 'Missing Figma personal access token. Please provide via --access-token or FIGMA_ACCESS_TOKEN environment variable.' }

    this.log(`loading Figma document '${input.file}'`, verbose)
    const document = await FigmaDocument.load({ fileId: input.file, accessToken })
    const pages = document.extract<Canvas>([document.root], 'CANVAS').filter((page) => input.page ? page.name === input.page : true)
    const components = document.extract<Component>(pages, 'COMPONENT')
    const icons = await document.download(components)
    const pack = new FigmaPack(icons)

    // Generate css
    this.log('generating Icon Pack css', verbose)
    await pack.optimize()
    const css = this.createCss(pack)
    writeFileSync(join(output, 'Icon.module.css'), css, 'utf8')

    // Generate tsx
    this.log('generating Icon Pack tsx', verbose)
    const project = new Project({ manipulationSettings: { quoteKind: QuoteKind.Single, useTrailingCommas: false } })
    const sourceFile = project.createSourceFile(join(output, 'Icon.tsx'), undefined, { overwrite: true })
    sourceFile.addImportDeclaration({ defaultImport: 'clsx', moduleSpecifier: 'clsx' })
    sourceFile.addImportDeclaration({ namedImports: ['CSSProperties', 'FunctionComponent'], moduleSpecifier: 'react' })
    sourceFile.addImportDeclaration({ defaultImport: 'styles', moduleSpecifier: './Icon.module.css' })
    sourceFile.addEnum({
      name: 'ICON',
      isExported: true,
      members: pack.map((key) => ({ name: constantCase(key), value: key }))
    })
    sourceFile.addInterface({
      name: 'IconProps',
      isExported: true,
      properties: [
        { name: 'icon', type: 'ICON', hasQuestionToken: false },
        { name: 'className', type: 'string', hasQuestionToken: true },
        { name: 'style', type: 'CSSProperties', hasQuestionToken: true }
      ]
    })
    sourceFile.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{
        name: 'Icon',
        type: 'FunctionComponent<IconProps>',
        initializer: '({ icon, className, style}) => {\n return <div className={clsx(styles[`${icon}`], className, styles[\'icon\'], \'icon\')} style={style}></div>\n}'
      }],
      isExported: true
    })
    sourceFile.formatText(FORMAT_OPTIONS)
    project.saveSync()
  }

  private createCss(iconPack: FigmaPack) {
    const lines: string[] = ['.icon { width: 24px;height: 24px;display: inline-block;background-position: center center;background-repeat: no-repeat;background-size: contain;background-color: grey; }']
    iconPack.forEach((key, value) => {
      const icon = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">${value}</svg>`
      const base64 = Buffer.from(icon).toString('base64')
      lines.push(`.${key} { mask-image: url(data:image/svg+xml;base64,${base64}); }`)
    })
    return lines.join('\n')
  }

  log(message: string, verbose = true) {
    if (!verbose) { return }
    console.info(`~> ${message}`)
  }
}
