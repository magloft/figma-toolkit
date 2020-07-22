#!/usr/bin/env node

import { CLI, Shim } from 'clime'
import { join } from 'path'

CLI.commandModuleExtension = process.env.FT_DEBUG === 'YES' ? '.ts' : '.js'
const cli = new CLI('figma-toolkit', join(__dirname, 'commands'))

const shim = new Shim(cli)
shim.execute(process.argv).catch(console.error)
