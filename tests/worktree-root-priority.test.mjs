import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  INITIALIZE_BLOCK_ORIGINAL,
  INITIALIZE_BLOCK_V2,
  patchX18nLspSrc,
  resolveZedWorkspaceFolders,
} from '../scripts/patch-x18n-lsp-for-zed.mjs'

test('worktreeRoot wins over misleading rootUri when workspaceFolders is empty', () => {
  const lig = '/Users/dev/lig'
  const zedConfig = '/Users/dev/.config/zed'
  const folders = resolveZedWorkspaceFolders(
    {
      workspaceFolders: [],
      rootUri: `file://${zedConfig}`,
      initializationOptions: { worktreeRoot: lig },
    },
    (uri) => fileURLToPath(uri),
  )
  assert.deepEqual(folders, [lig])
})

test('whitespace worktreeRoot falls back to rootUri', () => {
  const zedConfig = '/Users/dev/.config/zed'
  const folders = resolveZedWorkspaceFolders(
    {
      workspaceFolders: [],
      rootUri: `file://${zedConfig}`,
      initializationOptions: { worktreeRoot: '   ' },
    },
    (uri) => fileURLToPath(uri),
  )
  assert.deepEqual(folders, [zedConfig])
})

test('populated workspaceFolders are unchanged', () => {
  const lig = '/Users/dev/lig'
  const folders = resolveZedWorkspaceFolders(
    {
      workspaceFolders: [{ uri: `file://${lig}`, name: 'lig' }],
      rootUri: 'file:///wrong',
      initializationOptions: { worktreeRoot: '/other' },
    },
    (uri) => fileURLToPath(uri),
  )
  assert.deepEqual(folders, [lig])
})

test('v2 patch embeds worktreeRoot priority', () => {
  const out = patchX18nLspSrc(`async initialize(params) {\n${INITIALIZE_BLOCK_ORIGINAL}\n}`)
  assert.equal(out?.includes(INITIALIZE_BLOCK_V2), true)
  assert.ok(out?.includes('settings.worktreeRoot.trim()'))
})
