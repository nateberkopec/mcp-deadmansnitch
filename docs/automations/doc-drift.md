# doc-drift runbook

- Cadence: weekly
- Authority: pull request
- Condition: Documented paths and claims resolve.
- Drift signal: Broken links or generated-table diff.
- Action: Open a documentation-only PR.
- Durable state: Last scan.
- Retirement: Retire if docs become generated.

Read this runbook, execute only its authority, and finish by writing a dated status line for loop-health. Any repository change opens a PR. The factory merges it after CI passes and an independent reviewer has no further feedback; after activation, factory changes also require an owner-signed current head.
