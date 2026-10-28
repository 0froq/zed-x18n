# Zed `workspaceFolders` and x18n

## What we observed

When x18n in Zed logs:

```text
No locale files found in the workspace.

No workspace folder is open.
```

the `@x18n/lsp` process received `workspaceFolders: []` during `initialize`. That is not the same as omitting `workspaceFolders`.

In `@x18n/lsp` 0.1.1 (`dist/src.mjs`):

```javascript
const folders =
  params.workspaceFolders?.map((folder) => fileURLToPath(folder.uri))
  ?? (params.rootUri ? [fileURLToPath(params.rootUri)] : []);
```

If Zed sends `workspaceFolders: []`, the optional chain yields `[]`, which is **not** `null`/`undefined`, so the `?? rootUri` fallback never runs.

## What other Zed extensions do

Extensions such as [biome-zed](https://github.com/biomejs/biome-zed) and [zed-i18n-lens](https://github.com/yizixu/zed-i18n-lens) only implement `language_server_command` (and settings). They do **not** rewrite LSP traffic or inject workspace folders. Zed’s client builds `initialize` in `LanguageServer::default_initialize_params` (`crates/lsp/src/lsp.rs`):

- If no shared workspace-folder set is attached, Zed sends a single folder derived from `root_uri`.
- If a shared set **exists** but is still empty at init time, Zed sends `workspaceFolders: []` even when `rootUri` is set.

Later, Zed may call `set_workspace_folders` / `didChangeWorkspaceFolders`, but `@x18n/lsp` 0.1.1 does not handle folder change notifications.

So this is a **client/server contract mismatch**, not missing wiring in our Rust extension.

## What this extension does

There is no Zed extension API to override `initialize.workspaceFolders`.

We apply a **small, documented compatibility patch** to `@x18n/lsp`’s `dist/src.mjs` when we start a server we control (extension-managed npm install, or workspace `node_modules` if the patch can be written):

1. Treat empty `workspaceFolders` like missing folders.
2. When recovering, prefer **`initializationOptions.worktreeRoot`** (set from Zed `worktree.root_path()`) **before** `rootUri`. Zed may send a misleading `rootUri` (for example `~/.config/zed`) while the edited project lives elsewhere.

The same patch is available manually:

```bash
node scripts/run-patch-x18n-lsp.mjs path/to/node_modules/@x18n/lsp/dist/src.mjs
```

## Upstream fixes (recommended)

- **x18n/lsp**: treat `workspaceFolders?.length === 0` like absent folders; optionally handle `workspace/didChangeWorkspaceFolders`.
- **Zed**: when `pending_workspace_folders` is empty at init, fall back to `root_uri` (same as the `None` branch) instead of sending `[]`.

This repo does not open issues on upstream trackers automatically; the above is for maintainers and froQ.

## Config files

An `x18n.config.*` file is **not** required for the language server to start. Projects configured only via `.vscode/settings.json` (e.g. i18n-ally presets migrated/zero-config layouts) are valid once the workspace folder is visible to `@x18n/lsp`.
