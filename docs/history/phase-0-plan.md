# Phase 0 plan: complete the intent

Finalized 2026-09-04. This is the historical Phase 0 plan, preserved after completion. See [`phase-0-report.md`](phase-0-report.md) for execution evidence.

Do this locally, once: create the Amp workspace, install the plugin, and start the chief-of-staff agent. Everything else in this phase runs in an orb that is launched from here.

- De-fork: leave the fork network in the GitHub repository settings. Delete all local and remote tags. Remove the `upstream` remote.
- Remove the Python remnants: `.github/workflows/*` (all six), `.pre-commit-config.yaml`, `.python-version`, `.envrc`, `.claude/settings.json`, `.claude/commands/*`, the caches, `.venv`, and `.coverage`. Rewrite `.gitignore` and `.env.example` for Rust and mise.
- Fix the variable name in the local `.env` to `DEADMANSNITCH_API_KEY`.
- Write `LICENSE` (both lines), `AGENTS.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `CONTRIBUTING.md`, `docs/guardrails/*`, `docs/reference/donors.md`, `docs/automations/*`, `deny.toml`, `mise.toml`, `hk.pkl`, `.gitleaks.toml`, the workspace `Cargo.toml` with the lint block and four empty crates, `release-plz.toml`, `dist-workspace.toml`, and the CI skeleton (fmt, clippy, nextest, deny, MSRV, doc, coverage).
- Write `.agents/setup` and `.agents/resume`. Write the plugin skeleton with one trivial gated pipeline that runs `mise run lint` in an orb and reports. Add the daily factory-improvement loop and its prioritized backlog at `docs/automations/factory-improvement/backlog.md`; transcript analysis records process-level evidence and never copies secrets or sensitive transcript content into the backlog.
- Spikes that must pass before Phase 1: a gated pipeline in an orb blocks on a failing `mise run` step and proceeds on a passing one; an automation wrapped in a runbook survives a deliberately failing run without staying paused, or the webhook path is chosen instead; the validation project's MCP configuration is available inside an orb; an orb in the dedicated validation project can reach the live DMS API and receives its static DMS key through Amp project-secret delivery.
- Create the private holdout repo and the fine-grained token for it.
- Add `DEADMANSNITCH_API_KEY` as a repository secret for the drift job.
- Run `check-dev-env.fish` and clear its worklist.
- Gate: CI is green on an empty workspace. Every document in section 6.1 exists. The dev-env checker passes. The run report records all four spikes as passing. A fresh agent that gets only `AGENTS.md` can state the operating loop and find the API reference.
