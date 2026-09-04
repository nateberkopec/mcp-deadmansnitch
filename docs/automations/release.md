# release runbook

- Cadence: on release PR
- Authority: pull request review
- Condition: Release metadata matches tested artifacts.
- Drift signal: A release-plz PR.
- Action: Prepare evidence and wait for explicit publishing authority before the reviewed and CI-gated merge.
- Durable state: Release report.
- Retirement: Retire if releases stop.

Read this runbook, execute only its authority, and finish by writing a dated status line for loop-health. Any repository change opens a PR. Release PRs wait for explicit publishing authority, then merge after CI passes and an independent reviewer has no further feedback.
