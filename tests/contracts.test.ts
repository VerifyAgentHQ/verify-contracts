import * as Ajv2020Module from "ajv/dist/2020.js";
import * as AddFormatsModule from "ajv-formats";
import assert from "node:assert/strict";
import { glob, readFile } from "node:fs/promises";
import { describe, it } from "node:test";

type Validator = {
  addSchema(schema: object): void;
  getSchema(id: string): ((data: unknown) => boolean) | undefined;
  compile(schema: object): (data: unknown) => boolean;
};
type AjvConstructor = new (options: object) => Validator;
const Ajv2020 = (Ajv2020Module as unknown as { default: AjvConstructor })
  .default;
const addFormats = (
  AddFormatsModule as unknown as { default: (instance: Validator) => void }
).default;

const schemaFiles: string[] = [];
for await (const file of glob("schemas/**/*.schema.json"))
  schemaFiles.push(file);
const schemas = new Map<string, object>();
for (const file of schemaFiles)
  schemas.set(file, JSON.parse(await readFile(file, "utf8")) as object);
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
for (const schema of schemas.values()) ajv.addSchema(schema);

const ids = {
  result:
    "https://contracts.verifyagent.dev/schemas/verification/verification-result.schema.json",
  request:
    "https://contracts.verifyagent.dev/schemas/verification/verification-request.schema.json",
  sandboxRequest:
    "https://contracts.verifyagent.dev/schemas/sandbox/sandbox-job-request.schema.json",
  sandboxResult:
    "https://contracts.verifyagent.dev/schemas/sandbox/sandbox-job-result.schema.json",
  agent:
    "https://contracts.verifyagent.dev/schemas/agent/agent-service.schema.json",
  attestation:
    "https://contracts.verifyagent.dev/schemas/attestation/attestation.schema.json",
};
const exampleFiles = new Map([
  ["examples/verification-result.json", ids.result],
  ["examples/verification-request.json", ids.request],
  ["examples/sandbox-job-request.json", ids.sandboxRequest],
  ["examples/sandbox-job-result.json", ids.sandboxResult],
  ["examples/agent-service.json", ids.agent],
  ["examples/attestation.json", ids.attestation],
]);
const data = (id: string, value: unknown) => {
  const validate = ajv.getSchema(id);
  assert.ok(validate, `schema not registered: ${id}`);
  return validate(value);
};

