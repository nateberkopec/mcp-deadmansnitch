# Invariant registry

Factory-owned index. Implementing agents use routed guardrails; rationale and future design live in `docs/PLAN.md`. The factory improver audits this file. Mark an invariant Enforced only with passing deterministic proof.

**Enforced** blocks violations. **Partial** has incomplete checks. **Guarded** relies on review. **Planned** awaits implementation.

## Repository

| ID | Invariant | Proof | Status |
|---|---|---|---|
| INV-001 | Rust and tools stay pinned through mise. | mise configs, orb scripts, dev-env check | Enforced |
| INV-002 | Rust, Clippy, and rustdoc produce no warnings. | lint task, CI | Enforced |
| INV-003 | Production Rust contains no unsafe code. | workspace lint, CI | Enforced |
| INV-004 | Code contains no comments. | comment linter, hk, CI | Enforced |
| INV-005 | Lint allowances are local and carry reasons. | Rust guardrail, review | Guarded |
| INV-006 | Dependencies use approved sources, licenses, versions, and workspace declarations. | cargo-deny, review | Enforced |
| INV-007 | Commits use conventional messages. | hk hook | Guarded |
| INV-008 | Architecture remains a version-free codemap. | doc-drift review | Guarded |

## Product

| ID | Invariant | Proof | Status |
|---|---|---|---|
| INV-010 | Dependency direction holds; twin shares no production code; conformance uses public boundaries. | architecture tests | Planned |
| INV-011 | External data becomes typed at boundaries; raw JSON stays in decoding. | client tests | Planned |
| INV-012 | Stateful logic uses an injected clock. | twin tests | Planned |
| INV-013 | Lists and results are typed, bounded, quiet, and stable. | golden and contract tests | Planned |
| INV-014 | Check-ins use upstream-provided URLs. | twin/client tests | Planned |

## Security

| ID | Invariant | Proof | Status |
|---|---|---|---|
| INV-020 | Credentials never enter output, logs, errors, debug data, commits, or reports. | gitleaks, canary tests | Partial |
| INV-021 | Upstream text remains framed as untrusted data. | adversarial tests | Planned |
| INV-022 | Requests allow three ten-second attempts, one-MiB responses, and bounded delays. | boundary tests | Planned |
| INV-023 | MCP and DMS credentials remain separate; bearer comparison is constant-time. | middleware tests | Planned |
| INV-024 | Secret scans never print values. | redacted gitleaks tasks | Enforced |
| INV-025 | Remote HTTP requires authentication and rejects disallowed origins. | transport tests | Planned |
| INV-026 | Tracing uses plain stderr and excludes credentials. | process tests | Planned |
| INV-027 | Configuration rejects the legacy API-key misspelling. | dev-env, config tests | Partial |

## MCP

| ID | Invariant | Proof | Status |
|---|---|---|---|
| INV-030 | Tool names and arguments are the strictest compatibility surface. | baseline, semver checks | Planned |
| INV-031 | Tools have five annotations, bounded structured output, and text parity. | contract tests | Planned |
| INV-032 | Renames retain one-major aliases and enter the changelog. | contract, release review | Planned |
| INV-033 | Protocol revision and tools stay fixed within a connection. | handshake tests | Planned |
| INV-034 | Exactly ten operation tools exist; dispatch and catalog tools do not. | registry snapshot | Planned |
| INV-035 | Check-in is opt-in; read-only mode excludes mutations. | registry tests | Planned |
| INV-036 | Delete elicits confirmation when supported and otherwise requests it. | capability tests | Planned |
| INV-037 | One registry controls allow, deny, read-only, and check-in precedence. | CLI tests | Planned |

## Proof

| ID | Invariant | Proof | Status |
|---|---|---|---|
| INV-040 | Ordinary tests use the twin; live calls are explicit validation. | isolation, CI | Enforced |
| INV-041 | Twin fidelity includes awkward statuses and legacy fields without shared code. | differential cases, holdouts | Planned |
| INV-042 | Frozen time, seeded tokens, and reset state make scenarios repeatable. | repeatability tests | Planned |
| INV-043 | Proof matches the changed layer; skipped proof is reported. | testing guardrail, review | Guarded |
| INV-044 | Client and twin state keep 100% coverage; other coverage never falls. | coverage gates | Planned |
| INV-045 | Warm fast tests stay under ten seconds; orb build plus tests under one minute. | timed gates | Planned |
| INV-046 | Live validation mutates only objects created by that run and halts on leftovers. | ownership tests | Planned |

## Factory and release

| ID | Invariant | Proof | Status |
|---|---|---|---|
| INV-050 | Post-Phase-0 work runs in isolated mise-backed Amp orbs. | executor tests | Planned |
| INV-051 | Exit codes, never models, decide deterministic gates. | gate tests | Partial |
| INV-052 | Only validation orbs receive DMS and holdout credentials. | Amp controls, access spike | Enforced |
| INV-053 | Passing CI and a reviewer with no further feedback permits merge; factory changes also need current-head human approval. | workflow, Factory Approval check | Partial |
| INV-054 | Publishing, destructive, paid-orb, and account actions require authority. | agent policy, authority controls | Guarded |
| INV-055 | Transcript analysis stores only aggregate sanitized evidence. | runbook, review, gitleaks | Guarded |
| INV-056 | Durable knowledge lives in repository docs. | operating-loop review | Guarded |
| INV-057 | Gates get five fresh attempts; exhaustion halts; later attempts read prior mistakes. | controller tests | Planned |
| INV-058 | Attempts branch; state persists; designated gates compare three attempts through an isolated reviewer. | recovery tests | Planned |
| INV-059 | Loops follow runbooks, report status, never self-merge, and recover through webhooks. | loop-health checks | Partial |
| INV-060 | Explicitly authorized release PRs create tags; cargo-dist builds tested tags. | release workflows | Planned |
| INV-061 | Actions use least privilege and immutable SHAs; crate publishing uses OIDC. | workflow policy | Partial |
| INV-062 | Releases cover four targets and carry provenance. | cargo-dist workflow | Planned |
