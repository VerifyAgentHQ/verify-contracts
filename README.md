# verify-contracts

`verify-contracts` contains versioned public and wire contracts for VerifyAgent APIs, verification results, sandbox communication, and agent interoperability. JSON Schema is canonical so Node.js, TypeScript, and non-TypeScript consumers can share the same boundary definitions.

```text
verify-contracts
      ^       ^
      |       |
verify-agent  verify-sandbox
```

`verify-agent` owns internal domain models and `verify-sandbox` owns sandbox implementation. This repository defines only stable information exchanged across those boundaries; it contains no application, sandbox, API server, database, provider integration, or generated SDK.

Initial contracts cover common values, verification requests/results, sandbox jobs, provider-neutral agent services, and minimal attestations. OpenAPI remains a placeholder until the public API surface is finalized.

## Development

Install with pnpm, then run `pnpm check`. Individual commands are `pnpm format`, `pnpm typecheck`, `pnpm validate`, and `pnpm test`. Examples under `examples/` are validated by the test suite.

Schemas use JSON Schema Draft 2020-12. Each contract carries a `schemaVersion` and a stable `$id`; see [docs/VERSIONING.md](docs/VERSIONING.md) for compatibility and migration policy.

Contributions should justify new public fields, update examples and tests with contract changes, and preserve compatibility where possible. Read [AGENTS.md](AGENTS.md) before making changes.
