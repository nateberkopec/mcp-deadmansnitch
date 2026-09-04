# Factory

The factory turns repository state into reviewed, verified changes. Amp supplies isolated orbs; this directory supplies orchestration, runbooks, guardrails, and deterministic gates.

The chief of staff is the only role that reads `SPEC.md` with `factory/roadmap.md`. It compares them with `HEAD`, open issues, pull requests, and active agents; then creates issues only when capacity exists. One issue owns one worker. Phases guide timing but are not factory states.

```mermaid
flowchart LR
    H[HEAD and plan] --> C[Chief of staff]
    C -->|capacity available| I[One issue]
    I --> W[One worker orb]
    W --> P[Pull request]
    P --> G[CI]
    G -->|failure| W
    G --> R[Independent review]
    R -->|feedback| W
    R -->|accepted| S{Current with main?}
    S -->|conflict| X[Conflict resolver orb]
    X --> G
    S -->|yes| M[Merge and close issue]
    M --> C
```

The chief of staff shepherds each issue until merge or an interminable blocker. Retries are bounded. Any changed head repeats CI and independent review. Conflicts go to a fresh resolver rather than the original worker. GitHub issues, branches, pull requests, reviews, and checks are durable workflow state.

Most changes merge after CI passes and an independent reviewer has no further feedback. During construction, branch protection and signature enforcement remain disabled. Final activation installs those controls and requires an owner-signed current head for factory changes. Publishing, destructive operations, paid-orb actions, and account changes always require explicit authority.

## Layout

- `factory/agents/` defines agent models, reasoning, tools, context, prompts, authority, and outputs.
- `factory/amp/plugin/` is the executable control plane; `.amp/plugins/factory` is its Amp adapter.
- `factory/automations/config.json` and `factory/queues.json` define recurring work and backpressure.
- `factory/orb/` establishes the pinned mise environment; `.agents/` exposes Amp's required paths.
- `factory/guardrails/`, `factory/invariants.md`, and `factory/roadmap.md` hold policy.
- `projects/` contains the four product projects.

The main Amp project has no DMS credentials. Twin validation receives only the DMS test key. Holdout validation receives only its repository token and tests through the twin. The privileged DMS account has functionally unlimited capacity, but differential runs remain bounded and self-cleaning.
