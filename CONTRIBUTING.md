# Contributing

This is a Zed extension (Rust → `wasm32-wasip2`) that wraps `@x18n/lsp`. General etiquette follows https://github.com/antfu/contribute. Repo-specific notes are in [`AGENTS.md`](./AGENTS.md). x18n’s own rules live in [x18n-dev/x18n](https://github.com/x18n-dev/x18n) (`AGENTS.md`, `CONTRIBUTING.md`); this repo is not that monorepo.

## Setup

You need Node.js >= 22 and Rust stable with the `wasm32-wasip2` target.

```sh
rustup target add wasm32-wasip2
npm install
```

## Checks

Before a PR, these MUST pass:

```sh
npm test
cargo test
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo build --release --target wasm32-wasip2
```

- `npm test` is Node’s test runner on `tests/*.test.mjs` (patch helper, stdio smoke, Zed initialize). It is not vitest, and it does not exercise the WASM module.
- `cargo test` is the Rust unit tests (server resolution, initialization options, the LSP patch, local-patch fallback).
- After a WASM build, load the repo with **Extensions → Install Dev Extension** in Zed.

There is no Zed in CI. Manual editor checks: [docs/e2e-smoke.md](./docs/e2e-smoke.md).

The initialize-block snippets for the Zed compatibility patch live in `scripts/lsp-patch-blocks/`. Rust and the Node helper both load those files.

Commit messages and PR titles follow [Conventional Commits](https://www.conventionalcommits.org/), for example `fix: prefer worktreeRoot over Zed rootUri`. Keep a PR to one change, and say what you ran to verify it.
