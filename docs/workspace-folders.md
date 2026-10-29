# Zed `workspaceFolders` and x18n

When `@x18n/lsp` logs `No workspace folder is open.` with a folder already open in Zed, `initialize` was sent with `workspaceFolders: []`. That is not the same as omitting `workspaceFolders`.

In `@x18n/lsp` 0.1.x (`dist/src.mjs`):

```javascript
const folders =
  params.workspaceFolders?.map((folder) => fileURLToPath(folder.uri))
  ?? (params.rootUri ? [fileURLToPath(params.rootUri)] : []);
```

`[]` is not `null`/`undefined`, so the `?? rootUri` fallback never runs.

## What other Zed extensions do

[biome-zed](https://github.com/biomejs/biome-zed) and [zed-i18n-lens](https://github.com/yizixu/zed-i18n-lens) implement `language_server_command` (and settings). They do not rewrite LSP traffic. Zed builds `initialize` in `LanguageServer::default_initialize_params` (`crates/lsp/src/lsp.rs`):

- No shared workspace-folder set: one folder from `root_uri`.
- A shared set that is still empty at init: `workspaceFolders: []` even when `rootUri` is set.

Zed may later send `didChangeWorkspaceFolders`. `@x18n/lsp` 0.1.x does not handle that notification.

This is a client/server contract mismatch, not missing wiring in the Rust extension. There is no Zed extension API to override `initialize.workspaceFolders`.

## What this extension does

It patches `@x18n/lsp` `dist/src.mjs` for servers it starts (extension-managed npm install, or the workspace copy when that file is writable):

1. Treat empty `workspaceFolders` like missing folders.
2. When recovering, prefer `initializationOptions.worktreeRoot` (Zed `worktree.root_path()`) before `rootUri`. Zed may send a misleading `rootUri` (for example `~/.config/zed`) while the edited project lives elsewhere.

The initialize-block snippets live in `scripts/lsp-patch-blocks/` and are loaded by both `src/lsp_patch.rs` and `scripts/patch-x18n-lsp-for-zed.mjs`.

If `useLocalServer` points at a workspace install but `dist/src.mjs` cannot be read (typical with pnpm symlinks under WASI), startup falls back to the extension-managed copy instead of a red language server.

Manual patch:

```sh
node scripts/run-patch-x18n-lsp.mjs path/to/node_modules/@x18n/lsp/dist/src.mjs
```

## Upstream

Useful fixes, not opened from this repo:

- **x18n/lsp**: treat `workspaceFolders?.length === 0` like absent folders; optionally handle `workspace/didChangeWorkspaceFolders`.
- **Zed**: when `pending_workspace_folders` is empty at init, fall back to `root_uri` instead of sending `[]`.

An `x18n.config.*` file is not required for the language server to start. Projects configured only via `.vscode/settings.json` (including i18n-ally presets) are valid once the project folder is visible to `@x18n/lsp`.
