#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isV2Patched, patchFile } from './patch-x18n-lsp-for-zed.mjs'

const target = process.argv[2]
  ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', '@x18n', 'lsp', 'dist', 'src.mjs')

const current = readFileSync(target, 'utf8')
if (isV2Patched(current)) {
  console.log(`Already patched: ${target}`)
  process.exit(0)
}

if (!patchFile(target)) {
  console.error(`Unsupported @x18n/lsp layout (initialize block not found): ${target}`)
  process.exit(1)
}
console.log(`Patched ${target}`)
