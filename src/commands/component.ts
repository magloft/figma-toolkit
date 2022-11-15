import * as svgjs from '@svgdotjs/svg.js'
import { Command, command, option, Options, param } from 'clime'
import { Canvas, Component } from 'figma-js'
import { writeFileSync } from 'fs'
import { existsSync, mkdirpSync, readFileSync } from 'fs-extra'
import { dirname, resolve } from 'path'
import { createSVGWindow } from 'svgdom'
import * as uuid from 'uuid'
import { FigmaDocument } from '../classes/FigmaDocument'

export interface ComponentJson {
  fileId: string
  pageName: string
  mappings: {
    name: string
    output: string
  }[]
}

export class ComponentOptions extends Options {
  @option({ flag: 'v', description: 'verbose', toggle: true, default: false }) verbose = false
  @option({ flag: 'a', description: 'access token', default: process.env.FIGMA_ACCESS_TOKEN }) accessToken?: string
}

export function loadSvg(svg: string): SVGSVGElement {
  const window = createSVGWindow();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (svgjs as any).registerWindow(window, window.document)
  const canvas = svgjs.SVG(window.document.documentElement)
  canvas.svg(svg)
  return window.document.documentElement.firstElementChild
}

export type ParserTarget = 'fill' | 'stroke' | 'href'

export interface ParserInstruction {
  target: ParserTarget
  args: string[]
}

const ID_REGEX = /^\$(fill|stroke|href)\(([a-zA-Z0-9\s,]+)\)/

export function parseId(id: string): ParserInstruction | null {
  const match = id.match(ID_REGEX)
  if (!match) { return null }
  const target = match[1] as ParserTarget
  const args = match[2].replace(/\s/g, '').split(',')
  return { target, args }
}

@command({ description: 'Generate Angular Component Template from figma SVG' })
export default class ComponentCommand extends Command {
  async execute(@param({ name: 'input', description: 'path to components.json', required: true }) input: string, { accessToken, verbose }: ComponentOptions) {
    if (!accessToken) { return 'Missing Figma personal access token. Please provide via --access-token or FIGMA_ACCESS_TOKEN environment variable.' }
    if (!existsSync(input)) { return `No components JSON found at ${resolve(input)}` }
    const { fileId, pageName, mappings }: ComponentJson = JSON.parse(readFileSync(input, 'utf8'))
    this.log(`loading Figma document '${fileId}'`, verbose)
    const document = await FigmaDocument.load({ fileId, accessToken })
    const page = document.extract<Canvas>([document.root], 'CANVAS').find(({ name }) => name === pageName)
    if (!page) { return `Page '${pageName}' doesn't exist` }
    const components = document.extract<Component>([page], 'COMPONENT')
    const svgs = await document.download(components)
    for (const mapping of mappings) {
      const component = components.find((entry) => entry.name === mapping.name)
      if (!component) { return `Component '${mapping.name}' doesn't exist` }
      const svg = svgs[component.name]
      if (!svg) { return `No SVG export found for '${component.name}'` }

      const element = loadSvg(svg)
      element.removeAttribute('width')
      element.removeAttribute('height')
      for (const node of element.querySelectorAll('[id]')) {
        const instruction = parseId(node.getAttribute('id')!)
        if (instruction) {
          if (instruction.target === 'href') {
            const id = `image-${uuid.v4()}`
            node.setAttribute('fill', `url(#${id})`)
            // Retrieve or create defs
            const defs = element.querySelector('defs') ?? (() => {
              const el = element.ownerDocument.createElement('defs') as unknown as SVGDefsElement
              element.appendChild(el)
              return el
            })()
            // Create pattern
            const pattern = element.ownerDocument.createElement('pattern') as unknown as SVGPatternElement
            pattern.id = id
            pattern.setAttribute('patternContentUnits', 'objectBoundingBox')
            pattern.setAttribute('width', '100%')
            pattern.setAttribute('height', '100%')
            defs.appendChild(pattern)
            // Create image
            const image = element.ownerDocument.createElement('image') as unknown as SVGImageElement
            image.setAttribute('preserveAspectRatio', 'none')
            image.setAttribute('width', '1')
            image.setAttribute('height', '1')
            image.setAttribute('[attr.xlink:href]', `image([${instruction.args.map((arg) => `'${arg}'`).join(', ')}])`)
            pattern.appendChild(image)
          } else {
            let defaultValue = ''
            if (node.hasAttribute(instruction.target)) {
              defaultValue = `, '${node.getAttribute(instruction.target)!}'`
              node.removeAttribute(instruction.target)
            }
            node.setAttribute(`[attr.${instruction.target}]`, `color([${instruction.args.map((arg) => `'${arg}'`).join(', ')}]${defaultValue})`)
          }
          node.removeAttribute('id')
        }
      }

      mkdirpSync(dirname(mapping.output))
      writeFileSync(mapping.output, element.outerHTML, 'utf8')
      this.log(`generated ${mapping.output}`, verbose)
    }
  }

  log(message: string, verbose = true) {
    if (!verbose) { return }
    console.info(`~> ${message}`)
  }
}
