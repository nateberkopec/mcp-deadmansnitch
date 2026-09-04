# coverage-ratchet runbook

- Cadence: monthly
- Authority: pull request
- Condition: Coverage floors never decrease.
- Drift signal: Sustained coverage above floor.
- Action: Propose a higher floor.
- Durable state: Coverage history.
- Retirement: Retire at complete enforced coverage.

Read this runbook, execute only its authority, and finish by writing a dated status line for loop-health. Any repository change opens a PR and is never merged by the loop.
