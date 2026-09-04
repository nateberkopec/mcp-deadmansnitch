# Factory plugin

See `docs/factory/readme.md` for the system overview.

The factory is this repository's Amp control plane. It launches work in isolated orbs, runs deterministic `mise` gates, and routes recurring maintenance through checked-in runbooks. Its improvement loop investigates invariant violations and converts prose protections into deterministic enforcement. Agents propose changes; exit codes decide gates; humans merge changes that expand the specification.

Current status: the Phase 0 foundation is verified. Orb setup, project and secret isolation, the lint gate, project-level MCP delivery, and the recovery webhook work. The plugin currently exposes the diagnostic gate and webhook status tools plus the automation runbook manifest. Phase pipelines, attempt budgets, parallel review, branch and workflow-state tracking, and scheduled loops are not implemented yet.

`index.ts` is the plugin entry point. `docs/factory/invariants.md` tracks enforcement. `docs/automations/` owns loop instructions and state. `PLAN.md` defines the target factory and phase gates.
