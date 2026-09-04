# twin-drift runbook

- Cadence: weekly
- Authority: report-only
- Condition: The twin agrees with the live API.
- Drift signal: A normalized differential diff.
- Credential boundary: This twin-fidelity run is the sole consumer of the factory-owned DMS API key. The key is never passed to client, MCP, scenario, QA, holdout, review, or release work.
- Action: Run a bounded, self-cleaning differential probe and open an issue with the diff; never mutate pre-existing records. The privileged account has functionally unlimited snitches and rate limit, but the run does not infer ordinary quota behavior from it.
- Durable state: The differential golden and latest report.
- Retirement: Retire if the external API is removed.

Read this runbook, execute only its authority, and finish by writing a dated status line for loop-health. Any repository change opens a PR. The factory merges it after CI passes and an independent reviewer has no further feedback; factory changes also require current-head human approval.
