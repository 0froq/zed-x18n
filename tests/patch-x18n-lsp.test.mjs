import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  INITIALIZE_BLOCK_ORIGINAL,
  isV2Patched,
  patchFile,
  patchX18nLspSrc,
} from '../scripts/patch-x18n-lsp-for-zed.mjs'

const SRC = join(process.cwd(), 'node_modules/@x18n/lsp/dist/src.mjs')

test('pinned @x18n/lsp dist still has the initialize block we patch', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.ok(
    src.includes(INITIALIZE_BLOCK_ORIGINAL),
    'dist initialize block changed; update scripts/lsp-patch-blocks',
  )
  assert.equal(isV2Patched(src), false)
})

test('package.json pins the same @x18n/lsp as DEFAULT_SERVER_VERSION', () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
  const rust = readFileSync(join(process.cwd(), 'src/server_resolve.rs'), 'utf8')
  const match = rust.match(/DEFAULT_SERVER_VERSION: &str = "([^"]+)"/)
  assert.ok(match, 'DEFAULT_SERVER_VERSION missing')
  assert.equal(pkg.devDependencies['@x18n/lsp'], match[1])
})

test('v2 patch replaces pristine initialize block', () => {
  const input = `async initialize(params) {\n${INITIALIZE_BLOCK_ORIGINAL}\n}`
  const out = patchX18nLspSrc(input)
  assert.ok(out?.includes('settings.worktreeRoot.trim()'))
  assert.ok(out?.includes('let folders = _x18nMapped'))
})

test('patch applies to a copied dist fragment', () => {
  const dir = mkdtempSync(join(tmpdir(), 'x18n-patch-'))
  const copy = join(dir, 'src.mjs')
  writeFileSync(copy, `async initialize(params) {\n${INITIALIZE_BLOCK_ORIGINAL}\n}`)
  assert.equal(patchFile(copy), true)
  const patched = readFileSync(copy, 'utf8')
  assert.ok(isV2Patched(patched))
  assert.equal(patchFile(copy), false)
  rmSync(dir, { recursive: true, force: true })
})
