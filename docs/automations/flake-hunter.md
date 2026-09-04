# flake-hunter runbook

- Cadence: weekly
- Authority: issue
- Condition: Tests are deterministic.
- Drift signal: A repeated run differs.
- Action: File an infrastructure issue with seed and logs.
- Durable state: Flake history.
- Retirement: Retire when the test suite is removed.

Read this runbook, execute only its authority, and finish by writing a dated status line for loop-health. Any repository change opens a PR. The factory merges it after CI passes and an independent reviewer has no further feedback; after activation, factory changes also require an owner-signed current head.
