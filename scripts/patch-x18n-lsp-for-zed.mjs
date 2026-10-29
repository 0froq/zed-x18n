import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const blocksDir = join(dirname(fileURLToPath(import.meta.url)), 'lsp-patch-blocks')

function readBlock(name) {
  return readFileSync(join(blocksDir, name), 'utf8')
}

export const INITIALIZE_BLOCK_ORIGINAL = readBlock('initialize-original.txt')
export const INITIALIZE_BLOCK_V1 = readBlock('initialize-v1.txt')
export const INITIALIZE_BLOCK_V2 = readBlock('initialize-v2.txt')

const WORKTREE_ROOT_MARKER_V1 = readBlock('worktree-root-marker-v1.txt')
const PATCH_V2_MARKER = 'settings.worktreeRoot.trim()'

export function isV2Patched(content) {
  return content.includes(PATCH_V2_MARKER) && content.includes('let folders = _x18nMapped')
}

/** Same folder resolution as the v2 compatibility patch (for tests). */
export function resolveZedWorkspaceFolders(params, fileURLToPath) {
  const mapped = params.workspaceFolders?.map((folder) => fileURLToPath(folder.uri))
  const settings = params.initializationOptions
  let folders = mapped?.length ? mapped : []
  if (folders.length === 0 && typeof settings?.worktreeRoot === 'string' && settings.worktreeRoot.trim()) {
    folders = [settings.worktreeRoot]
  } else if (folders.length === 0 && params.rootUri) {
    folders = [fileURLToPath(params.rootUri)]
  }
  return folders
}

export function patchX18nLspSrc(content) {
  if (isV2Patched(content)) {
    return null
  }

  let next = content
  let changed = false

  if (next.includes(INITIALIZE_BLOCK_V1)) {
    next = next.replace(INITIALIZE_BLOCK_V1, INITIALIZE_BLOCK_V2)
    changed = true
  } else if (next.includes(INITIALIZE_BLOCK_ORIGINAL)) {
    next = next.replace(INITIALIZE_BLOCK_ORIGINAL, INITIALIZE_BLOCK_V2)
    changed = true
  }

  if (next.includes(WORKTREE_ROOT_MARKER_V1)) {
    next = next.replace(`\n\t\t${WORKTREE_ROOT_MARKER_V1}`, '')
    changed = true
  }

  return changed ? next : null
}

export function patchFile(srcPath) {
  const original = readFileSync(srcPath, 'utf8')
  const patched = patchX18nLspSrc(original)
  if (!patched) return false
  writeFileSync(srcPath, patched)
  return true
}
