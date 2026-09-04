# security-red-team runbook

- Cadence: weekly
- Authority: report-only
- Condition: Auth, origins, untrusted text, secrets, and URL overrides resist abuse.
- Drift signal: A reproducible exploit.
- Action: File only demonstrated impact.
- Durable state: Last assessment and findings.
- Retirement: Retire only with the HTTP product.

Read this runbook, execute only its authority, and finish by writing a dated status line for loop-health. Any repository change opens a PR. The factory merges it after CI passes and an independent reviewer has no further feedback; factory changes also require current-head human approval.
