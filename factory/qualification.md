# Factory qualification evidence

This record separates controlled local tests from live Amp/GitHub proof. Neither substitutes for the final owner-authorized seal.

## Controlled lifecycle checks

`factory/qualification.test.mjs` executes the production plugin against in-memory implementations of the Amp and GitHub interfaces. `factory/check.mjs` runs it locally and in CI. It covers startup/recovery, all eight mode registrations, orb executor selection, unauthorized-controller rejection, concurrent worker capacity, persistent worker reuse, attempt limits, third-attempt guidance, terminal usage, all four queue capacities, duplicate automation delivery, failure/cancellation, completion-write recovery, stale review heads, failed/incomplete CI, provenance rejection, and qualified merge accounting.

Qualification reproduced a lost-record defect: worker creation succeeded, its GitHub record failed, and a later attempt created another worker. Commit `67aa849` makes an existing reservation with no worker record block another creation. Recovering the orphan's identity still requires evidence; the guard prevents duplication without claiming automatic recovery.

These checks exercise real orchestration code but do not prove Amp delivery timing, GitHub permissions, webhook installation, automatic orb wake, or actual agent compliance. Checklist items requiring those observations remain open.

## Live evidence

- Chief `T-01a06e11-ff37-7193-bd63-40f47e1e8dee` owns control issue #4 at capacity 1. Startup reported readiness and waited. The reservation from an earlier failed launch was reused.
- At `e4e5bf2`, explicit setup passed in 24.773 seconds, resume passed twice in 1.027 and 1.045 seconds, and direct environment checks passed in 6.146 seconds. Both line-count tasks passed, the checkout stayed clean, and CI passed.
- Main's environment membership checks show both DMS and holdout variables absent, including under mise. A model initially misread a redaction marker as presence; the explicit boolean recheck corrected that finding.
- Read-only Amp inventory on 2026-09-05 found no main-project, personal, or workspace secrets. Twin-validation lists only `DEADMANSNITCH_API_KEY`; the private holdout project lists only `MCP_DEADMANSNITCH_HOLDOUT_TOKEN`. No values were inspected. Fresh runtime checks in those projects remain outstanding.
- Direct CLI and built-in mode discovery could not select the runtime-registered reviewer. The factory's own reviewer-launch path remains to be qualified through implementation issue #5.

## Invariant audit

Audited every Planned and Partial entry in `factory/invariants.md` against the current four scaffold crates, factory tools/checks, mise tasks, and workflows on 2026-09-05.

| Entries | Evidence and disposition |
|---|---|
| INV-001, INV-006 | Declarations and dependency checks exist, but complete toolchain parity and workspace-declaration enforcement do not. Marked Partial. |
| INV-010–014 | Domain, dependency-boundary, clock, decoding, and collection behavior are not implemented. Remain Planned. |
| INV-020 | Repository secret scanning exists; runtime leak/canary proof does not. Remains Partial with corrected proof text. |
| INV-021–023, INV-025–026 | Adversarial handling, bounded HTTP behavior, bearer authentication, and tracing await product implementation. Remain Planned. |
| INV-027 | The development check rejects the legacy spelling in .env; runtime parsing is still a scaffold. Remains Partial. |
| INV-030–037 | MCP tools, schemas, compatibility policy, registration, elicitation, and session invariants await product phases. Remain Planned. |
| INV-041–042, INV-044–046 | Twin fidelity, deterministic scenarios, coverage floors, timing bounds, and owned live-record cleanup lack product proof. Remain Planned. |
| INV-052 | Configuration inventory and one main orb were checked; all-project runtime isolation is not deterministically enforced. Marked Partial. |
| INV-057 | Controlled tests enforce attempts and issue the third-attempt instruction; they cannot prove the worker read the file. Marked Partial. |
| INV-060, INV-062 | Both release workflows are placeholders; there are no distribution targets/artifact attestations to qualify. Remain Planned. |
| INV-061 | Current workflows use read-only defaults and pinned actions. Trusted publishing remains unimplemented. Remains Partial. |

No product invariant was promoted based on factory tests. Phase 6 is explicitly outside the proposed Phase 1–5 activation in `factory/guardrails/factory-operation.md`; all release invariants must be resolved before separate release activation.

## Remaining authority and dependencies

Owner-side installation still needs the private webhook URL and repository secret/variable mutation. The chief has no ongoing administration requirement. Final protection, signing, and go remain owner steps. Twin and holdout dispatchers await their executable product phases; release dispatch awaits a real release workflow. The lifecycle-model decision remains pending live lifecycle qualification rather than adding a second implementation of the factory.
