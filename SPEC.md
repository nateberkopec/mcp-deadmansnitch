# mcp-deadmansnitch specification

This is the normative product contract for the Rust MCP server, typed client, deterministic twin, and conformance suite. Factory behavior lives under `factory/`; API references live under `docs/reference/`. The previous Python implementation remains in Git history as evidence, not a template.

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
| Live API contact | The factory-owned DMS test key is a twin-development credential used only by the twin differential suite. Client, MCP, scenario, QA, holdout, review, and release work never receives it |
| Live safety | The suite deletes only the tokens that it created in the same run, and it keeps those tokens in memory. It never lists snitches and then deletes them by name prefix. If it finds leftovers from an earlier run, it stops and reports them, and a human cleans up. It never changes or deletes anything that already exists in the account |
| Test account capacity | The account has functionally unlimited snitches and rate limit. Differential runs remain bounded, clean up their own records, and do not treat privileged capacity as evidence for ordinary quota behavior |
| Holdouts | The holdouts are in the private repo `nateberkopec/mcp-deadmansnitch-holdout`. Only the validate step clones it, with a fine-grained token whose scope is that repo |

### Implementation constraints

| Decision | Choice |
|---|---|
| Toolchain | Rust 2024 with MSRV 1.88 |
| MCP SDK | Pin `rmcp` to `=3.2.x` with `server`, `macros`, `transport-io`, `schemars`, `elicitation`, and `transport-streamable-http-server` |
| Test scope | Unit and in-process tool tests run fast; conformance, binary-contract, and scenario tests gate CI |
| Coverage | `deadmanssnitch` and the twin state machine stay at 100%; all other coverage ratchets upward |

### Release and distribution

| Decision | Choice |
|---|---|
| Release builds | `cargo-dist` generates the GitHub Actions release workflow, builds all targets, and signs build-provenance attestations. Patch its action references to full SHAs. Mark the file `allow-dirty = ["ci"]` |
| Release automation | `release-plz` maintains the changelog, versions, release pull requests, and tags |
| Targets | Build for Linux musl and macOS, each on x86_64 and aarch64. Do not build for Windows |
| Channels | Supply a shell installer, `cargo install`, a GHCR container image, and an MCP registry entry (`server.json`). Supply no PowerShell installer, no MCPB bundle, and no Homebrew tap |
| Dependencies | Run Dependabot monthly, with grouped updates and a cooldown of seven days. Run `cargo deny check advisories` weekly on a schedule. Pin the actions to full SHAs. Set the default workflow permissions to read-only. Publish to crates.io with OIDC trusted publishing |
| Changelog | Start a new `CHANGELOG.md` at 0.1.0 with a link to the Python history. Log each tool rename |

## Functional contract

### 2.1 Tools

Each tool takes flat arguments in snake_case with `deny_unknown_fields`. Each
field supplies schema-description metadata without comment syntax. Each tool sets
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

## Non-functional contract

- One static binary for each target: Linux musl and macOS, on x86_64 and aarch64. Startup takes less than 50 ms. There are no runtime dependencies.
- No upstream response causes a panic. Malformed JSON, HTML 404 pages, empty 400 bodies, and unknown enum values all become typed errors.
- `#![forbid(unsafe_code)]`.
- `secrecy::SecretString` holds the API key. The server sends the key in a header that is marked sensitive. The key never reaches a log, a `Debug` output, or a tool result. A test greps all captured stdout and stderr for the key.
- These are all bounded: the request timeout, the retry budget, the response size, the list size, and the text block size.
- The server exits cleanly with exit code 0 on stdin EOF, on SIGTERM, and on SIGINT.
- A warm `test:fast` run takes less than ten seconds; the factory records full build-and-test time.
- Supply chain: `deny.toml` checks the advisories, permits MIT and Apache-2.0 plus the Unicode-3.0 data license required by rmcp's URL stack, and permits no duplicate versions except the required syn 2/syn 3 split. It permits known registries only. Dependabot follows the release policy above. The actions are pinned by SHA. The default workflow permissions are read-only. Publishing uses OIDC trusted publishing.
- The compatibility surfaces, from the strictest to the least strict, are the tool names and argument schemas, the `structuredContent` shapes, the CLI flags and env vars, and the MCP spec revisions served. A change to a tool name or an argument schema is a semver-major change. The `deadmanssnitch` library has its own semver gate.

## Digital twin design (`deadmanssnitch-twin`)

The twin is a separate crate. It shares no code with `deadmanssnitch` and no
code with the server. Some things are needed in both places, such as the
interval list and the error strings. The project duplicates those things on
purpose, so that a mistake in one place cannot hide a mistake in the other.

### Surfaces Surfaces

