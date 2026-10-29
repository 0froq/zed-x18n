# zed-x18n maintainer guide

Zed extension that spawns [`@x18n/lsp`](https://www.npmjs.com/package/@x18n/lsp). i18n logic stays in the language server. This crate is Rust compiled to `wasm32-wasip2` through the Zed extension API.

This repo is a community prototype in [0froq/zed-x18n](https://github.com/0froq/zed-x18n). Hosting inside `x18n-dev/x18n` is not decided. Do not move the GitHub repo or open PRs against x18n-dev from here.

## Rules

- **MUST**, **MUST NOT**, **SHOULD** and **MAY** use RFC 2119 meanings.
- Before a PR, these MUST pass: `npm test && cargo test && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo build --release --target wasm32-wasip2`.
- Commits follow Conventional Commits.
- Names SHOULD follow the x18n glossary (resource, message, usage, plugin, preset, display locale, surface).
- Node helper tests MUST use `node --test` (`npm test`). The WASM extension MUST be tested with `cargo test`. Do not describe this crate as a vitest project.
- The `@x18n/lsp` initialize patch is a wire contract: keep Rust and the Node helper on `scripts/lsp-patch-blocks/`, and cover empty `workspaceFolders` with `worktreeRoot` before `rootUri`.
- WASI cannot always read pnpm symlink layouts. Local patch failure MUST fall back to the extension-managed server instead of failing start.

## Layout

| Path | What |
| --- | --- |
| `src/lib.rs` | Zed `Extension` implementation |
| `src/server_resolve.rs` | Server source, paths, initialization options |
| `src/lsp_patch.rs` | Compatibility patch applied to `@x18n/lsp` `dist/src.mjs` |
| `scripts/` | Node patch helper and shared initialize-block files |
| `tests/*.test.mjs` | Node helper and stdio tests against `@x18n/lsp` |
| `docs/` | Workspace-folder notes and a manual Zed checklist |

`language_server_command` and settings only. The extension MUST NOT rewrite JSON-RPC. Zed builds `initialize`; we pass `worktreeRoot` in initialization options and patch folder recovery in the server we start.
