import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { patchFile, patchX18nLspSrc } from '../scripts/patch-x18n-lsp-for-zed.mjs'

const INITIALIZE_LINE =
  'const folders = params.workspaceFolders?.map((folder) => fileURLToPath(folder.uri)) ?? (params.rootUri ? [fileURLToPath(params.rootUri)] : []);'

test('patch replaces empty workspaceFolders handling', () => {
  const input = `async initialize(params) {\n\t\t${INITIALIZE_LINE}\n\t\tconst settings = params.initializationOptions;\n\t\tif (typeof settings?.showFlags === "boolean") this.settings.showFlags = settings.showFlags;\n\t}`
  const out = patchX18nLspSrc(input)
  assert.ok(out?.includes('_x18nMapped?.length'))
  assert.ok(out?.includes('settings?.worktreeRoot'))
})

test('patch applies to a copied dist fragment', () => {
  const input = `async initialize(params) {\n\t\t${INITIALIZE_LINE}\n\t\tconst settings = params.initializationOptions;\n\t\tif (typeof settings?.showFlags === "boolean") this.settings.showFlags = settings.showFlags;\n\t}`
  const dir = mkdtempSync(join(tmpdir(), 'x18n-patch-'))
  const copy = join(dir, 'src.mjs')
  writeFileSync(copy, input)
  assert.equal(patchFile(copy), true)
  const patched = readFileSync(copy, 'utf8')
  assert.ok(patched.includes('_x18nMapped?.length'))
  rmSync(dir, { recursive: true, force: true })
})
