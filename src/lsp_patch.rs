use std::{fs, path::Path};

pub const LSP_SRC_REL: &str = "dist/src.mjs";

const INITIALIZE_BLOCK_ORIGINAL: &str = "\t\tconst folders = params.workspaceFolders?.map((folder) => fileURLToPath(folder.uri)) ?? (params.rootUri ? [fileURLToPath(params.rootUri)] : []);\n\t\tthis.folders = folders;\n\t\tthis.watchRegistration = params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration === true;\n\t\tconst settings = params.initializationOptions;";

const INITIALIZE_BLOCK_V1: &str = "\t\tconst _x18nMapped = params.workspaceFolders?.map((folder) => fileURLToPath(folder.uri)); const folders = _x18nMapped?.length ? _x18nMapped : (params.rootUri ? [fileURLToPath(params.rootUri)] : []);\n\t\tthis.folders = folders;\n\t\tthis.watchRegistration = params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration === true;\n\t\tconst settings = params.initializationOptions;";

const INITIALIZE_BLOCK_V2: &str = "\t\tconst _x18nMapped = params.workspaceFolders?.map((folder) => fileURLToPath(folder.uri));\n\t\tconst settings = params.initializationOptions;\n\t\tlet folders = _x18nMapped?.length ? _x18nMapped : [];\n\t\tif (folders.length === 0 && typeof settings?.worktreeRoot === \"string\" && settings.worktreeRoot.trim()) folders = [settings.worktreeRoot];\n\t\telse if (folders.length === 0 && params.rootUri) folders = [fileURLToPath(params.rootUri)];\n\t\tthis.folders = folders;\n\t\tthis.watchRegistration = params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration === true;";

const PATCH_V2_MARKER: &str = "settings.worktreeRoot.trim()";

const WORKTREE_ROOT_MARKER_V1: &str =
    "if (this.folders.length === 0 && typeof settings?.worktreeRoot === \"string\") this.folders = [settings.worktreeRoot];";

/// Rewrites `@x18n/lsp` initialize handling for Zed sending `workspaceFolders: []`.
pub fn patch_x18n_lsp_src(content: &str) -> Option<String> {
    if content.contains(PATCH_V2_MARKER) && content.contains("let folders = _x18nMapped") {
        return None;
    }

    let mut next = content.to_string();
    let mut changed = false;

    if next.contains(INITIALIZE_BLOCK_V1) {
        next = next.replace(INITIALIZE_BLOCK_V1, INITIALIZE_BLOCK_V2);
        changed = true;
    } else if next.contains(INITIALIZE_BLOCK_ORIGINAL) {
        next = next.replace(INITIALIZE_BLOCK_ORIGINAL, INITIALIZE_BLOCK_V2);
        changed = true;
    }

    let v1_marker_line = format!("\n\t\t{WORKTREE_ROOT_MARKER_V1}");
    if next.contains(WORKTREE_ROOT_MARKER_V1) {
        next = next.replace(&v1_marker_line, "");
        changed = true;
    }

    if changed { Some(next) } else { None }
}

pub fn lsp_src_path_from_bin(bin_path: &str) -> String {
    let path = Path::new(bin_path);
    path.parent()
        .map(|dir| dir.join(LSP_SRC_REL).to_string_lossy().into_owned())
        .unwrap_or_else(|| LSP_SRC_REL.to_string())
}

pub fn ensure_patched_lsp_src(src_path: &str) -> Result<bool, String> {
    let original = fs::read_to_string(src_path)
        .map_err(|err| format!("failed to read {src_path}: {err}"))?;
    let Some(patched) = patch_x18n_lsp_src(&original) else {
        return Ok(false);
    };
    fs::write(src_path, patched).map_err(|err| format!("failed to write {src_path}: {err}"))?;
    Ok(true)
}

/// When patching the workspace copy fails (common with pnpm symlinks under WASI), use the
/// extension-managed install instead so the v2 Zed compatibility patch still applies.
pub fn server_bin_after_patch_attempt(
    local_bin: &str,
    patch_local: Result<bool, String>,
    bundled_bin: &str,
) -> Result<String, String> {
    match patch_local {
        Ok(_) => Ok(local_bin.to_string()),
        Err(_) => Ok(bundled_bin.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn falls_back_to_bundled_when_local_patch_read_fails() {
        let local = "/project/node_modules/@x18n/lsp/bin.mjs";
        let bundled = "/extensions/work/x18n-language-server/node_modules/@x18n/lsp/bin.mjs";
        let chosen = server_bin_after_patch_attempt(
            local,
            Err("failed to read: No such file".into()),
            bundled,
        )
        .unwrap();
        assert_eq!(chosen, bundled);
    }

    #[test]
    fn keeps_local_when_patch_succeeds_or_is_already_applied() {
        let local = "/project/node_modules/@x18n/lsp/bin.mjs";
        let bundled = "/extensions/work/node_modules/@x18n/lsp/bin.mjs";
        assert_eq!(
            server_bin_after_patch_attempt(local, Ok(true), bundled).unwrap(),
            local
        );
        assert_eq!(
            server_bin_after_patch_attempt(local, Ok(false), bundled).unwrap(),
            local
        );
    }

    #[test]
    fn patches_pristine_initialize_block() {
        let sample = format!("async initialize(params) {{\n{INITIALIZE_BLOCK_ORIGINAL}\n\t\treturn {{}};\n}}");
        let patched = patch_x18n_lsp_src(&sample).expect("patch");
        assert!(patched.contains(PATCH_V2_MARKER));
        assert!(patched.contains("let folders = _x18nMapped"));
    }

    #[test]
    fn upgrades_v1_patch_to_v2() {
        let sample = format!(
            "async initialize(params) {{\n{INITIALIZE_BLOCK_V1}\n\t\tif (typeof settings?.showFlags === \"boolean\") {{}}\n\t\t{WORKTREE_ROOT_MARKER_V1}\n}}"
        );
        let patched = patch_x18n_lsp_src(&sample).expect("upgrade");
        assert!(patched.contains(PATCH_V2_MARKER));
        assert!(!patched.contains(WORKTREE_ROOT_MARKER_V1));
    }

    #[test]
    fn idempotent_when_v2_present() {
        let sample = format!("async initialize(params) {{\n{INITIALIZE_BLOCK_V2}\n}}");
        assert!(patch_x18n_lsp_src(&sample).is_none());
    }
}
