# Factory plugin

This project plugin registers `factory: Run Phase 0 lint gate` and the
`factory_phase_zero_gate_spike` diagnostic tool. Run them from an Amp orb
thread. The plugin executes gates through `amp.$`, and exit codes alone decide
whether the pipeline blocks or proceeds. Both entry points refuse local
execution so gates cannot accidentally run on the orchestrator machine.

`automationRunbooks` is the checked-in manifest for account-side loops,
including the daily transcript-based factory-improvement loop. In an orb the
plugin also registers a durable `factory-health` webhook; this is the recovery
path because Amp pauses scheduled automations after a failed run. Webhook input
is ignored except for Amp's event ID, and the fixed handler delegates to the
loop-health runbook. Automations are created from their orb threads after
reading the matching runbook.

The remaining Amp workspace/project creation, schedules, webhook registration,
secret configuration, and orb spikes require authenticated account-side setup.
