# loop-health runbook

- Cadence: daily
- Authority: issue
- Condition: No automation stays paused and each reports status.
- Drift signal: Missing status or paused automation.
- Action: File an issue.
- Durable state: Per-loop status lines.
- Retirement: Retire with background automation.

Read this runbook, execute only its authority, and finish by writing a dated status line for loop-health. Any repository change opens a PR. The factory merges it after CI passes and an independent reviewer has no further feedback; factory changes also require current-head human approval.
