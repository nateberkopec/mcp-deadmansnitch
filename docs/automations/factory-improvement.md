# Factory improvement runbook

- Cadence: daily.
- Authority: pull request limited to factory/process configuration and `docs/factory-improvements.md`.
- Condition: implementation agents use tokens, paid execution time, and tools efficiently, and recurring factory friction becomes a prioritized improvement.
- Drift signal: repeated commands or reads, repeated failures, avoidable context growth, low-value token use, expensive retries, or recurring setup and routing confusion across implementing-agent session transcripts.
- Evidence: aggregate counts, timings, cost metadata, and sanitized process descriptions from all available implementing-agent sessions since the previous run.
- Action: deduplicate findings, rank validated improvements by expected impact and effort, update `docs/factory-improvements.md`, and open a PR. Never merge it.
- Durable state: the prioritized backlog, the last analyzed session boundary, and a dated status line consumed by loop-health.
- Retirement: retire when the factory no longer uses transcript-producing implementation agents.

Treat transcripts as sensitive. Analyze them in place; never copy credentials, API keys, personal data, proprietary source excerpts, user content, or other sensitive transcript text into the backlog, branch, issue, logs, or status. Use aggregate measurements and redacted paraphrases only. If a finding cannot be supported without sensitive content, omit it and report only that restricted evidence was excluded.
