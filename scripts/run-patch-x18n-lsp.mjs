#!/usr/bin/env node
import { patchFile } from './patch-x18n-lsp-for-zed.mjs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const target = process.argv[2]
  ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', '@x18n', 'lsp', 'dist', 'src.mjs')

if (!patchFile(target)) {
  console.error(`No changes applied (already patched or unsupported layout): ${target}`)
  process.exit(1)
}
console.log(`Patched ${target}`)
