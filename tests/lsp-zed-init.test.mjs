import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { patchFile } from '../scripts/patch-x18n-lsp-for-zed.mjs'
import { withServer } from './helpers/lsp-stdio.mjs'

const PKG = join(process.cwd(), 'node_modules/@x18n/lsp')

test('patched server uses worktreeRoot over Zed config rootUri', async () => {
  const copy = await mkdtemp(join(tmpdir(), 'x18n-lsp-copy-'))
  const lig = await mkdtemp(join(tmpdir(), 'x18n-lig-'))
  const zedConfig = await mkdtemp(join(tmpdir(), 'x18n-zed-config-'))

  try {
    await cp(join(PKG, 'bin.mjs'), join(copy, 'bin.mjs'))
    await cp(join(PKG, 'package.json'), join(copy, 'package.json'))
    await cp(join(PKG, 'dist'), join(copy, 'dist'), { recursive: true })
    await symlink(join(process.cwd(), 'node_modules'), join(copy, 'node_modules'))
    const src = join(copy, 'dist/src.mjs')
    const bin = join(copy, 'bin.mjs')
    assert.equal(patchFile(src), true, 'expected v2 patch to apply')

    await mkdir(join(lig, 'locales'), { recursive: true })
    await writeFile(
      join(lig, 'x18n.config.json'),
      JSON.stringify({
        sourceLocale: 'en',
        locales: [{ code: 'en', files: ['locales/en.json'] }],
      }),
    )
    await writeFile(join(lig, 'locales/en.json'), JSON.stringify({ hello: 'Hello' }))

    await withServer(bin, async ({ request, notify }) => {
      await request('initialize', {
        processId: null,
        rootUri: `file://${zedConfig}`,
        workspaceFolders: [],
        capabilities: {},
        initializationOptions: { worktreeRoot: lig, showFlags: false },
      })
      notify('initialized', {})
      const explain = await request('x18n/explain', null)
      assert.match(String(explain), new RegExp(lig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      assert.doesNotMatch(String(explain), new RegExp(zedConfig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    })
  } finally {
    await rm(copy, { recursive: true, force: true })
    await rm(lig, { recursive: true, force: true })
    await rm(zedConfig, { recursive: true, force: true })
  }
})
