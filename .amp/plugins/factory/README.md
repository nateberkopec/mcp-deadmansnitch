# Factory plugin

This project plugin registers `factory: Run Phase 0 lint gate`. Run it from an
Amp orb thread; the plugin executes `mise run lint` through `amp.$`, and the
exit code alone decides whether the gate passes. The command refuses local
execution so the gate cannot accidentally run on the orchestrator machine.

`automationRunbooks` is the checked-in manifest for account-side loops,
including the daily transcript-based factory-improvement loop. Automations are
created from their orb threads after reading the matching runbook.

The remaining Amp workspace/project creation, schedules, webhook registration,
secret configuration, and orb spikes require authenticated account-side setup.