describe("public contracts", () => {
  it("loads every schema with the exact Draft 2020-12 URI and absolute id", () => {
    assert.ok(schemaFiles.length > 0);
    for (const schema of schemas.values()) {
      const value = schema as { $schema?: unknown; $id?: unknown };
      assert.equal(
        value.$schema,
        "https://json-schema.org/draft/2020-12/schema",
      );
      assert.equal(typeof value.$id, "string");
      assert.doesNotThrow(() => new URL(value.$id as string));
      assert.match(
        value.$id as string,
        /^https:\/\/contracts\.verifyagent\.dev\//,
      );
      assert.doesNotMatch(value.$id as string, /\[[^\]]+\]\(/);
    }
  });

  it("resolves every schema and reference", () => {
    for (const schema of schemas.values())
      assert.doesNotThrow(() => ajv.compile(schema));
  });

  it("validates every example against its intended schema", async () => {
    for (const [file, id] of exampleFiles)
      data(id, JSON.parse(await readFile(file, "utf8")));
  });

  it("accepts valid verification request and result semantics", () => {
    assert.equal(
      data(ids.request, {
        schemaVersion: "1.0.0",
        target: { provider: "git", reference: "https://example.invalid/repo" },
        sourceState: { type: "commit", value: "commit-abc" },
      }),
      true,
    );
    assert.equal(
      data(ids.result, {
        verificationId: "verification-1",
        schemaVersion: "1.0.0",
        target: { provider: "source", reference: "repo-1" },
        sourceState: { type: "snapshot", value: "snapshot-1" },
        status: "partial",
        summary: "Some checks were unavailable.",
        findings: [],
        coverage: {
          verified: [],
          partial: ["typescript.test"],
          unsupported: [],
          notApplicable: [],
        },
        policyDecision: {
          policyId: "default",
          policyVersion: "1.0.0",
          outcome: "allow",
          triggeredRuleIds: [],
        },
        createdAt: "2026-08-31T10:00:00Z",
      }),
      true,
    );
  });

  it("defines distinct lifecycle statuses for findings, checks, verification, and sandbox jobs", () => {
    const common = [...schemas.values()].find(
      (schema) =>
        (schema as { title?: string }).title ===
        "VerifyAgent common definitions",
    ) as {
      $defs: {
        FindingStatus: { enum: string[] };
        CheckStatus: { enum: string[] };
        VerificationStatus: { enum: string[] };
        SandboxStatus: { enum: string[] };
        PolicyOutcome: { enum: string[] };
      };
    };
    assert.deepEqual(common.$defs.FindingStatus.enum, [
      "open",
      "resolved",
      "dismissed",
      "superseded",
    ]);
    assert.deepEqual(common.$defs.CheckStatus.enum, [
      "passed",
      "failed",
      "error",
      "timed_out",
      "cancelled",
      "skipped",
    ]);
    assert.deepEqual(common.$defs.VerificationStatus.enum, [
      "pass",
      "needs_review",
      "needs_changes",
      "blocked",
      "partial",
      "error",
    ]);
    assert.deepEqual(common.$defs.SandboxStatus.enum, [
      "completed",
      "failed",
      "timed_out",
      "cancelled",
      "error",
    ]);
    assert.deepEqual(common.$defs.PolicyOutcome.enum, [
      "allow",
      "needs_review",
      "needs_changes",
      "block",
    ]);
  });

  it("rejects missing fields, bad versions, identifiers, hashes, severities, and URIs", () => {
    assert.equal(
      data(ids.request, {
        schemaVersion: "1.0.0",
        target: { provider: "source", reference: "r" },
      }),
      false,
    );
    assert.equal(
      data(ids.result, {
        verificationId: "bad id",
        schemaVersion: "9.0.0",
        target: { provider: "source", reference: "r" },
        sourceState: { type: "commit", value: "s" },
        status: "invalid",
        summary: "x",
        findings: [],
        coverage: {
          verified: [],
          partial: [],
          unsupported: [],
          notApplicable: [],
        },
        createdAt: "not-a-date",
      }),
      false,
    );
    assert.equal(
      data(ids.attestation, {
        schemaVersion: "1.0.0",
        attestationId: "a",
        verificationResultId: "v",
        issuer: "i",
        subject: "s",
        issuedAt: "2026-08-31T10:00:00Z",
        payloadHash: "not-a-hash",
      }),
      false,
    );
    assert.equal(
      data(ids.agent, {
        schemaVersion: "1.0.0",
        serviceId: "service-1",
        name: "Agent",
        endpoint: "not a uri",
        capabilities: [
          { capabilityId: "x", name: "x", version: "1.0.0", description: "x" },
        ],
      }),
      false,
    );
    assert.equal(
      data(ids.result, {
        verificationId: "v",
        schemaVersion: "1.0.0",
        target: { provider: "source", reference: "r" },
        sourceState: { type: "commit", value: "s" },
        status: "pass",
        summary: "x",
        findings: [
          {
            id: "f",
            severity: "urgent",
            title: "x",
            description: "x",
            status: "open",
            evidenceReferences: ["e"],
          },
        ],
        coverage: {
          verified: [],
          partial: [],
          unsupported: [],
          notApplicable: [],
        },
        createdAt: "2026-08-31T10:00:00Z",
      }),
      false,
    );
  });

  it("accepts traceable findings and rejects findings without evidence", () => {
    const base = {
      verificationId: "v",
      schemaVersion: "1.0.0",
      target: { provider: "source", reference: "r" },
      sourceState: { type: "commit", value: "s" },
      status: "needs_review",
      summary: "Review required.",
      coverage: {
        verified: [],
        partial: [],
        unsupported: [],
        notApplicable: [],
      },
      createdAt: "2026-08-31T10:00:00Z",
      policyDecision: {
        policyId: "default",
        policyVersion: "1.0.0",
        outcome: "allow",
        triggeredRuleIds: [],
      },
    };
    assert.equal(
      data(ids.result, {
        ...base,
        findings: [
          {
            id: "f",
            severity: "medium",
            title: "Issue",
            description: "Details",
            status: "open",
            locations: [
              {
                path: "src/check.ts",
                startLine: 4,
                startColumn: 2,
                endLine: 4,
                endColumn: 9,
              },
            ],
            evidenceReferences: ["evidence-1"],
            producer: { type: "analyzer", name: "checker", version: "1.0.0" },
            confidence: 0.8,
          },
        ],
      }),
      true,
    );
    assert.equal(
      data(ids.result, {
        ...base,
        findings: [
          {
            id: "f",
            severity: "medium",
            title: "Issue",
            description: "Details",
            status: "open",
            message: "ambiguous",
            evidenceReferences: ["evidence-1"],
          },
        ],
      }),
      false,
    );
    assert.equal(
      data(ids.result, {
        ...base,
        findings: [
          {
            id: "f",
            severity: "medium",
            title: "Issue",
            description: "Details",
            status: "open",
            evidenceReferences: [],
          },
        ],
      }),
      false,
    );
  });

  it("enforces sandbox status and safe policy values", () => {
    const request = {
      schemaVersion: "1.0.0",
      jobId: "job-1",
      source: { provider: "source", reference: "r" },
      snapshot: "s",
      commands: ["check"],
      resourceLimits: { timeoutMs: 1000, memoryLimitBytes: 1024 },
      networkPolicy: "none",
      artifactPolicy: "none",
    };
    assert.equal(data(ids.sandboxRequest, request), true);
    assert.equal(
      data(ids.sandboxRequest, { ...request, networkPolicy: "full" }),
      false,
    );
    assert.equal(
      data(ids.sandboxRequest, { ...request, artifactPolicy: "all" }),
      false,
    );
    assert.equal(
      data(ids.sandboxResult, {
        schemaVersion: "1.0.0",
        jobId: "job-1",
        status: "timed_out",
        durationMs: 1000,
        logsRef: "logs/job-1.txt",
        artifactRefs: [],
        resourceUsage: { memoryBytes: 1, cpuTimeMs: 1 },
        errors: [],
      }),
      true,
    );
    assert.equal(
      data(ids.sandboxResult, {
        schemaVersion: "1.0.0",
        jobId: "job-1",
        status: "passed",
        durationMs: 1,
        logsRef: "logs/job-1.txt",
        artifactRefs: [],
        resourceUsage: { memoryBytes: 1, cpuTimeMs: 1 },
        errors: [],
      }),
      false,
    );
  });

  it("requires capability identity, source-state structure, and policy decision traceability", () => {
    assert.equal(
      data(ids.agent, {
        schemaVersion: "1.0.0",
        serviceId: "service-1",
        name: "Agent",
        endpoint: "https://example.invalid/agent",
        capabilities: [{ name: "x", version: "1.0.0", description: "x" }],
      }),
      false,
    );
    assert.equal(
      data(ids.request, {
        schemaVersion: "1.0.0",
        target: { provider: "source", reference: "r" },
        sourceState: { type: "branch", value: "main" },
      }),
      false,
    );
    assert.equal(
      data(ids.result, {
        verificationId: "v",
        schemaVersion: "1.0.0",
        target: { provider: "source", reference: "r" },
        sourceState: { type: "commit", value: "s" },
        status: "pass",
        summary: "Verified.",
        findings: [],
        coverage: {
          verified: [],
          partial: [],
          unsupported: [],
          notApplicable: [],
        },
        policyDecision: {
          policyId: "default",
          policyVersion: "1.0.0",
          outcome: "allow",
          triggeredRuleIds: [],
        },
        createdAt: "2026-08-31T10:00:00Z",
      }),
      true,
    );
    assert.equal(
      data(ids.attestation, {
        schemaVersion: "1.0.0",
        attestationId: "a",
        verificationResultId: "v",
        issuer: "i",
        subject: "s",
        issuedAt: "2026-08-31T10:00:00Z",
        payloadHash:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        version: "1.0.0",
      }),
      false,
    );
    assert.equal(
      data(ids.result, {
        verificationId: "v",
        schemaVersion: "1.0.0",
        target: { provider: "source", reference: "r" },
        sourceState: { type: "commit", value: "s" },
        status: "pass",
        summary: "Verified.",
        findings: [],
        coverage: {
          verified: [],
          partial: [],
          unsupported: [],
          notApplicable: [],
        },
        policyDecision: {
          policyId: "default",
          policyVersion: "1.0.0",
          outcome: "pass",
          triggeredRuleIds: [],
        },
        createdAt: "2026-08-31T10:00:00Z",
      }),
      false,
    );
  });
});
