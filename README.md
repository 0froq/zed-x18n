# x18n for Zed

Community Zed extension that wraps the official [`@x18n/lsp`](https://www.npmjs.com/package/@x18n/lsp) language server from [x18n-dev/x18n](https://github.com/x18n-dev/x18n). i18n logic lives in the server; this repo only wires Zed to spawn it and forwards LSP features (hover, definition, references, rename, completion, diagnostics, code actions, inlay hints, code lens).

This is a **prototype** maintained in [0froq/zed-x18n](https://github.com/0froq/zed-x18n). If the x18n team wants an official Zed extension, this repo is offered for upstream adoption.

License: [MIT](./LICENSE)

## Prerequisites

- [Zed](https://zed.dev/) (recent build with extension API 0.7 / `wasm32-wasip2` extensions)
- **Node.js 22+** (required by `@x18n/lsp`)
- **Rust stable** with the `wasm32-wasip2` target (for building the extension WASM)

## Install as a dev extension

1. Clone this repository.
2. Build the WASM module:

   ```bash
   rustup target add wasm32-wasip2
   cargo build --release --target wasm32-wasip2
   ```

3. In Zed: **Extensions → Install Dev Extension** and select this repo root.
4. Grant extension capabilities when prompted (`npm:install` for `@x18n/lsp`, `process:exec` for Node).

See [docs/E2E-SMOKE.md](./docs/E2E-SMOKE.md) for a full local verification checklist.

## Language server binary resolution

Order (same idea as VS Code `x18n.useLocalServer`):

| Priority | Source | When |
| --- | --- | --- |
| 1 | `lsp.x18n.binary` in settings | Manual override (path + args; include `--stdio` if you point at `bin.mjs`) |
| 2 | `<worktree>/node_modules/@x18n/lsp/bin.mjs` | `useLocalServer` is true (default) and the package is installed |
| 3 | `npx -y @x18n/lsp@<version> --stdio` | `useNpx: true` in `lsp.x18n.settings` |
| 4 | Extension-managed npm install | Downloads `@x18n/lsp` into the extension work directory |

### Local debug (recommended)

In your x18n project:

```bash
npm install -D @x18n/lsp@0.1.1
```

Restart the x18n language server in Zed. The extension prefers this copy over the downloaded one.

Without a workspace install, the extension installs `@x18n/lsp` on first use (default version **0.1.1**, overridable via `serverVersion`).

## Zed settings

Configure under `lsp.x18n` in user or project `.zed/settings.json`:

```json
{
  "lsp": {
    "x18n": {
      "settings": {
        "useLocalServer": true,
        "useNpx": false,
        "serverVersion": "0.1.1",
        "displayLocale": "",
        "annotationMaxLength": 40,
        "codeLens": false,
        "showFlags": true
      }
    }
  }
}
```

These map to `@x18n/lsp` **initialization options** (see [VS Code surface docs](https://x18n.dev/raw/surfaces/vscode.md)).

### Parity with VS Code

| VS Code | Zed (this extension) |
| --- | --- |
| LSP hover, definition, references, rename, completion, diagnostics, extract code actions | Supported via LSP |
| Inlay hint annotations | Supported — enable **Inlay Hints** and **Show Other Hints** in Zed |
| In-place annotations (`x18n.annotationInPlace`, theme colors) | **Not supported** — VS Code uses buffer decorations; Zed has no equivalent yet |
| Activity bar views (Keys, Progress, Reviews, …) | **Not supported** — no Zed panel API equivalent |
| Webview UI (`x18n: Open UI`) | **Not supported** — use the x18n CLI or VS Code for the UI |
| Review comment threads in editor | **Not supported** |
| Status bar display locale picker | **Not supported** — set `displayLocale` in settings |
| `x18n.enabled` toggle | Disable by removing `x18n` from `language_servers` for a language in Zed settings |
| `x18n.trace.server` | Use Zed LSP trace settings if available |
| Config JSON/YAML schema validation | Use Zed JSON/YAML language support or CLI |

## Supported languages

The server is registered for JavaScript, JSX, TypeScript, TSX, Vue.js, JSON, JSONC, YAML, HTML, Svelte, and Astro (with VS Code-compatible LSP language IDs). The upstream server activates on workspace files broadly once an `x18n.config.*` or project layout is detected.

## Development

```bash
cargo test          # Rust unit tests (path resolution, settings mapping)
npm install && npm test   # stdio smoke test against @x18n/lsp
cargo build --release --target wasm32-wasip2
```

Architecture reference: [packages/vscode](https://github.com/x18n-dev/x18n/tree/main/packages/vscode) + [packages/lsp](https://github.com/x18n-dev/x18n/tree/main/packages/lsp). Zed wiring patterns inspired by [yizixu/zed-i18n-lens](https://github.com/yizixu/zed-i18n-lens) (different server — do not confuse).

## Sample project smoke test

1. Open a repo with `x18n.config.json` and locale files.
2. Install `@x18n/lsp` locally (see above).
3. Open a Vue/TS file using `t('key')`.
4. Confirm diagnostics, hover, go-to-definition, rename, and inlay hints.

Details: [docs/E2E-SMOKE.md](./docs/E2E-SMOKE.md).
