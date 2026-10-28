import { readFileSync, writeFileSync } from 'node:fs'

const INITIALIZE_LINE =
  'const folders = params.workspaceFolders?.map((folder) => fileURLToPath(folder.uri)) ?? (params.rootUri ? [fileURLToPath(params.rootUri)] : []);'

const INITIALIZE_PATCHED =
  'const _x18nMapped = params.workspaceFolders?.map((folder) => fileURLToPath(folder.uri)); const folders = _x18nMapped?.length ? _x18nMapped : (params.rootUri ? [fileURLToPath(params.rootUri)] : []);'

const SETTINGS_ANCHOR =
  'if (typeof settings?.showFlags === "boolean") this.settings.showFlags = settings.showFlags;'

const WORKTREE_ROOT_MARKER =
  'if (this.folders.length === 0 && typeof settings?.worktreeRoot === "string") this.folders = [settings.worktreeRoot];'

export function patchX18nLspSrc(content) {
  if (content.includes(WORKTREE_ROOT_MARKER)) return null

  let next = content
  if (!next.includes(INITIALIZE_PATCHED)) {
    if (!next.includes(INITIALIZE_LINE)) return null
    next = next.replace(INITIALIZE_LINE, INITIALIZE_PATCHED)
  }

  if (!next.includes(WORKTREE_ROOT_MARKER)) {
    if (!next.includes(SETTINGS_ANCHOR)) return null
    next = next.replace(SETTINGS_ANCHOR, `${SETTINGS_ANCHOR}\n\t\t${WORKTREE_ROOT_MARKER}`)
  }

  return next
}

export function patchFile(srcPath) {
  const original = readFileSync(srcPath, 'utf8')
  const patched = patchX18nLspSrc(original)
  if (!patched) return false
  writeFileSync(srcPath, patched)
  return true
}
