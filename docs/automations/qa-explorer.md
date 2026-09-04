# qa-explorer runbook

- Cadence: continuous
- Authority: issue and pull request
- Condition: User stories behave safely under seeds and faults.
- Drift signal: A novel reproducible scenario.
- Action: Open an issue plus scenario PR for the normal reviewed and CI-gated merge path.
- Durable state: Seeds and duplicate index.
- Retirement: Retire when exploratory QA is replaced.

Read this runbook, execute only its authority, and finish by writing a dated status line for loop-health. Any repository change opens a PR. The factory merges it after CI passes and an independent reviewer has no further feedback; factory changes also require current-head human approval.
