# twin-drift runbook

- Cadence: weekly
- Authority: report-only
- Condition: The twin agrees with the live API.
- Drift signal: A normalized differential diff.
- Action: Open an issue with the diff; never mutate pre-existing records.
- Durable state: The differential golden and latest report.
- Retirement: Retire if the external API is removed.

Read this runbook, execute only its authority, and finish by writing a dated status line for loop-health. Any repository change opens a PR. The factory merges it after CI passes and an independent reviewer has no further feedback; factory changes also require current-head human approval.
