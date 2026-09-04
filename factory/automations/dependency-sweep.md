# dependency-sweep runbook

- Cadence: monthly
- Authority: pull request
- Condition: Dependencies remain supported and pinned.
- Drift signal: Outdated or vulnerable dependency output.
- Action: Open a tested grouped update PR after cooldown.
- Durable state: Last successful sweep date.
- Retirement: Retire when automated updates are removed.

Read this runbook, execute only its authority, and finish by writing a dated status line for loop-health. Any repository change opens a PR. The factory merges it after CI passes and an independent reviewer has no further feedback; after activation, factory changes also require an owner-signed current head.
