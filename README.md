# x18n for Zed

Community Zed extension that starts [`@x18n/lsp`](https://www.npmjs.com/package/@x18n/lsp) from [x18n-dev/x18n](https://github.com/x18n-dev/x18n). All i18n logic lives in the language server. This repo only spawns it and maps Zed settings to LSP initialization options (hover, definition, usages, rename, completion, diagnostics, code actions, inlay hints, code lens).

Maintained in [0froq/zed-x18n](https://github.com/0froq/zed-x18n). Hosting inside the x18n monorepo is not decided.

License: [MIT](./LICENSE)

## Prerequisites

- [Zed](https://zed.dev/) with extension API 0.7 (`wasm32-wasip2` extensions)
- Node.js 22+ (required by `@x18n/lsp`)
- Rust stable with the `wasm32-wasip2` target, to build from source

## Install as a dev extension

1. Clone this repository.
2. Build the WASM module:

   ```sh
   rustup target add wasm32-wasip2
   cargo build --release --target wasm32-wasip2
   ```

3. In Zed: **Extensions → Install Dev Extension** and select this repo root.
4. Grant `npm:install` (`@x18n/lsp`) and `process:exec` (Node) when prompted.

Setup and check commands: [CONTRIBUTING.md](./CONTRIBUTING.md). Editor checklist: [docs/e2e-smoke.md](./docs/e2e-smoke.md).

## Language server resolution

Same idea as VS Code `x18n.useLocalServer`:

| Priority | Source | When |
| --- | --- | --- |
| 1 | `lsp.x18n.binary` | Manual override (include `--stdio` if you point at `bin.mjs`) |
| 2 | `<worktree>/node_modules/@x18n/lsp/bin.mjs` | `useLocalServer` is true (default) and `@x18n/lsp` is in the project |
| 3 | `npx -y @x18n/lsp@<version> --stdio` | `useNpx: true` and `npx` is on `PATH` |
| 4 | Extension-managed npm install | Downloads `@x18n/lsp` (default **0.1.3**) into the extension work directory |

Recommended for local debug: `npm install -D @x18n/lsp@0.1.3` in the i18n project, then restart the language server.

Before start, the extension patches `@x18n/lsp` so Zed’s empty `workspaceFolders: []` still resolves the open folder, and it always sends `worktreeRoot` in initialization options. With `useLocalServer`, it patches the workspace copy first; if that file cannot be read (common with **pnpm** symlinks under the WASM sandbox), it starts the extension-managed copy instead of failing. A custom `lsp.x18n.binary` skips this patch unless you run `node scripts/run-patch-x18n-lsp.mjs` on that install. Details: [docs/workspace-folders.md](./docs/workspace-folders.md).

An `x18n.config.*` file is not required for the server to start. i18n-ally-style `.vscode/settings.json` layouts are enough once the project root is visible to the server.

## Zed settings

In user or project `.zed/settings.json`:

```json
{
  "lsp": {
    "x18n": {
      "settings": {
        "useLocalServer": true,
        "useNpx": false,
        "serverVersion": "0.1.3",
        "displayLocale": "",
        "annotationMaxLength": 40,
        "codeLens": false,
        "showFlags": true
      }
    }
  }
}
```

`displayLocale`, `annotationMaxLength`, `codeLens`, and `showFlags` are `@x18n/lsp` initialization options (see [VS Code surface docs](https://x18n.dev/raw/surfaces/vscode.md)). Empty `displayLocale` means the source locale.

### VS Code features this surface does not cover

In-place annotations, activity bar views, the webview UI, review comment threads, and the status bar locale picker need VS Code APIs Zed does not have. Enable **Inlay Hints** and **Show Other Hints** in Zed for annotation text. Disable the server by removing `x18n` from `language_servers` for a language.

## Supported languages

JavaScript, JSX, TypeScript, TSX, Vue.js, JSON, JSONC, YAML, HTML, Svelte, and Astro (VS Code-compatible language IDs). The server indexes once it knows the project folder and finds resources.

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md). Upstream references: [packages/lsp](https://github.com/x18n-dev/x18n/tree/main/packages/lsp), [packages/vscode](https://github.com/x18n-dev/x18n/tree/main/packages/vscode). Zed wiring is similar to [yizixu/zed-i18n-lens](https://github.com/yizixu/zed-i18n-lens) (a different server).
