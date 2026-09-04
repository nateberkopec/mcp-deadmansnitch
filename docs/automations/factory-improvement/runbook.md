# Factory improvement runbook

- Cadence: daily.
- Authority: pull request limited to factory/process configuration and `docs/automations/factory-improvement/backlog.md`.
- Condition: implementation agents use tokens, paid execution time, and tools efficiently, recurring factory friction becomes a prioritized improvement, and invariants advance toward deterministic enforcement.
- Drift signal: repeated commands or reads, repeated failures, avoidable context growth, low-value token use, expensive retries, recurring setup and routing confusion, invariant violations, or an invariant that remains Guarded, Partial, or Planned despite an available deterministic verifier.
- Evidence: `docs/factory/invariants.md`, verifier and test failures, aggregate counts, timings, cost metadata, and sanitized process descriptions from all available implementing-agent sessions since the previous run.
- Action: investigate invariant violations and their causes; identify practical ways to move invariants to Enforced; deduplicate findings; rank validated improvements by expected impact and effort; update `docs/automations/factory-improvement/backlog.md`; and open a PR. After activation, because it changes the factory, require an owner-signed current head in addition to passing CI and an independent reviewer with no further feedback. Change an invariant's status only in the same change that adds passing enforcement proof.
- Durable state: the prioritized backlog, each referenced invariant ID and enforcement gap, the last analyzed session boundary, and a dated status line consumed by loop-health.

Treat transcripts as sensitive. Analyze them in place; never copy credentials, API keys, personal data, proprietary source excerpts, user content, or other sensitive transcript text into the backlog, branch, issue, logs, or status. Use aggregate measurements and redacted paraphrases only. If a finding cannot be supported without sensitive content, omit it and report only that restricted evidence was excluded.
