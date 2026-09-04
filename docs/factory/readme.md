# Factory

The factory is the repository-owned system that turns approved work into reviewed, verified changes. Amp supplies orchestration and isolated orbs; this repository supplies policy, workflows, runbooks, and deterministic `mise` gates. Agents propose and evaluate changes, while shell exit codes decide mechanical gates.

Most pull requests merge as soon as CI passes and an independent reviewer reports no further feedback. After final activation, a pull request that touches the factory additionally requires a current-head commit signed by the repository owner. Branch protection and that signature gate remain disabled while the factory itself is under active construction. Publishing and account changes retain their explicit authority requirements.

```mermaid
flowchart LR
    H[Approved work] --> C[Puck]
    C --> P[Factory plugin]
    P --> A[Fresh implementation orb]
    A --> G[mise and CI gates]
    G -->|fail| R[Bounded retry]
    R --> A
    G -->|pass| V[Fresh reviewer orb]
    V -->|feedback| A
    V -->|no further feedback| F{Factory changed?}
    F -->|no| M[Merge]
    F -->|yes| U[Owner-signed current head]
    U --> M
```

Puck is the operator interface: it launches, monitors, steers, and summarizes work. The checked-in plugin remains the durable control plane for gates, retries, events, and merge policy.

The main Amp project runs implementation without DMS credentials. A twin-validation project is the sole holder of the factory-owned DMS test key and uses it only to build or verify twin fidelity. A separate holdout-validation project receives only the holdout token and tests through the twin. The privileged DMS account has functionally unlimited snitches and rate limit, but differential runs remain bounded and self-cleaning.

```mermaid
flowchart TB
    P[Factory plugin] --> MAIN[Main project]
    P --> TV[Twin-validation project]
    P --> HV[Holdout-validation project]
    MAIN --> TWIN[Digital twin]
    TV --> TWIN
    TV --> LIVE[Live DMS API]
    HV --> TWIN
    HV --> HOLDOUT[Private holdouts]
    MAIN -. no factory DMS key .-> LIVE
    HV -. no factory DMS key .-> LIVE
```

## Repository structure

- `.amp/plugins/factory/` contains the executable control plane.
- `.agents/setup` and `.agents/resume` establish the pinned mise environment in every orb.
- `docs/factory/invariants.md` tracks invariant ownership, proof, and enforcement status.
- `docs/automations/` contains loop runbooks and automation-owned state.
- `docs/guardrails/` gives workers only the guidance relevant to their task.
- `docs/PLAN.md` defines active phase gates; completed plans and reports move to `docs/history/`.

The factory-improvement loop examines failures, sanitized process evidence, and unenforced invariants. Its pull requests follow the same merge policy and require human approval because they change the factory. A durable health webhook provides recovery because failed Amp schedules pause.

Installing branch protection and the owner-signature gate is the final factory activation step, after unattended Phase 1–5 execution is ready.

The Phase 0 foundation is verified. Orb setup, isolation, secret delivery, deterministic gate behavior, and webhook recovery work. Phase pipelines, automated reviewed-and-green merging, bounded attempt controllers, parallel review, durable workflow state, issue routing, and scheduled loops are implemented incrementally with the product phases.
