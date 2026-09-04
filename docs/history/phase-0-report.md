# Phase 0 run report

Finalized 2026-09-04. This is a historical snapshot of the Phase 0 gate, not current operating guidance.

## Repository work completed

The repository left its fork network, all legacy tags and the `upstream` remote were removed, and the Python-era implementation and caches were replaced by the four-crate Rust/mise workspace. Repository-owned verifiers, routed documents, CI and release scaffolding, Amp orb lifecycle scripts, the factory plugin, automation runbooks, and the sanitized factory-improvement backlog are present. Code comments are prohibited by `AGENTS.md` and enforced by `bin/check-no-comments` locally, in hooks, and in CI.

The accidentally tracked local `.env` was removed from Git history, its old object was pruned, and the preserved file is ignored and untracked. Secret values were never recorded in this report or orb output.

## Deterministic gates

`check-dev-env.fish`, `mise run lint`, `mise run test`, `mise run lint:secrets`, release compilation, rustdoc with warnings denied, coverage execution, hk configuration loading, factory-plugin TypeScript typechecking, workflow YAML parsing, and `git diff --check` pass. The three workspace smoke tests pass. CI passed for commit `923cff9` in [run 33827613358](https://github.com/nateberkopec/mcp-deadmansnitch/actions/runs/33827613358).

A fresh chief-of-staff orb given the repository instructions stated the operating loop and located `docs/reference/dms-api-v1.md` in [thread T-01a06a1b-4913-735e-b9b7-d4ef8317b30c](https://ampcode.com/threads/T-01a06a1b-4913-735e-b9b7-d4ef8317b30c).

## Account-side setup

The `dead-mans-mcp` Amp workspace contains separate main and validation projects. Only the validation project receives `DEADMANSNITCH_API_KEY` and the fine-grained holdout token. The private `nateberkopec/mcp-deadmansnitch-holdout` repository is not a fork, Amp can clone it, and its token is limited to that repository. The DMS key is also configured as a GitHub Actions secret without exposing its value. Publication and release activation remain reserved for their later human gates.

## Required spikes before Phase 1

All four spikes passed:

1. The factory plugin blocked after a deliberate failing gate and proceeded after a passing gate in [thread T-01a06a0a-b843-7490-a61d-f5bac588e86d](https://ampcode.com/threads/T-01a06a0a-b843-7490-a61d-f5bac588e86d).
2. The durable `factory-health` webhook was registered as the recovery path for paused Amp schedules in [thread T-01a06a17-9d40-7041-85c0-faf74b204282](https://ampcode.com/threads/T-01a06a17-9d40-7041-85c0-faf74b204282).
3. An orb in the validation project invoked the project-level `phase-zero-test` MCP server successfully in [thread T-01a06a27-b7c0-73be-a7e5-19adb62bc242](https://ampcode.com/threads/T-01a06a27-b7c0-73be-a7e5-19adb62bc242).
4. The same validation orb received a non-empty DMS secret, received HTTP 200 from the live snitches endpoint, and verified that the body was a JSON array. It also received the holdout token, received HTTP 200 from the private repository endpoint, and matched the expected repository identity. Only statuses and booleans were reported.

Amp did not provide billed usage for these threads. Wall-clock thread lifetimes are recorded as the available proxy: gate spike 0.13 hours, webhook spike 0.06 hours, chief-of-staff verification 0.02 hours, and validation access spike 0.23 hours, totaling 0.44 hours.

Phase 0 is complete. Phases 1 through 6 remain intentionally unimplemented.
