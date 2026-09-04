# refactor runbook

- Cadence: continuous
- Authority: pull request
- Condition: Equivalent behavior uses fewer lines.
- Drift signal: Tests pass, coverage holds, line count falls.
- Action: Open a narrow PR; never merge.
- Durable state: Before/after metrics.
- Retirement: Retire when no qualifying simplification remains.

Read this runbook, execute only its authority, and finish by writing a dated status line for loop-health. Any repository change opens a PR and is never merged by the loop.
