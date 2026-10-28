import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { patchX18nLspSrc, resolveZedWorkspaceFolders } from '../scripts/patch-x18n-lsp-for-zed.mjs'

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
  const input = `\t\tconst folders = params.workspaceFolders?.map((folder) => fileURLToPath(folder.uri)) ?? (params.rootUri ? [fileURLToPath(params.rootUri)] : []);
\t\tthis.folders = folders;
\t\tthis.watchRegistration = params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration === true;
\t\tconst settings = params.initializationOptions;`
  const out = patchX18nLspSrc(`async initialize(params) {\n${input}\n}`)
  assert.ok(out?.includes('settings.worktreeRoot.trim()'))
  assert.ok(out?.includes('let folders = _x18nMapped'))
})