- API listener: serves every endpoint in sections 3 and 5 of `docs/reference/dms-api-v1.md`, with verbatim status codes, bodies, and headers. It uses basic auth, and you can configure the valid keys. It returns an HTML 404 for an unknown route. It returns a 400 with an empty body for malformed JSON. It emits the legacy `type.interval` field. It accepts the legacy nested `type.interval` on create. It returns 200 on create, not 201. It returns 204 on pause, unpause, and delete. The tag endpoints return bare arrays. The listener accepts a trailing slash. The tag filter is an AND filter. You can configure the plan limit, and the listener checks the 402 condition before it validates the body.
- Check-in listener: uses a separate port and stands in for `nosnch.in`. It returns 202 with the body `Got it, thanks!\n` for GET, POST, PUT, and PATCH, for any token. It returns 405 with an `Allow` header for HEAD and DELETE. It returns 404 with the documented body when there is no token. It reads `m` and `s` from the query string, from a form body, or from JSON. It sends the rate-limit headers and applies the rule of 10 per hour and then 1 per minute. When `s != 0`, the status moves to `errored`. The `check_in_url` field in every snitch object points at this listener.
- Control plane under `/_twin/`: `POST reset` resets the twin. `POST seed` bulk-loads snitches. `GET|POST clock` freezes time and advances it. `POST faults` adds to a queue of one-shot faults: a status override, a delay, a dropped connection, malformed JSON, a 429 with `Retry-After`, and an HTML body. `POST plan` sets the limit, sets whether smart intervals are allowed, and sets whether the twin honors `s`.

### State machine State machine

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

### Determinism Determinism

The store is in memory. The token generator uses a seed and produces 10
lowercase hex characters. The clock is frozen. `reset` runs between the
scenarios.

### Differential conformance suite Differential conformance suite (`deadmanssnitch-conformance`)

The suite is a binary and a test module. It runs a fixed script of requests
against a pair of base URLs. The script does these steps: create; read; list
with tags and without tags; update each field; add a tag and remove a tag;
pause with each form of `until`; unpause; check in with `m` and with `s`; and
delete. The script also triggers every error path that is safe to trigger: bad
auth, unknown token, bad interval, empty body, malformed JSON, and a pause on a
pending snitch. The suite records the responses in a normalized form, and it
masks the volatile fields: the token, `href`, the timestamps, `x-request-id`,
`x-runtime`, and the rate-limit counters. The suite has two modes:

- `--target twin` runs on every CI job. The suite compares the recorded output with the checked-in golden master `projects/deadmanssnitch-conformance/golden/live.json`.
- `--target live` is the sole consumer of the factory-owned `DEADMANSNITCH_API_KEY`. It runs only in twin-validation to build or verify the twin. It creates bounded batches of its own snitches with the name prefix `mcp-conformance-` and remembers their tokens in memory. At the end of the same run, it deletes only those tokens. If leftovers exist, it stops before creating anything and reports them for human cleanup. It never lists and deletes snitches or modifies records it did not create. It does not infer ordinary quota behavior from the privileged account. It runs weekly and by manual dispatch. A diff opens an issue with the normalized diff.

The golden master comes from the first live twin-development run. The twin is not done until it matches the golden master.

## Acceptance verifiers

- Crate-root lint block: `clippy::all`, `clippy::pedantic`, `clippy::cargo`, `missing_docs`, `missing_debug_implementations`, `unused_qualifications`, and `#![forbid(unsafe_code)]`. The source warns, and CI uses `-D warnings`. Each `allow` is local and carries a `reason` attribute rather than a comment.
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
- The repo-owned comment linter rejects comment syntax in every tracked source format and exempts only executable shebangs. CI and `mise run lint` invoke it.
- hk pre-commit runs `lint`, `lint:secrets`, and `test:fast`. `lint:secrets` runs gitleaks with `.env` allowlisted. The `commit-msg` step checks the conventional-commit format.
- The Inspector runs with `--cli --strict` against the built binary in CI.
- The official conformance suite runs against HTTP mode. The 2026-07-28 run gates CI and uses a checked-in expected-failures baseline, in which the auth entries are justified. The 2025-11-25 run is report-only.
- The differential suite runs against the twin on every run, and against the live API weekly.
- The workflow gates in the plugin run the same commands as CI, and both invoke them through `mise run`. Therefore a gate cannot pass locally and fail in CI, or fail locally and pass in CI.

## Acceptance evidence

| Claim | Evidence |
|---|---|
| The client speaks the DMS API correctly | The differential suite passes against the twin, and the twin's golden master came from the live API |
| The twin is faithful | The weekly live differential run is green, and every observed edge case in `docs/reference/dms-api-v1.md` has a twin test |
| Tools behave as specified | In-process rmcp client tests, table-driven per tool, run against the twin and cover every error kind and every fault |
| The binary works over stdio | A `TokioChildProcess` contract test on the real binary, plus the Inspector with `--strict` |
| The server is spec-conformant | The official conformance suite on 2026-07-28, in HTTP mode, with a baseline that is empty or justified |
| No secret leaks | The key-grep test over all captured output, plus the redacting `Debug` test |
| An agent can use it for real tasks | The scenarios below pass, including the holdouts. An independent agent judges them |
| Releases are what CI tested | release-plz tags from a merged release PR. The release workflow builds from that tag, and the artifacts carry attestations |

### Scenarios

Scenarios are deterministic Given/When/Then stories at the MCP boundary. A seed and fault schedule produce mechanically checked tool calls and twin state, followed by an independent soft-assertion judgment. The runner starts the twin and server; holdout execution uses the secret-free holdout-validation project.

Public scenarios live in `projects/mcp-deadmanssnitch/scenarios/`; five remain private holdouts. They cover realistic setup, diagnosis, bulk pause, retry, confirmation, authentication failure, and plan-limit behavior. QA exploration uses them as guidance rather than scripts while role-playing varied users and reporting novel defects or improvements. Satisfaction is a fraction; the Phase 5 gate is 100% holdout satisfaction across three consecutive runs.

