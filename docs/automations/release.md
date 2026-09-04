# release runbook

- Cadence: on release PR
- Authority: pull request review
- Condition: Release metadata matches tested artifacts.
- Drift signal: A release-plz PR.
- Action: Prepare evidence for human review; never merge.
- Durable state: Release report.
- Retirement: Retire if releases stop.

Read this runbook, execute only its authority, and finish by writing a dated status line for loop-health. Any repository change opens a PR and is never merged by the loop.
