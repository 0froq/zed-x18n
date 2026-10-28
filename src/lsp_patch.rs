use std::{fs, path::Path};

pub const LSP_SRC_REL: &str = "dist/src.mjs";

const INITIALIZE_LINE: &str = "const folders = params.workspaceFolders?.map((folder) => fileURLToPath(folder.uri)) ?? (params.rootUri ? [fileURLToPath(params.rootUri)] : []);";

const INITIALIZE_PATCHED: &str = "const _x18nMapped = params.workspaceFolders?.map((folder) => fileURLToPath(folder.uri)); const folders = _x18nMapped?.length ? _x18nMapped : (params.rootUri ? [fileURLToPath(params.rootUri)] : []);";

const WORKTREE_ROOT_MARKER: &str = "if (this.folders.length === 0 && typeof settings?.worktreeRoot === \"string\") this.folders = [settings.worktreeRoot];";

const SETTINGS_ANCHOR: &str =
    "if (typeof settings?.showFlags === \"boolean\") this.settings.showFlags = settings.showFlags;";

/// Rewrites `@x18n/lsp` initialize handling for Zed sending `workspaceFolders: []`.
pub fn patch_x18n_lsp_src(content: &str) -> Option<String> {
    if content.contains(WORKTREE_ROOT_MARKER) {
        return None;
    }

    let mut next = content.to_string();

    if !next.contains(INITIALIZE_PATCHED) {
        if !next.contains(INITIALIZE_LINE) {
            return None;
        }
        next = next.replacen(INITIALIZE_LINE, INITIALIZE_PATCHED, 1);
    }

    if !next.contains(WORKTREE_ROOT_MARKER) {
        if !next.contains(SETTINGS_ANCHOR) {
            return None;
        }
        next = next.replacen(
            SETTINGS_ANCHOR,
            &format!("{SETTINGS_ANCHOR}\n\t\t{WORKTREE_ROOT_MARKER}"),
            1,
        );
    }

    Some(next)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn patches_initialize_empty_workspace_folders() {
        let sample = format!(
            "async initialize(params) {{\n\t\t{INITIALIZE_LINE}\n\t\tthis.folders = folders;\n\t\tconst settings = params.initializationOptions;\n\t\t{SETTINGS_ANCHOR}\n\t}}"
        );
        let patched = patch_x18n_lsp_src(&sample).expect("patch");
        assert!(patched.contains("_x18nMapped?.length"));
        assert!(patched.contains(WORKTREE_ROOT_MARKER));
    }

    #[test]
    fn idempotent_second_pass() {
        let sample = format!(
            "async initialize(params) {{\n\t\t{INITIALIZE_LINE}\n\t\tconst settings = params.initializationOptions;\n\t\t{SETTINGS_ANCHOR}\n\t}}"
        );
        let once = patch_x18n_lsp_src(&sample).unwrap();
        assert!(patch_x18n_lsp_src(&once).is_none());
    }
}
