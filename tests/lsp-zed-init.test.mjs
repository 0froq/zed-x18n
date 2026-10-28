import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { patchFile } from '../scripts/patch-x18n-lsp-for-zed.mjs'

const SRC = join(process.cwd(), 'node_modules/@x18n/lsp/dist/src.mjs')
const BIN = join(process.cwd(), 'node_modules/@x18n/lsp/bin.mjs')

function writeMessage(stream, message) {
  const body = JSON.stringify(message)
  stream.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`)
}

async function readResponse(stream, id) {
  let buffer = Buffer.alloc(0)
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n')
    if (headerEnd === -1) {
      const chunk = await readChunk(stream)
      if (!chunk) throw new Error('stream closed before header')
      buffer = Buffer.concat([buffer, chunk])
      continue
    }
    const header = buffer.slice(0, headerEnd).toString('utf8')
    const match = /Content-Length:\s*(\d+)/i.exec(header)
    if (!match) throw new Error(`missing Content-Length in header: ${header}`)
    const length = Number.parseInt(match[1], 10)
    const start = headerEnd + 4
    while (buffer.length < start + length) {
      const chunk = await readChunk(stream)
      if (!chunk) throw new Error('stream closed before body')
      buffer = Buffer.concat([buffer, chunk])
    }
    const body = buffer.slice(start, start + length).toString('utf8')
    buffer = buffer.slice(start + length)
    const message = JSON.parse(body)
    if (message.id === id) {
      if (message.error) throw new Error(message.error.message)
      return message.result
    }
  }
}

function readChunk(stream) {
  return new Promise((resolve) => {
    if (stream.readableEnded) return resolve(null)
    const onReadable = () => {
      const chunk = stream.read()
      if (chunk) {
        cleanup()
        resolve(chunk)
      }
    }
    const onEnd = () => {
      cleanup()
      resolve(null)
    }
    const cleanup = () => {
      stream.off('readable', onReadable)
      stream.off('end', onEnd)
    }
    stream.on('readable', onReadable)
    stream.on('end', onEnd)
    onReadable()
  })
}

test('patched server uses worktreeRoot over Zed config rootUri', async () => {
  const original = readFileSync(SRC)
  assert.equal(patchFile(SRC), true, 'expected v2 patch to apply or upgrade')

  const lig = await mkdtemp(join(tmpdir(), 'x18n-lig-'))
  const zedConfig = await mkdtemp(join(tmpdir(), 'x18n-zed-config-'))
  const child = spawn(process.execPath, [BIN, '--stdio'], { stdio: ['pipe', 'pipe', 'inherit'] })
  child.stdout.resume()
  try {
    await mkdir(join(lig, 'locales'), { recursive: true })
    await writeFile(
      join(lig, 'x18n.config.json'),
      JSON.stringify({
        sourceLocale: 'en',
        locales: [{ code: 'en', files: ['locales/en.json'] }],
      }),
    )
    await writeFile(join(lig, 'locales/en.json'), JSON.stringify({ hello: 'Hello' }))

    writeMessage(child.stdin, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        processId: null,
        rootUri: `file://${zedConfig}`,
        workspaceFolders: [],
        capabilities: {},
        initializationOptions: { worktreeRoot: lig, showFlags: false },
      },
    })

    await readResponse(child.stdout, 1)
    writeMessage(child.stdin, { jsonrpc: '2.0', method: 'initialized', params: {} })
    writeMessage(child.stdin, { jsonrpc: '2.0', id: 2, method: 'x18n/explain', params: null })

    const explain = await readResponse(child.stdout, 2)
    assert.match(String(explain), new RegExp(lig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.doesNotMatch(String(explain), new RegExp(zedConfig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  } finally {
    child.kill()
    writeFileSync(SRC, original)
    await rm(lig, { recursive: true, force: true })
    await rm(zedConfig, { recursive: true, force: true })
  }
})
