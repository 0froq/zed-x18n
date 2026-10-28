import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { patchFile, patchX18nLspSrc } from '../scripts/patch-x18n-lsp-for-zed.mjs'

const INITIALIZE_BLOCK_ORIGINAL = `\t\tconst folders = params.workspaceFolders?.map((folder) => fileURLToPath(folder.uri)) ?? (params.rootUri ? [fileURLToPath(params.rootUri)] : []);
\t\tthis.folders = folders;
\t\tthis.watchRegistration = params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration === true;
\t\tconst settings = params.initializationOptions;`

test('v2 patch replaces pristine initialize block', () => {
  const input = `async initialize(params) {\n${INITIALIZE_BLOCK_ORIGINAL}\n}`
  const out = patchX18nLspSrc(input)
  assert.ok(out?.includes('settings.worktreeRoot.trim()'))
})

test('patch applies to a copied dist fragment', () => {
  const dir = mkdtempSync(join(tmpdir(), 'x18n-patch-'))
  const copy = join(dir, 'src.mjs')
  writeFileSync(copy, `async initialize(params) {\n${INITIALIZE_BLOCK_ORIGINAL}\n}`)
  assert.equal(patchFile(copy), true)
  const patched = readFileSync(copy, 'utf8')
  assert.ok(patched.includes('settings.worktreeRoot.trim()'))
  rmSync(dir, { recursive: true, force: true })
})
