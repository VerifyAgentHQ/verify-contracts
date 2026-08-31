# Contract versioning

JSON Schema is the canonical representation. This repository uses semantic-versioning concepts for each public contract. Every versioned document includes a `schemaVersion` field; consumers should use that field together with the schema identified by its `$id`.

The current repository state is the pre-release foundation for the first public `1.0.0` contract set. The schemas remain `1.0.0` while this foundation is being accepted and has not been externally released or consumed. Version names use `MAJOR.MINOR.PATCH`:

- A patch release clarifies documentation or fixes a schema defect without changing valid consumer behavior.
- A minor release may add optional fields or otherwise extend a contract compatibly.
- A major release is required for breaking changes, including changing or adding required fields, removing a field, changing a type incompatibly, or changing the meaning of an existing field.

Deprecated fields remain documented for at least one supported major version where practical. A deprecation should be documented with a replacement and removal target. Consumers should migrate by accepting the old and new versions during a transition, then selecting the new version explicitly.

The version belongs to the contract, not the implementation package. Producers identify it in `schemaVersion`; schemas identify themselves with `$id`. A breaking revision should get a new major version and migration notes before adoption. No contract is silently reinterpreted.
