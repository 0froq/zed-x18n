use std::{fs, path::Path};

pub const LSP_SRC_REL: &str = "dist/src.mjs";

const INITIALIZE_BLOCK_ORIGINAL: &str =
    include_str!("../scripts/lsp-patch-blocks/initialize-original.txt");
const INITIALIZE_BLOCK_V1: &str = include_str!("../scripts/lsp-patch-blocks/initialize-v1.txt");
const INITIALIZE_BLOCK_V2: &str = include_str!("../scripts/lsp-patch-blocks/initialize-v2.txt");
const WORKTREE_ROOT_MARKER_V1: &str =
    include_str!("../scripts/lsp-patch-blocks/worktree-root-marker-v1.txt");

const PATCH_V2_MARKER: &str = "settings.worktreeRoot.trim()";

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

    if changed {
        Some(next)
    } else {
        None
    }
}

pub fn lsp_src_path_from_bin(bin_path: &str) -> String {
    let path = Path::new(bin_path);
    path.parent()
        .map(|dir| dir.join(LSP_SRC_REL).to_string_lossy().into_owned())
        .unwrap_or_else(|| LSP_SRC_REL.to_string())
}

pub fn ensure_patched_lsp_src(src_path: &str) -> Result<bool, String> {
    let original =
        fs::read_to_string(src_path).map_err(|err| format!("failed to read {src_path}: {err}"))?;
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
) -> String {
    match patch_local {
        Ok(_) => local_bin.to_string(),
        Err(_) => bundled_bin.to_string(),
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
        );
        assert_eq!(chosen, bundled);
    }

    #[test]
    fn keeps_local_when_patch_succeeds_or_is_already_applied() {
        let local = "/project/node_modules/@x18n/lsp/bin.mjs";
        let bundled = "/extensions/work/node_modules/@x18n/lsp/bin.mjs";
        assert_eq!(
            server_bin_after_patch_attempt(local, Ok(true), bundled),
            local
        );
        assert_eq!(
            server_bin_after_patch_attempt(local, Ok(false), bundled),
            local
        );
    }

    #[test]
    fn lsp_src_sits_beside_bin() {
        assert_eq!(
            lsp_src_path_from_bin("/repo/node_modules/@x18n/lsp/bin.mjs"),
            "/repo/node_modules/@x18n/lsp/dist/src.mjs"
        );
    }

    #[test]
    fn ensure_patched_errors_when_src_missing() {
        let err = ensure_patched_lsp_src("/no/such/@x18n/lsp/dist/src.mjs").unwrap_err();
        assert!(err.contains("failed to read"));
    }

    #[test]
    fn ensure_patched_writes_then_is_idempotent() {
        let path = std::env::temp_dir().join(format!(
            "x18n-lsp-patch-{}-{}.mjs",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let sample = format!("async initialize(params) {{\n{INITIALIZE_BLOCK_ORIGINAL}\n}}");
        fs::write(&path, sample).unwrap();
        let path_str = path.to_str().expect("utf-8 temp path");
        assert!(ensure_patched_lsp_src(path_str).unwrap());
        let written = fs::read_to_string(&path).unwrap();
        assert!(written.contains(PATCH_V2_MARKER));
        assert!(!ensure_patched_lsp_src(path_str).unwrap());
        fs::remove_file(&path).unwrap();
    }

    #[test]
    fn patches_pristine_initialize_block() {
        let sample = format!(
            "async initialize(params) {{\n{INITIALIZE_BLOCK_ORIGINAL}\n\t\treturn {{}};\n}}"
        );
        let patched = patch_x18n_lsp_src(&sample).expect("patch");
        assert!(patched.contains(PATCH_V2_MARKER));
        assert!(patched.contains("let folders = _x18nMapped"));
        assert!(patched.contains(INITIALIZE_BLOCK_V2));
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
