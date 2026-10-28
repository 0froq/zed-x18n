import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'

const SERVER = join(process.cwd(), 'node_modules/@x18n/lsp/bin.mjs')

function writeMessage(stream, message) {
  const body = JSON.stringify(message)
  stream.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`)
}

async function readMessage(stream) {
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
    return JSON.parse(body)
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

async function withServer(run) {
  const child = spawn(process.execPath, [SERVER, '--stdio'], {
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  child.stdout.resume()
  let nextId = 1

  async function request(method, params) {
    const id = nextId++
    writeMessage(child.stdin, { jsonrpc: '2.0', id, method, params })
    while (true) {
      const message = await readMessage(child.stdout)
      if (message.id === id) {
        if (message.error) throw new Error(message.error.message)
        return message.result
      }
    }
  }

  function notify(method, params) {
    writeMessage(child.stdin, { jsonrpc: '2.0', method, params })
  }

  try {
    return await run({ request, notify })
  } finally {
    child.kill()
  }
}

test('x18n-lsp responds to initialize with expected capabilities', async () => {
  const root = await mkdtemp(join(tmpdir(), 'x18n-zed-smoke-'))
  await mkdir(join(root, 'locales'), { recursive: true })
  await writeFile(
    join(root, 'x18n.config.json'),
    JSON.stringify({
      sourceLocale: 'en',
      locales: [{ code: 'en', files: ['locales/en.json'] }],
    }),
  )
  await writeFile(join(root, 'locales/en.json'), JSON.stringify({ hello: 'Hello' }))

  await withServer(async ({ request, notify }) => {
    const result = await request('initialize', {
      processId: null,
      rootUri: `file://${root}`,
      capabilities: {},
      initializationOptions: { showFlags: false },
    })
    notify('initialized', {})
    assert.equal(result.serverInfo.name, 'x18n')
    assert.equal(result.capabilities.hoverProvider, true)
    assert.equal(result.capabilities.renameProvider.prepareProvider, true)
    const codeActions = result.capabilities.codeActionProvider
    const kinds = codeActions === true ? [] : codeActions.codeActionKinds
    assert.ok(kinds.includes('quickfix'))
  })
})
