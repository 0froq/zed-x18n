# Local end-to-end smoke checklist (Zed + x18n)

Use this after installing the dev extension. It mirrors what the VS Code extension e2e covers at a high level without requiring Zed in CI.

## Prerequisites

- [ ] Node.js **22+** (`node -v`)
- [ ] Rust **stable** with `wasm32-wasip2` (`rustup target add wasm32-wasip2`)
- [ ] Zed with **Install Dev Extension** (Extensions → Install Dev Extension → this repo root)
- [ ] Sample project with locale files (with or without `x18n.config.*`; i18n-ally / `.vscode/settings.json` layouts are fine)

See [workspace-folders.md](./workspace-folders.md) if Zed log ever showed `No workspace folder is open.` — the dev extension patches `@x18n/lsp` automatically for servers it starts.

## Install server for local debug

Pick one:

1. **Workspace package (recommended, matches VS Code `x18n.useLocalServer`)**

   ```bash
   npm install -D @x18n/lsp@0.1.1
   ```

2. **Let the extension download** `@x18n/lsp` into the extension work directory on first start (needs npm install capability).

3. **npx fallback** — in settings set `"useNpx": true` under `lsp.x18n.settings` (uses `npx -y @x18n/lsp@<version> --stdio`).

## Zed settings (project `.zed/settings.json`)

```json
{
  "lsp": {
    "x18n": {
      "settings": {
        "useLocalServer": true,
        "displayLocale": "",
        "annotationMaxLength": 40,
        "codeLens": false,
        "showFlags": true
      }
    }
  },
  "inlay_hints": {
    "enabled": true,
    "show_other_hints": true
  }
}
```

Restart the language server after changing settings (Command Palette → **x18n: Restart Language Server** is VS Code only; in Zed use **Restart Language Server** for the worktree).

## Checks

- [ ] Open a file with `t('some.key')` — **diagnostics** appear for missing/invalid keys (same rules as `x18n check`).
- [ ] **Hover** on a key shows locale values.
- [ ] **Go to definition** on a key opens the locale entry.
- [ ] **Find references** lists usages in code.
- [ ] **Rename** (F2) updates key usages and locale files.
- [ ] **Completion** inside `t('…` suggests keys.
- [ ] **Code action** on a hard-coded string offers extract / ignore (when the server provides it).
- [ ] **Inlay hints** show annotation text when enabled (not in-place VS Code decorations).

## Troubleshooting

- Open **Zed.log** (`zed: open log`) if the server fails to start.
- Confirm the spawned command uses **`--stdio`** (this extension adds it for `node` and `npx` invocations).
- If no locales are found, run `x18n doctor` in the project CLI — the server logs similar guidance.
