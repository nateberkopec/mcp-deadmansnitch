# loop-health runbook

- Cadence: daily
- Authority: issue
- Condition: No automation stays paused and each reports status.
- Drift signal: Missing status or paused automation.
- Action: File an issue.
- Durable state: Per-loop status lines.
- Retirement: Retire with background automation.

Read this runbook, execute only its authority, and finish by writing a dated status line for loop-health. Any repository change opens a PR and is never merged by the loop.
