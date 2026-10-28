import { readFileSync, writeFileSync } from 'node:fs'

const INITIALIZE_LINE =
  'const folders = params.workspaceFolders?.map((folder) => fileURLToPath(folder.uri)) ?? (params.rootUri ? [fileURLToPath(params.rootUri)] : []);'

const INITIALIZE_BLOCK_ORIGINAL = `\t\t${INITIALIZE_LINE}
\t\tthis.folders = folders;
\t\tthis.watchRegistration = params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration === true;
\t\tconst settings = params.initializationOptions;`

const INITIALIZE_PATCHED_V1 =
  'const _x18nMapped = params.workspaceFolders?.map((folder) => fileURLToPath(folder.uri)); const folders = _x18nMapped?.length ? _x18nMapped : (params.rootUri ? [fileURLToPath(params.rootUri)] : []);'

const INITIALIZE_BLOCK_V1 = `\t\t${INITIALIZE_PATCHED_V1}
\t\tthis.folders = folders;
\t\tthis.watchRegistration = params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration === true;
\t\tconst settings = params.initializationOptions;`

export const INITIALIZE_BLOCK_V2 = `\t\tconst _x18nMapped = params.workspaceFolders?.map((folder) => fileURLToPath(folder.uri));
\t\tconst settings = params.initializationOptions;
\t\tlet folders = _x18nMapped?.length ? _x18nMapped : [];
\t\tif (folders.length === 0 && typeof settings?.worktreeRoot === "string" && settings.worktreeRoot.trim()) folders = [settings.worktreeRoot];
\t\telse if (folders.length === 0 && params.rootUri) folders = [fileURLToPath(params.rootUri)];
\t\tthis.folders = folders;
\t\tthis.watchRegistration = params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration === true;`

const PATCH_V2_MARKER = 'settings.worktreeRoot.trim()'

const WORKTREE_ROOT_MARKER_V1 =
  'if (this.folders.length === 0 && typeof settings?.worktreeRoot === "string") this.folders = [settings.worktreeRoot];'

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
  if (content.includes(PATCH_V2_MARKER) && content.includes('let folders = _x18nMapped')) {
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
