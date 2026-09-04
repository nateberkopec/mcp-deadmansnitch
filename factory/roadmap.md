# Delivery roadmap

The chief of staff uses these phases only to decide which units of work are timely. They are not workflow states. Every unit follows the generic issue lifecycle. Phase 0 evidence is preserved in `docs/history/`.

### Phase 1: twin and differential suite

- Build the twin per the digital-twin contract in `SPEC.md`, with unit tests for the state machine and for every documented response.
- Build the differential suite, run it live from twin-validation to produce the golden master, and iterate the twin until the diff is empty. The factory-owned live key is used for no other purpose.
- Gate: the differential suite is green against the twin. The twin tests cover every row of sections 3, 4, and 5 of the API reference. The one-minute build-and-test bound is measured and recorded.

### Phase 2: typed client (`deadmanssnitch`)

- Write the domain types with newtypes and closed enums plus `Unknown` variants. The wire module is the only place where `serde_json::Value` appears. Add the `from_status` error mapping with remediations, the retry policy, the secret handling, the base URL overrides, and the check-in client, which uses the snitch's `check_in_url`.
- Gate: every endpoint and every error kind is exercised against the twin, including the injected faults. The key-leak test passes. Coverage is 100%. The `cargo semver-checks` baseline exists. `cargo doc` is clean.

### Phase 3: MCP server over stdio

- Build the tools, the structured output, the annotations, the read-only mode, the allow and deny modes, the `check_in` gating, the resources and templates, the completions, the prompts, the elicitation confirm on delete, the instructions, the icons, the cache hints, the stderr tracing, and the clean shutdown.
- Tests: in-process duplex client tables; golden masters; annotation invariants; the binary contract test; the Inspector with `--strict`; the generated README table.
- Gate: all acceptance verifiers in `SPEC.md` are green, except the HTTP-only ones. The two old slash-command walkthroughs succeed as scenarios against the twin.

### Phase 4: Streamable HTTP and official conformance

- Add `StreamableHttpService` in axum, a loopback default, `--allow-remote` with a mandatory token, Origin and Host validation, and `/health`. Implement it as one independently mergeable unit.
- Run the official conformance suite in CI on 2026-07-28 (gating) and on 2025-11-25 (report-only), with an expected-failures baseline.
- Gate: the baseline entries are auth-only, and each one carries a justification. The HTTP tests run through `tower::ServiceExt::oneshot`.

### Phase 5: scenarios, holdouts, unattended convergence

- Author the scenarios and the runner. Withhold five of them to the holdout repo.
- Continue issue-sized implementation and validation until holdouts pass three consecutive runs.
- Turn on the QA explorer and the refactor agent after the holdouts pass.
- Optional: a Sentry-style tool-prediction eval that runs only when a tool file changes.
- Gate: 100% holdout satisfaction on three consecutive runs. MISTAKES and LEARNINGS are reviewed and folded into the guardrails or the verifiers.

### Phase 6: distribution

- `cargo-dist`: a shell installer, four targets, and attestations. Patch the action refs to SHAs with `allow-dirty = ["ci"]`.
- The release-plz release PR flow. Publish `deadmanssnitch` and `mcp-deadmansnitch` to crates.io through OIDC. Write `server.json` with `registryType: "cargo"` and an OCI entry. Push a distroless image to GHCR with the `io.modelcontextprotocol.server.name` label. Publish to the MCP registry with `mcp-publisher login github-oidc`.
- README: the pitch and the transport statement, the install steps, the client config snippets (generic and Claude Code), the flag and env table with the precedence, the generated tools table with read-only and destructive markers, the read-only mode, the safety and trust model, the development notes, and the credit line.
- Gate: a tagged release installs on this Mac through the shell installer and passes the Inspector smoke test. The README config works end to end.

