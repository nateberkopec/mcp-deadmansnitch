# mcp-deadmansnitch: Rust rewrite plan

This project is a Model Context Protocol server for Dead Man's Snitch. It is
written in Rust. Coding agents build it in a factory. A digital twin of the DMS
API validates it. The project ships as one static binary.

This document is the top-level plan and the decision record. It supplies the
"complete intent" input for non-interactive agent runs (StrongDM's Shift Work).
Therefore it states the decisions, the gates, and the proof that counts. The
reference material is in `docs/reference/`. The previous Python implementation
stays in the git history at commit `279febb`. Use it as an input, not as a
template.

## 0. Decision record

We made each decision below on purpose. The later sections add no assumptions
that this section does not list.

### Product and scope

| Decision | Choice | Why |
|---|---|---|
| Purpose | This is a public project. Other people install it. The factory and harness techniques are the method. They are visible in the repo, but they are not the goal | |
| Repo identity | Leave the GitHub fork network. Delete each existing tag on the local machine and on origin. Keep the commit history, so that the Python code stays available | A fork relation does not make sense for a full rewrite in another language. The history is still useful as an executable spec |
| License | Use MIT. `LICENSE` carries both copyright lines: the original author's 2025 line and the 2026 line. The README gives a credit of one line | The history contains the original code. Attribution has no cost |
| Binary name and version | The binary is `mcp-deadmansnitch`. The version lineage is new and starts at 0.1.0. Tags use the form `mcp-deadmansnitch-v<version>` | The lineage is new. The tag prefix prevents a collision with the deleted 1.x tags if copies of them remain anywhere |
| Client library | The library is `deadmanssnitch`, which is the spelling that the service uses. Publish it to crates.io at 0.1.0. Give it a version number that is independent of the binary. Gate it with `cargo semver-checks` | The library holds the reusable gene. Its surface is ten calls and a few types |
| Twin and conformance crates | Keep `deadmanssnitch-twin` and `deadmanssnitch-conformance` inside the workspace. Never publish them | If they shipped, their control-plane API would immediately become a public contract |
| Tool granularity | Supply ten tools, one for each operation. Name each tool `verb_noun` in snake_case. Set all five annotations on each tool. Add no dispatch tool. Put no search catalog or execute catalog in the server | Section 1.5 gives the evidence |
| `check_in` tool | Ship the tool, but keep it off unless `--allow-check-in` is set. Read-only mode excludes it. Its description says that the tool sends a false healthy signal | If an agent checks in for the user, the check-in is a false signal that the job ran |
| Resources and prompts | Supply three resource URIs, two completions, and three prompts. Keep them thin | This is the cheapest way to exercise the whole protocol surface with the conformance suite |
| Confirm before delete | Use form elicitation when the client declares that capability. If the client does not declare it, use a description that says to confirm with the user. Add no `confirm: true` argument | A model can set a boolean as easily as it can leave it unset |
| Env var | Read `DEADMANSNITCH_API_KEY` only. The README records that the Heroku add-on spells the name `DEADMANSSNITCH_API_KEY` | Existing configurations must continue to work |
| Secrets locally | Keep the secret as plain text in `.env`. mise loads the file. `.gitignore` excludes it. A project `.gitleaks.toml` allowlists the `.env` path, so the secret scan still covers all other files | 1Password approvals cause too much friction here |
| Target hosts | Test no host specifically. Meet the spec as written | Clients are not our problem |

### Transports and hosting

| Decision | Choice |
|---|---|
| Transports | Supply stdio. Also supply Streamable HTTP as a first-class feature |
| HTTP binding | Bind to loopback by default. With `--allow-remote`, the server refuses to start unless `--auth-token` is also set. `--allowed-origins` and `--allowed-hosts` give the allowlists for the Origin validation that the spec makes mandatory |
| HTTP auth | Use a static bearer token from `DEADMANSNITCH_MCP_AUTH_TOKEN`. Compare it in constant time. The server is single-tenant. Build the check as middleware, so that OAuth 2.1 resource-server support can slot in later. Put the conformance suite's auth checks in the expected-failures baseline, each with a justification |
| Tenancy | Use one DMS key for each process. Per-caller keys make a different product |
| TLS | The binary has no TLS. For remote use, a reverse proxy terminates TLS. The documentation says this |
| Hosting | Ship the capability. Do not host an instance in this project |
| Conformance gating | Gate CI on 2026-07-28. Run 2025-11-25 as report-only in the same job |

### Twin and live API

| Decision | Choice |
|---|---|
| Twin fidelity | The twin has a clock-driven status machine. It does more than CRUD |
| Test double | The twin is the only HTTP double. Use no wiremock and no cassettes. The twin does the fault injection |
| Live API contact | Only the differential conformance suite touches the live API. That suite is opt-in and runs weekly |
| Live safety | The suite deletes only the tokens that it created in the same run, and it keeps those tokens in memory. It never lists snitches and then deletes them by name prefix. If it finds leftovers from an earlier run, it stops and reports them, and a human cleans up. It never changes or deletes anything that already exists in the account |
| Plan headroom | The upgrade of the account is in progress, and the golden run waits for it. Build the twin from `docs/reference/dms-api-v1.md` first. Reconcile the twin with the golden file afterward |
| Holdouts | The holdouts are in the private repo `nateberkopec/mcp-deadmansnitch-holdout`. Only the validate step clones it, with a fine-grained token whose scope is that repo |

### Factory plane

| Decision | Choice |
|---|---|
| Factory plane | The factory plane is Amp. Orbs are the only execution environment for implementation, review, judging, QA, and the background loops. Reuse nothing from sfactory |
| What runs locally | Two things run locally. The first is the workflow orchestrator, which is the Amp plugin in this repo. The second is one chief-of-staff agent (Puck or an equivalent) that reports, routes questions, and launches work. No one writes or tests code on the local machine |
| Isolation | Use one fresh orb for each attempt, each review, each judgment, and each loop run. `.agents/setup` installs the mise toolchain, warms the cargo cache, and builds the twin. Amp makes a snapshot of the orb for reuse. `.agents/resume` checks the toolchain again |
| Secrets in orbs | Use Amp's OIDC workload identity. Only the drift loop and the QA explorer receive the DMS key |
| Workflows | The plugin is TypeScript and is checked in at `.amp/plugins/factory/`. Phases 1 through 5 are pipeline functions. The gates are `amp.$` shell steps. The exit code decides whether the pipeline continues, and the model never runs a gate. Attempt budgets, parallel attempts, and human gates are code. Each attempt pushes a branch. The plugin records the workflow state in the repo, because Amp has no checkpoint and no resume |
| Model and provider | Deferred. The plugin exposes model and effort as parameters of each step. This stage makes no choice |
| Attempt budget | Allow five attempts for each gate, each in a fresh orb, from the last commit that passed. Then halt and write a report. The report gives what the attempts tried, what failed, and the reviewer's last verdict. Attempt three and each later attempt must read the MISTAKES.md entries from the earlier attempts |
| Parallel attempts | For the twin state machine and for the HTTP-plus-conformance gate, run three attempts in parallel orbs. A code step makes a table with one row for each attempt. The table gives the lines of code from `tokei`, the clippy cognitive complexity, the test count, the coverage, and the gate results. A reviewer agent in a fresh orb selects the winner and must cite the table. Keep the losing branches for one week, then delete them |
| Human gates | Only a human merges these pull requests. Each change that expands the spec goes through one. Such changes include new scenarios, new holdouts, and new tool behavior |
| Work queue | The work queue is GitHub issues. A human sets a label to mark an issue approved. The plugin's webhook launches an implementation thread on that label |
| Cost tracking | Each run report records the orb hours for each gate and for each loop |

### Harness and process

| Decision | Choice |
|---|---|
| Toolchain | Use Rust edition 2024. The MSRV is 1.88, which is rmcp's floor. Install the stable toolchain with `mise`. Use no Nix |
| MCP SDK | Pin `rmcp` to `=3.2.x`. Enable the features `server, macros, transport-io, schemars, elicitation, transport-streamable-http-server` |
| Worker | The worker is Amp's agent. Hold it constant, as Lopopolo's fixed-worker thesis says. AGENTS.md is the source of truth, and Amp reads it natively. `CLAUDE.md` is an `@AGENTS.md` shim for a person who runs Claude Code locally. Use no skills. The routed docs hold everything that a skill would teach. Requalify the harness each time the worker changes |
| Dev-env standard | Applied. `mise.toml` supplies the tasks `test`, `test:fast`, `lint` (fan-out), `lint:secrets`, `build`, and `serve`. Each task is a one-line wrapper around the exact `cargo` command that `CONTRIBUTING.md` documents. The `hk.pkl` pre-commit hook runs lint, secrets, and `test:fast`. A `commit-msg` step enforces conventional commits. `serve` starts the twin and the server in HTTP mode. `check-dev-env.fish` runs at the end of Phase 0, and its failures are the worklist |
| Task runner | Use nothing beyond cargo and mise. Add one fish wrapper for the scenario runner, which uses more than one process. The wrapper prints the commands that it runs |
| Pre-commit test scope | `test:fast` runs the unit tests and the in-process tool tests. The conformance tests, the binary contract test, and the scenarios run in CI only |
| Coverage | Enforce 100% coverage on `deadmanssnitch` and on the twin's state machine. Elsewhere, use a ratchet, so that the coverage never decreases. Run `cargo mutants` weekly as report-only |
| Scenario driver | The driver is the Amp SDK with `executor: 'orb'` and an `mcpConfig` that points at the server. The server points at the twin. An acting agent uses the server. A judge agent reads the transcript and the twin state dump. The judge agent runs in a separate fresh orb and cannot reach the implementation threads |

### Release and distribution

| Decision | Choice |
|---|---|
| Release builds | `cargo-dist` generates the GitHub Actions release workflow, builds all targets, and signs build-provenance attestations. Patch its action references to full SHAs. Mark the file `allow-dirty = ["ci"]` |
| Release automation | `release-plz` opens release PRs from conventional commits. It maintains the changelog, bumps the versions, and makes the tags. The release runbook is "review the release PR, then merge it" |
| Targets | Build for Linux musl and macOS, each on x86_64 and aarch64. Do not build for Windows |
| Channels | Supply a shell installer, `cargo install`, a GHCR container image, and an MCP registry entry (`server.json`). Supply no PowerShell installer, no MCPB bundle, and no Homebrew tap |
| Dependencies | Run Dependabot monthly, with grouped updates and a cooldown of seven days. Run `cargo deny check advisories` weekly on a schedule. Pin the actions to full SHAs. Set the default workflow permissions to read-only. Publish to crates.io with OIDC trusted publishing |
| Changelog | Start a new `CHANGELOG.md` at 0.1.0 with a link to the Python history. Log each tool rename |

## 1. Method: how the techniques map onto this project

### 1.1 Shift Work (StrongDM)

Keep interactive work separate from non-interactive work. In interactive work,
the intent is still being discovered. In non-interactive work, the intent is
complete, and the agent runs to convergence with no person present. The intent
is complete when a spec and a test suite exist.

The interactive work is this plan and the interview that produced it. The
non-interactive work is Phases 0 through 5. The workflow plugin runs those
phases in orbs and gives each attempt a fresh context. No human acts between
"inputs complete" and "holdouts pass", except at the human gates that section 0
names.

These inputs make this a non-interactive case:

- A formal spec and a validation suite. These are the MCP spec, with the official conformance suite and the Inspector, and the DMS API contract in `docs/reference/dms-api-v1.md`, with the differential suite.
- An application that already works: the Python server at commit `279febb` and its six test files, which have about 2,500 lines. Its behavior and its edge cases are an executable spec. Its tool shape is not.
- The non-functional intent. You cannot recover it from the Python code. Section 3 records it.

You cannot run the Python server against the twin as an oracle unless you patch
it, because its base URL is hardcoded and its tool shape differs. Translate its
tests into scenarios and conformance cases instead.

### 1.2 Digital Twin Universe (StrongDM)

"Replicate behavior at the boundary. Build test doubles from API contracts and
observed edge cases, then validate them against the live dependency until we
stop finding behavioral differences."

`deadmanssnitch-twin` is an axum binary. It serves the real API surface on
localhost. It has an in-memory store, a clock that you can control, a control
plane for fault injection, and a deterministic token generator.
`deadmanssnitch-conformance` is one set of black-box HTTP requests. You can run
the set against the twin or against the live API. It runs against the twin on
each CI run. It runs against the live API weekly. That scheduled run detects
drift. Section 4 gives the design.

### 1.3 Gene Transfusion (StrongDM)

"Move working patterns between codebases by pointing agents at concrete
exemplars." Section 5 is the donor list, and it names the specific gene to
extract from each donor. The list is also persisted as `docs/donors.md`. Each
agent reads the donor, writes the invariants into a checklist, and then
synthesizes the code. Tests prove the equivalence.

### 1.4 Harness engineering (Lopopolo)

"Improving agent output by shaping the environment around it, holding the model
constant." This project uses these moves, and each one produces an artifact:

- AGENTS.md is the map. It states what the repo is, the operating loop, the golden-path workflows, and the links. `CLAUDE.md` is `@AGENTS.md` plus host notes.
- ARCHITECTURE.md is a stable codemap. It gives the modules, the boundaries, the dependency direction, and the invariants. It holds no version literals.
- The guardrails are themed documents in `docs/guardrails/`. When a PR violates a guardrail, that same PR updates it.
- "If it matters, it belongs in a verifier owned by the repo." Each recurring correction becomes a type, a lint, a test, or a document, in that order. Section 6 lists the verifiers.
- Parse at the boundary. Make illegal states impossible to represent. Use a newtype for `Token`. Use closed enums for `Status` and `Interval`, each with an `Unknown` variant. Let no `serde_json::Value` pass the decode boundary.
- Tool results are quiet on success. Their structure is bounded and stable. An error names the invariant that it violated and gives a recovery action. A mutation returns a receipt.
- Match the proof to the claim. Section 7 maps each claim to its evidence.
- MISTAKES.md, LEARNINGS.md, and DESIRES.md are telemetry for the harness builder. Nothing feeds them into a prompt automatically.
- Each PR carries the prompt that produced it.
- Continuous maintenance uses runbooks that the repo owns, and each runbook has a retirement condition. Section 9 lists the loops.

### 1.5 Why per-operation tools (research summary, September 2026)

Search-and-execute catalogs inside servers are on their way out. GitHub removed
its dynamic toolsets in May 2026, because progressive discovery moved to the
client and to the model API. Stainless dropped its dynamic-tools scheme. The
2026-07-28 spec forbids a tool list that varies per connection. Claude Code,
the Claude API tool search, OpenAI's tool search, and every gateway that we
surveyed search or run code on the server's behalf. The surveyed gateways are
ToolHive, MCPProxy, Speakeasy Gram, Composio, executor.sh, and Cloudflare Code
Mode. Server-side catalogs survive only at 50 to more than 1,000 operations,
and even there they cost two to three times more calls.

On token grounds, those layers are indifferent to a single `action` dispatch
tool. But they reward one tool per operation. The search indexes the tool names
and the argument names. Code mode maps each tool to a typed function from its
output schema. The permission layer and the policy layer route on the
annotations of each tool. For this reason, GitHub and Block both refused to
merge reads and writes into one tool. executor.sh exposes one `execute` tool
and preserves the upstream tool names as leaves, so it does the consolidation
itself.

No layer does these three things for a server, and all three are in scope here:

- Give `tools/list` a positive `ttlMs` and `cacheScope: "public"`. rmcp's macro emits zero, so the server overrides `list_tools`.
- Supply an `instructions` string. It says what the server covers and when to search for its tools. Claude Code loads only the names and the instructions at session start.
- Supply bulk-friendly reads with filters and a `truncated` flag, because code mode filters in code.

### 1.6 The factory plane, workflows, and loops

A workflow is not a tool that the model uses. A workflow holds the model
constant and runs the model as one step among deterministic steps. The property
that matters is this: "you do not reach the next step unless this code passes".
That property exists only when the workflow lives outside the model. Therefore
the workflow is a checked-in program. The gates are shell commands, and their
exit codes route the run. The model sees pass or fail plus a failure summary.
Retries, attempt budgets, parallel attempts, and human gates are policy, and
therefore they are code, not prompt text.

The plane is Amp. Each attempt, review, judgment, QA run, and background loop
runs in its own orb. The local machine runs the orchestrator plugin and one
chief-of-staff agent, and nothing else. Amp's schedules and durable webhooks
wake the sleeping orbs for the loops. A failed run pauses an Amp automation.
Therefore each loop delegates to its runbook and reports its status at the end,
and one loop watches that the other loops are not paused.

Two generative processes feed the factory. Both expand the spec, so both end at
a human gate:

- The QA explorer acts as a user against the twin with random seeds and faults. It runs in a fresh orb and cannot reach the implementation threads. Its output is an issue plus a pull request that adds a scenario file in Given, When, Then form. A triage step removes duplicates of open issues and assigns a severity. Nothing enters `scenarios/` or the holdout repo until a human merges the PR.
- The refactor agent runs continuously with one mission: fewer lines of code. A person closes its PR unread unless the tests stay green, the coverage does not drop, and the line count drops.

## 2. Functional spec

### 2.1 Tools

Each tool takes flat arguments in snake_case with `deny_unknown_fields`. Each
field has a doc comment, which becomes the schema description. Each tool sets
all five annotations explicitly and has an `outputSchema`. Each tool returns
the same payload twice: as `structuredContent` and as pretty-printed JSON text.
Each result that references a snitch includes a `resource_link` to
`dms://snitch/{token}`.

| Tool | Args | readOnly | destructive | idempotent | Result |
|---|---|---|---|---|---|
| `list_snitches` | `tags?: string[]` (AND filter), `status?: enum` (client-side filter, because the API has none), `limit?: int` (default 50, max 500) | true | false | true | `{snitches: Snitch[], total: int, returned: int, truncated: bool}` |
| `get_snitch` | `token: string` | true | false | true | `Snitch` |
| `create_snitch` | `name`, `interval: enum`, `notes?`, `tags?`, `alert_type?: enum`, `alert_email?: string[]` | false | false | false | `Snitch` |
| `update_snitch` | `token`, plus any of `name`, `interval`, `notes`, `tags` (replaces the list), `alert_type`, `alert_email`; at least one is required | false | false | true | `Snitch` |
| `delete_snitch` | `token` | false | true | true | `{deleted: true, token}` |
| `pause_snitch` | `token`, `until?` (one of `healthy`, `unpaused`, or an RFC 3339 timestamp) | false | false | true | `Snitch`, fetched again after the 204 |
| `unpause_snitch` | `token` | false | false | true | `Snitch` |
| `add_snitch_tags` | `token`, `tags: string[]` | false | false | true | `{tags: string[]}` |
| `remove_snitch_tag` | `token`, `tag` | false | false | true | `{tags: string[]}` |
| `check_in` | `token`, `message?` (max 256), `status?: int` (exit status; a non-zero value reports an error) | false | false | false | `{accepted: true, checked_in_at}` |

Other behavior:

- The `Snitch` output type is a trimmed, typed struct. Its fields are `token, name, status, interval, alert_type, tags, notes, checked_in_at, created_at, check_in_url, alert_email, url`. The `url` field is the web URL `https://deadmanssnitch.com/snitches/{token}`. The server passes no raw data through and drops the legacy `type` object.
- The descriptions spell out the meaning of each enum value inline. They list all 17 interval values with their plan gating, and they explain `basic` and `smart`.
- Each description leads with task keywords, such as "pause", "snooze", and "silence alerts". Each description stays under 1,024 characters.
- If you call `pause_snitch` on a `pending` snitch, the tool returns an error that explains the precondition.
- List results are bounded. The server applies `limit`, returns `total` and `truncated`, and caps the text block at 100 KB.
- Free text from upstream is data, never instructions. This text includes `name`, `notes`, and the error messages. An error result frames upstream text as untrusted.
- Tool names are stable. A rename keeps an alias for one major version, and the changelog logs it.

### 2.2 Error contract

| Condition | Result |
|---|---|
| Missing or malformed arguments (schema-level) | JSON-RPC `-32602` |
| Missing API key at call time | Tool error `{kind: "configuration", message, remediation: "set DEADMANSNITCH_API_KEY"}` |
| 401 | Tool error `kind: "authentication"`, with a remediation |
| 402 | `kind: "plan_limit"`, with the upstream message |
| 404 | `kind: "not_found"`, which names the token |
| 422 | `kind: "invalid"`, which flattens `validations` to `attribute: message` lines |
| 429 | `kind: "rate_limited"`, which includes retry advice |
| 5xx, timeout, connect error | `kind: "upstream_unavailable"`, after a bounded retry |
| Check-in host over its limit | `kind: "rate_limited"`, with the `X-Ratelimit-Reset` value |

The structured form is `structuredContent: {error: {kind, message, status_code?, remediation?}}`
with `isError: true`, plus a text block of one paragraph. The API key never
appears in any output, log, or error, and a test proves this.

The server starts without an API key, so that `tools/list` works in an
inspector. The server requires the key at call time.

### 2.3 Resources

- `dms://snitches` (list, JSON, `cacheScope: private`, `ttlMs: 30000`)
- `dms://snitch/{token}` template (single snitch, JSON, private)
- `dms://snitches?tag={tag}` template (filtered list)
- Completions for `{token}` and `{tag}`. The `{token}` completion comes from a cached list and shows the names as hints.

### 2.4 Prompts

- `snitch_health_review`: summarizes all snitches by status. It flags the failed snitches and the errored ones. It notes each snitch that is pending for more than one day and each snitch that is paused for more than three days.
- `setup_monitor`, with the argument `job_description`: explains the intervals and the smart alerts. It ends with a `create_snitch` call.
- `diagnose_snitch`, with the argument `token`: pulls the snitch. It then reasons about the interval alignment and the time of the last check-in.

### 2.5 Server metadata

`server/discover` returns the name `mcp-deadmansnitch`, the crate version, an
icon, and `instructions`. The legacy `initialize` returns the same values. The
server assembles the `instructions` from the tool set that is enabled. The text
is one paragraph. It says what DMS is, gives the token format, says when to
search for these tools, and says "confirm before delete; never check in on the
user's behalf unless asked". `tools/list` carries a positive `ttlMs` and
`cacheScope: "public"`, and it is sorted.

### 2.6 Configuration and modes

| Flag | Env | Effect |
|---|---|---|
| `--read-only` | `DEADMANSNITCH_READ_ONLY=1` | Registers only the tools that have `readOnlyHint: true`. The set comes from the annotation, not from a second list. This flag wins over everything else |
| `--tools a,b` / `--exclude-tools c` | `DEADMANSNITCH_TOOLS`, `DEADMANSNITCH_EXCLUDE_TOOLS` | Allow list and deny list. An unknown name fails startup, and the error gives the valid names. Exclude beats include |
| `--allow-check-in` | `DEADMANSNITCH_ALLOW_CHECK_IN=1` | Enables `check_in` |
| `--api-url`, `--check-in-url` | `DEADMANSNITCH_API_URL`, `DEADMANSNITCH_CHECK_IN_URL` | Overrides for the base URLs. The tests use them to point the server at the twin |
| `--transport stdio\|http` | `DEADMANSNITCH_TRANSPORT` | Default stdio |
| `--listen 127.0.0.1:PORT` | `DEADMANSNITCH_LISTEN` | The HTTP bind address. The server refuses a non-loopback address without `--allow-remote` |
| `--allow-remote` | `DEADMANSNITCH_ALLOW_REMOTE=1` | Permits a non-loopback binding. The server refuses to start unless `--auth-token` is set |
| `--auth-token` | `DEADMANSNITCH_MCP_AUTH_TOKEN` | The caller's bearer token for HTTP mode. The server compares it in constant time. The spec requires that it stays separate from the DMS key |
| `--allowed-origins`, `--allowed-hosts` | `DEADMANSNITCH_ALLOWED_ORIGINS`, `DEADMANSNITCH_ALLOWED_HOSTS` | Allowlists for the Origin validation and the Host validation. Loopback origins are allowed by default |

`Config` has a redacting `Debug`. The tracing output goes to stderr only, with
no ANSI codes. The retry policy makes at most 3 attempts. It retries on 429, on
5xx, and on connect errors. It honors `Retry-After` and uses a jittered
backoff. Each request has a 10 s timeout, and each response has a 1 MB cap. The
retry policy is a value with `production()` and `test()` constructors, so that
the tests do not sleep.

## 3. Non-functional spec

- One static binary for each target: Linux musl and macOS, on x86_64 and aarch64. Startup takes less than 50 ms. There are no runtime dependencies.
- No upstream response causes a panic. Malformed JSON, HTML 404 pages, empty 400 bodies, and unknown enum values all become typed errors.
- `#![forbid(unsafe_code)]`.
- `secrecy::SecretString` holds the API key. The server sends the key in a header that is marked sensitive. The key never reaches a log, a `Debug` output, or a tool result. A test greps all captured stdout and stderr for the key.
- These are all bounded: the request timeout, the retry budget, the response size, the list size, and the text block size.
- The server exits cleanly with exit code 0 on stdin EOF, on SIGTERM, and on SIGINT.
- A full `cargo build` plus `cargo nextest run` takes less than one minute in an orb. `test:fast` takes less than ten seconds after the first compile. Phase 1 measures these times, and the project keeps them.
- Supply chain: `deny.toml` checks the advisories, permits MIT and Apache-2.0 only, permits no duplicate versions, and permits known registries only. Dependabot runs as section 0 says. The actions are pinned by SHA. The default workflow permissions are read-only. Publishing uses OIDC trusted publishing.
- The compatibility surfaces, from the strictest to the least strict, are the tool names and argument schemas, the `structuredContent` shapes, the CLI flags and env vars, and the MCP spec revisions served. A change to a tool name or an argument schema is a semver-major change. The `deadmanssnitch` library has its own semver gate.

## 4. Digital twin design (`crates/deadmanssnitch-twin`)

The twin is a separate crate. It shares no code with `deadmanssnitch` and no
code with the server. Some things are needed in both places, such as the
interval list and the error strings. The project duplicates those things on
purpose, so that a mistake in one place cannot hide a mistake in the other.

### 4.1 Surfaces

- API listener: serves every endpoint in sections 3 and 5 of `docs/reference/dms-api-v1.md`, with verbatim status codes, bodies, and headers. It uses basic auth, and you can configure the valid keys. It returns an HTML 404 for an unknown route. It returns a 400 with an empty body for malformed JSON. It emits the legacy `type.interval` field. It accepts the legacy nested `type.interval` on create. It returns 200 on create, not 201. It returns 204 on pause, unpause, and delete. The tag endpoints return bare arrays. The listener accepts a trailing slash. The tag filter is an AND filter. You can configure the plan limit, and the listener checks the 402 condition before it validates the body.
- Check-in listener: uses a separate port and stands in for `nosnch.in`. It returns 202 with the body `Got it, thanks!\n` for GET, POST, PUT, and PATCH, for any token. It returns 405 with an `Allow` header for HEAD and DELETE. It returns 404 with the documented body when there is no token. It reads `m` and `s` from the query string, from a form body, or from JSON. It sends the rate-limit headers and applies the rule of 10 per hour and then 1 per minute. When `s != 0`, the status moves to `errored`. The `check_in_url` field in every snitch object points at this listener.
- Control plane under `/_twin/`: `POST reset` resets the twin. `POST seed` bulk-loads snitches. `GET|POST clock` freezes time and advances it. `POST faults` adds to a queue of one-shot faults: a status override, a delay, a dropped connection, malformed JSON, a 429 with `Retry-After`, and an HTML body. `POST plan` sets the limit, sets whether smart intervals are allowed, and sets whether the twin honors `s`.

### 4.2 State machine

The state machine implements section 6 of the API reference:

- A snitch stays `pending` until the first check-in.
- For a basic interval, the twin evaluates the window each time the clock advances. The windows align to UTC. The first monitored window is the first full window after the first check-in. The twin evaluates a window one minute after the window ends.
- A snitch becomes `failed` when a window closes and no check-in happened inside it.
- A snitch becomes `errored` when `s` is not zero and the plan honors `s`.
- A snitch becomes `paused` and obeys the `until` semantics. The default value is `healthy`. The other values are `unpaused` and a timestamp. The twin also unpauses the snitch automatically.
- The twin rejects a pause on a `pending` snitch with a 422.
- `checked_in_at` updates only on a healthy check-in.

The twin does not simulate smart alerts. Nothing in the API surface exposes the
learned deadline.

### 4.3 Determinism

The store is in memory. The token generator uses a seed and produces 10
lowercase hex characters. The clock is frozen. `reset` runs between the
scenarios.

### 4.4 Differential conformance suite (`crates/deadmanssnitch-conformance`)

The suite is a binary and a test module. It runs a fixed script of requests
against a pair of base URLs. The script does these steps: create; read; list
with tags and without tags; update each field; add a tag and remove a tag;
pause with each form of `until`; unpause; check in with `m` and with `s`; and
delete. The script also triggers every error path that is safe to trigger: bad
auth, unknown token, bad interval, empty body, malformed JSON, and a pause on a
pending snitch. The suite records the responses in a normalized form, and it
masks the volatile fields: the token, `href`, the timestamps, `x-request-id`,
`x-runtime`, and the rate-limit counters. The suite has two modes:

- `--target twin` runs on every CI job. The suite compares the recorded output with the checked-in golden master `crates/deadmanssnitch-conformance/golden/live.json`.
- `--target live` is opt-in. It needs `DEADMANSNITCH_API_KEY` from the dedicated test account. It creates its own snitches with the name prefix `mcp-conformance-` and remembers their tokens in memory. At the end of the same run, it deletes only those tokens. If the account already contains snitches with that prefix from an earlier run, the suite stops before it creates anything and reports them, and a human deletes them. The suite never lists snitches and then deletes them. It never modifies a snitch that it did not create. It honors the check-in rate limit. It runs weekly on a schedule and also on a manual dispatch. If there is a diff, the suite opens an issue and attaches the normalized diff.

The golden master comes from the first live run, which happens after the plan
upgrade for the account lands. The twin is not done until it matches the golden
master.

## 5. Gene transfusion: donors and the genes to take

This section is also persisted as `docs/donors.md`. For each donor, the agent
reads the cited files, writes the invariants into a checklist, and then
synthesizes the code.

| Donor | Genes |
|---|---|
| Previous Python server at commit `279febb`: `src/mcp_deadmansnitch/{client,server}.py` and `tests/` | Take the two-host quirk, where the check-in goes to `check_in_url`; the re-fetch after the 204 on pause and unpause; the tag endpoints that return bare arrays; the 401 that maps to a "check your key" message; the rule that an update requires one field; and the full test matrix of the error paths. Translate its tests into scenarios. Do not take the single-tool shape. Do not take the `{success: bool}` envelope. |
| rmcp examples (`examples/servers/src/`): `structured_output.rs`, `elicitation_stdio.rs`, `completion_stdio.rs`, `prompt_stdio.rs`, `counter_streamhttp.rs`, `simple_auth_streamhttp.rs`; tests `test_message_protocol.rs`, `test_with_js.rs` | `Parameters<T>` plus `Json<T>` for an automatic `outputSchema`; `#[tool(annotations(...))]`; `ToolRouter::disable_route` for read-only mode; the `elicit::<T>` confirm flow; `ServerHandler::complete`; `StreamableHttpService` mounted in axum with `legacy_session_mode(false)`; an override of `list_tools` for the cache hints; duplex in-process client tests; `TokioChildProcess` binary tests. |
| `major7apps/tiingo-mcp` (rmcp 3.x REST wrapper) | The crate layout `src/{config,error}.rs`, `src/client/`, `src/mcp/{tools,prompts,resources}.rs`; `Error::from_status(capability, status, detail)` with a remediation and a sanitized detail; the `success_result` and `error_result` helpers that set both the text and `structured_content`; a redacting `Debug` on the config; `RetryPolicy::production()` and `::test()`; `HeaderValue::set_sensitive`; `tests/mcp_contract.rs`, which diffs `tools/list` against a checked-in baseline; the opt-in `tests/live_smoke.rs`; `dist-workspace.toml`. |
| `github/github-mcp-server` | `--read-only` derived from `readOnlyHint`; the precedence of `--tools` and `--exclude-tools`; tool snapshots with an env var that updates them; a test that fails any tool that misses an annotation; a map of deprecated aliases for renames; a README tools table generated from the registry, with a docs-drift check in CI; numeric strings accepted for numbers; `instructions` assembled per enabled tool set. |
| `grafana/mcp-grafana` | All five annotations on every tool, enforced by a test; rejection of an unknown argument, with the list of valid names; hints on an empty result; a token-budget check on the size of `tools/list`. |
| `getsentry/sentry-mcp` (`docs/contributing/*.md`, `tools/tools.test.ts`) | The description template: one line, "Use this when", cross-tool routing, and examples. `structuredContent` as the source of truth, with text parity. A test on the description length. An error taxonomy with `toUserMessage()`. The rule "never return untrusted upstream text unframed". The cheap tool-prediction eval that runs only when a tool file changes. |
| `ni-c/healthchecks-mcp` (closest domain analogue) | Startup without a key, so that listing works; a server-side `limit` plus a total, because the upstream list has no pages; a 100 KB result cap; the "untrusted content" framing; `delete` gated by elicitation; `pause` deliberately ungated. |
| `neondatabase/mcp-server-neon` | Long workflow text in the tool result, not in the description; the "NEVER run autonomously" wording for a destructive tool; a file snapshot of the full `tools/list`. |
| `dinglebear-ai/rtailscale` | The README sections "Capabilities and Boundaries" and "Safety and Trust Model". |
| `artichoke/rand_mt` (Lopopolo's harnessed Rust crate) | The shape of `AGENTS.md` and the operating loop; `docs/guardrails/*`; the `docs/automations/*` runbooks; the crate-root lint block; `deny.toml`; `mise.toml`; a CI matrix with `RUSTFLAGS=-D warnings`, an MSRV job, and a doc job that denies broken links; SHA-pinned actions; a Dependabot cooldown; an OIDC publish that is gated on CI. |
| `modelcontextprotocol/rust-sdk/.github/workflows/conformance.yml` | The recipe for running the official conformance suite against an HTTP server in CI, with an expected-failures baseline. |
| `joshrotenberg/cratesio-mcp` | release-plz feeding cargo-dist, which feeds a GHCR image; the library and binary split, with a library-only CI job. |
| Amp docs: plugin API, orbs, agent-to-agent, automations, event-driven orbs | `createAgent` and `agent.run({executor: 'orb'})` as the workflow primitives; `amp.$` for the gates; `.agents/setup` and `.agents/resume`; `createWebhook` for the issue-label trigger; the schedule semantics, which include pause-on-failure. |

## 6. Harness: repo-owned verifiers and documents

### 6.1 Layout

```
AGENTS.md                 map: what, why, operating loop, golden paths, links
CLAUDE.md                 @AGENTS.md shim
ARCHITECTURE.md           codemap, boundaries, invariants (no version literals)
CONTRIBUTING.md           setup, direct cargo commands, proof expectations
PLAN.md                   this file
CHANGELOG.md              maintained by release-plz
LICENSE                   MIT, both copyright lines
Cargo.toml                workspace
deny.toml  mise.toml  hk.pkl  .gitleaks.toml  rustfmt.toml  clippy.toml
release-plz.toml  dist-workspace.toml  server.json
.env.example              DEADMANSNITCH_API_KEY=
.agents/setup  .agents/resume            orb setup and wake scripts
.amp/plugins/factory/     workflow orchestrator: phases, gates, attempts, webhook, loops
.github/workflows/{ci,audit,conformance,twin-drift,release,release-plz}.yml  dependabot.yml
crates/deadmanssnitch/             typed client + domain types (library, published)
crates/mcp-deadmansnitch/          binary: config, mcp/{server,tools,resources,prompts,completions}, http
crates/deadmanssnitch-twin/        simulator binary + library
crates/deadmanssnitch-conformance/ differential suite + golden/
scenarios/                Given, When, Then scenario files (section 7.3)
bin/scenarios             fish wrapper for the scenario runner; prints what it runs
docs/reference/           dms-api-v1.md, mcp-2026-07-28.md
docs/guardrails/          rust-code, testing-and-proof, tool-contract-stability, errors-and-retries, dependencies, twin-fidelity
docs/automations/         one runbook per loop (section 9)
docs/donors.md
MISTAKES.md LEARNINGS.md DESIRES.md   agent telemetry, never prompt-injected
```

The holdout scenarios live in the private repo, not here.

### 6.2 Verifiers (each names the invariant it protects in its failure message)

- Crate-root lint block: `clippy::all`, `clippy::pedantic`, `clippy::cargo`, `missing_docs`, `missing_debug_implementations`, `unused_qualifications`, and `#![forbid(unsafe_code)]`. The source warns, and CI uses `-D warnings`. Each `allow` is local and justified.
- `clippy.toml` `disallowed-types`: blocks `serde_json::Value` outside `deadmanssnitch::wire` and the twin, and blocks `std::time::SystemTime::now` outside the clock module.
- Test: every tool has all five annotations. No tool is both read-only and destructive. Each name matches `^[A-Za-z0-9_.-]{1,128}$`. Each description is under 1,024 characters. `tools/list` is sorted, stays under a fixed byte budget, and carries a positive `ttlMs` with `cacheScope: "public"`.
- Test: `instructions` is non-empty, is under 2 KB, and mentions the tool set that is actually enabled.
- Golden masters: `insta` holds them, and only `cargo insta accept` updates them. They cover `tools/list`, `prompts/list`, `resources/templates/list`, and every error message that the server can emit.
- Test: the API key string never appears in the captured stdout, in the captured stderr, or in any tool result across the in-process suite.
- Test: read-only mode registers exactly the read-only set. The set is derived from the annotations, not enumerated. `check_in` is absent unless the flag allows it.
- Test: HTTP mode refuses to start with `--allow-remote` and no token. It rejects a bad Origin with a 403. It compares the token in constant time.
- Test: the README tools table equals the generated table (`cargo run --bin gen-docs -- --check`).
- Test: every library error variant has a remediation string and a `kind`.
- Test: the policy tests parse `mise.toml` and the CI YAML, and they assert that the pinned toolchain matches. Therefore the versions live in one place.
- Coverage: `cargo llvm-cov` reports 100% on `deadmanssnitch` and on the twin state machine. A ratchet file holds the floor for the rest.
- CI also runs `cargo deny check`, `cargo semver-checks` on `deadmanssnitch`, `cargo fmt --check`, and `cargo doc` with broken-link denial. It runs `cargo nextest` on stable and on the MSRV, and it runs the feature matrix (default, none, all).
- `cargo mutants` runs on the library and on the twin's state machine. It runs weekly and is report-only.
- hk pre-commit runs `lint`, `lint:secrets`, and `test:fast`. `lint:secrets` runs gitleaks with `.env` allowlisted. The `commit-msg` step checks the conventional-commit format.
- The Inspector runs with `--cli --strict` against the built binary in CI.
- The official conformance suite runs against HTTP mode. The 2026-07-28 run gates CI and uses a checked-in expected-failures baseline, in which the auth entries are justified. The 2025-11-25 run is report-only.
- The differential suite runs against the twin on every run, and against the live API weekly.
- The workflow gates in the plugin run the same commands as CI, and both invoke them through `mise run`. Therefore a gate cannot pass locally and fail in CI, or fail locally and pass in CI.

### 6.3 AGENTS.md operating loop (draft)

1. Classify the change: tool contract, client or wire, twin fidelity, transport, dependencies or CI, or docs only.
2. Read the routed guardrail for that class, and read `ARCHITECTURE.md`.
3. Keep the diff narrow. Do not mix behavior, dependency posture, release metadata, and formatting.
4. For a behavior change, add a test that fails before the fix. For a twin change, add a differential-suite case.
5. Run the proof that matches the class. `CONTRIBUTING.md` lists the commands. If you skip a relevant check, say so in the PR.
6. Update each document that makes a claim about what changed: the README tools table, `ARCHITECTURE.md`, the guardrails, and the CHANGELOG entry, which comes from the commit message.
7. Record the durable lessons in the repo, not in the transcript.

## 7. Proof: which evidence supports which claim

| Claim | Evidence |
|---|---|
| The client speaks the DMS API correctly | The differential suite passes against the twin, and the twin's golden master came from the live API |
| The twin is faithful | The weekly live differential run is green, and every observed edge case in `docs/reference/dms-api-v1.md` has a twin test |
| Tools behave as specified | In-process rmcp client tests, table-driven per tool, run against the twin and cover every error kind and every fault |
| The binary works over stdio | A `TokioChildProcess` contract test on the real binary, plus the Inspector with `--strict` |
| The server is spec-conformant | The official conformance suite on 2026-07-28, in HTTP mode, with a baseline that is empty or justified |
| No secret leaks | The key-grep test over all captured output, plus the redacting `Debug` test |
| An agent can use it for real tasks | The scenarios in section 7.3 pass, including the holdouts. A separate agent in a fresh orb judges them |
| The chosen parallel attempt was the best one | The reviewer's verdict cites the metrics table, and the table is attached to the PR |
| Releases are what CI tested | release-plz tags from a merged release PR. The release workflow builds from that tag, and the artifacts carry attestations |

### 7.3 Scenarios

The scenarios are natural-language end-to-end stories at the MCP boundary, in
Given, When, Then form. Given a twin seed and a fault schedule, when the user
says this, then these tool calls happened and the twin ends in this state.
Those are hard assertions, and the runner checks them mechanically. The judge
then finds these other things, which are soft assertions. The runner
(`bin/scenarios`) starts the twin. It then starts the server pointed at the
twin. It then calls the Amp SDK with an orb executor and an `mcpConfig` for the
server. The acting agent's transcript and a twin state dump go to a judge agent
in a separate fresh orb. The scenarios are seeded from the old repo's two slash
commands and from the Python test suite. Examples are: set up a daily backup
monitor; find why a snitch is failing; pause everything tagged `staging` for
two hours; recover from a 429 in the middle of a task; refuse to delete without
confirmation; behave sensibly when the key is wrong; and notice a plan limit and
tell the user. About twenty scenarios live in `scenarios/`, and five are
withheld in the private holdout repo. After Phase 5, the QA explorer is the main
source of new scenarios, and each one enters through a human-merged PR.
Satisfaction is a fraction, not a boolean. The release gate is 100% on the
holdouts across three consecutive runs.

## 8. Phases and gates

Each phase ends at a gate that a machine can check. Every phase runs in orbs,
and the workflow plugin drives it. Phase 0 holds the only local steps, and it
lists them.

### Phase 0: complete the intent

Do this locally, once: create the Amp workspace, install the plugin, and start
the chief-of-staff agent. Everything else in this phase runs in an orb that is
launched from here.

- De-fork: leave the fork network in the GitHub repository settings. Delete all local and remote tags. Remove the `upstream` remote.
- Remove the Python remnants: `.github/workflows/*` (all six), `.pre-commit-config.yaml`, `.python-version`, `.envrc`, `.claude/settings.json`, `.claude/commands/*`, the caches, `.venv`, and `.coverage`. Rewrite `.gitignore` and `.env.example` for Rust and mise.
- Fix the variable name in the local `.env` to `DEADMANSNITCH_API_KEY`.
- Write `LICENSE` (both lines), `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `docs/guardrails/*`, `docs/donors.md`, `docs/automations/*`, `deny.toml`, `mise.toml`, `hk.pkl`, `.gitleaks.toml`, the workspace `Cargo.toml` with the lint block and four empty crates, `release-plz.toml`, `dist-workspace.toml`, and the CI skeleton (fmt, clippy, nextest, deny, MSRV, doc, coverage).
- Write `.agents/setup` and `.agents/resume`. Write the plugin skeleton with one trivial gated pipeline that runs `mise run lint` in an orb and reports.
- Spikes that must pass before Phase 1: a gated pipeline in an orb blocks on a failing `mise run` step and proceeds on a passing one; an automation wrapped in a runbook survives a deliberately failing run without staying paused, or the webhook path is chosen instead; the SDK's `mcpConfig` works inside an orb; an orb can reach the live DMS API and receives the key through Amp's secret delivery.
- Create the private holdout repo and the fine-grained token for it.
- Add `DEADMANSNITCH_API_KEY` as a repository secret for the drift job.
- Run `check-dev-env.fish` and clear its worklist.
- Gate: CI is green on an empty workspace. Every document in section 6.1 exists. The dev-env checker passes. The run report records all four spikes as passing. A fresh agent that gets only `AGENTS.md` can state the operating loop and find the API reference.

### Phase 1: twin and differential suite

- Build the twin per section 4, with unit tests for the state machine and for every documented response. The state machine is a parallel-attempt gate (section 0).
- Build the differential suite. If the plan upgrade has landed, run the suite once live to produce the golden master, and iterate the twin until the diff is empty. If it has not landed, build to the reference document and add "reconcile with golden" as the first task of Phase 2.
- Gate: the differential suite is green against the twin. The twin tests cover every row of sections 3, 4, and 5 of the API reference. The one-minute build-and-test bound is measured and recorded.

### Phase 2: typed client (`deadmanssnitch`)

- Write the domain types with newtypes and closed enums plus `Unknown` variants. The wire module is the only place where `serde_json::Value` appears. Add the `from_status` error mapping with remediations, the retry policy, the secret handling, the base URL overrides, and the check-in client, which uses the snitch's `check_in_url`.
- Gate: every endpoint and every error kind is exercised against the twin, including the injected faults. The key-leak test passes. Coverage is 100%. The `cargo semver-checks` baseline exists. `cargo doc` is clean.

### Phase 3: MCP server over stdio

- Build the tools, the structured output, the annotations, the read-only mode, the allow and deny modes, the `check_in` gating, the resources and templates, the completions, the prompts, the elicitation confirm on delete, the instructions, the icons, the cache hints, the stderr tracing, and the clean shutdown.
- Tests: in-process duplex client tables; golden masters; annotation invariants; the binary contract test; the Inspector with `--strict`; the generated README table.
- Gate: all verifiers in section 6.2 are green, except the HTTP-only ones. The two old slash-command walkthroughs succeed as scenarios against the twin.

### Phase 4: Streamable HTTP and official conformance

- Add `StreamableHttpService` in axum, a loopback default, `--allow-remote` with a mandatory token, Origin and Host validation, and `/health`. This is a parallel-attempt gate (section 0).
- Run the official conformance suite in CI on 2026-07-28 (gating) and on 2025-11-25 (report-only), with an expected-failures baseline.
- Gate: the baseline entries are auth-only, and each one carries a justification. The HTTP tests run through `tower::ServiceExt::oneshot`.

### Phase 5: scenarios, holdouts, unattended convergence

- Author the scenarios and the runner. Withhold five of them to the holdout repo.
- Run the implement-validate loop until the holdouts pass three times in a row.
- Turn on the QA explorer and the refactor agent after the holdouts pass.
- Optional: a Sentry-style tool-prediction eval that runs only when a tool file changes.
- Gate: 100% holdout satisfaction on three consecutive runs. MISTAKES and LEARNINGS are reviewed and folded into the guardrails or the verifiers.

### Phase 6: distribution

- `cargo-dist`: a shell installer, four targets, and attestations. Patch the action refs to SHAs with `allow-dirty = ["ci"]`.
- The release-plz release PR flow. Publish `deadmanssnitch` and `mcp-deadmansnitch` to crates.io through OIDC. Write `server.json` with `registryType: "cargo"` and an OCI entry. Push a distroless image to GHCR with the `io.modelcontextprotocol.server.name` label. Publish to the MCP registry with `mcp-publisher login github-oidc`.
- README: the pitch and the transport statement, the install steps, the client config snippets (generic and Claude Code), the flag and env table with the precedence, the generated tools table with read-only and destructive markers, the read-only mode, the safety and trust model, the development notes, and the credit line.
- Gate: a tagged release installs on this Mac through the shell installer and passes the Inspector smoke test. The README config works end to end.

## 9. Background loops (`docs/automations/`)

Each loop is an Amp automation on a sleeping orb. Each loop has a runbook. The
runbook states the condition that should remain true, the drift signal, the
evidence that a change restores the condition, the authority level, the durable
state that the loop keeps, and its retirement condition. The prompt of each loop
is two sentences that delegate to the runbook. Each loop ends by writing a
status line that the loop-health loop reads. Each loop that changes anything
opens a PR, and no loop merges one.

| Loop | Cadence | Authority | What it does |
|---|---|---|---|
| Twin drift | Weekly | Report-only | Runs the live differential suite. On a diff, it opens an issue with the normalized diff and a proposed twin change. It never deletes anything that it did not create |
| Dependency sweep | Monthly | PR | Re-pins `mise.toml` and the Cargo deps, and respects the cooldown. Runs the full matrix. Opens a PR |
| Release | On release PR | PR review | The human reviews the release PR and then merges it. The loop prepares the review |
| Security red team | Weekly | Report-only | Red-teams the repo. It must prove impact or exploitability before it files. Its surface is the HTTP auth, the Origin handling, prompt injection through upstream text, secret leakage, and SSRF through the URL override flags |
| Doc drift | Weekly | PR | Checks that every path and symbol cited in `ARCHITECTURE.md` and the guardrails still resolves, and that the README claims match the generated tables |
| Coverage ratchet | Monthly | PR | Proposes a higher floor for any crate that has stayed above its floor for a month |
| Flake hunter | Weekly | Issue | Reruns the suite N times. It files anything nondeterministic as an infrastructure bug |
| Refactor | Continuous | PR | Has one mission: fewer lines of code. A person closes its PR unread unless the tests stay green, the coverage does not drop, and the line count drops |
| QA explorer | Continuous | Issue plus PR | Acts as a user against the twin, with random seeds and faults, in a fresh orb. Files an issue and a PR that adds a Given, When, Then scenario. Triage removes duplicates and assigns a severity. A human merges or closes |
| Loop health | Daily | Issue | Checks that no automation is paused and that every loop wrote its status line. Files an issue if either is false |
