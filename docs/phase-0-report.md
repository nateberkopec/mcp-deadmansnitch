# Phase 0 run report

## Repository work completed

The Python-era tracked files and local caches were removed, the Rust/mise workspace was created with four scaffold crates, repository verifiers and routed documents were added, and the in-repo Amp factory plugin was created. The local `.env` key name was corrected without recording its value, and project-local hk pre-commit and commit-message hooks were installed.

## Deterministic gates

The local Phase 0 run passed `check-dev-env.fish`, `mise run lint`, `mise run test` (three smoke tests), `mise run lint:secrets`, release compilation, rustdoc with warnings denied, coverage execution, hk config loading, TypeScript typechecking, and workflow YAML parsing. `check-dev-env.fish` verifies required files, removed Python remnants, the shared toolchain pin, Cargo metadata, and hk configuration.

## Account-side and destructive setup

Completed: removed the `upstream` remote; deleted all local and origin legacy tags; created the private `nateberkopec/mcp-deadmansnitch-holdout` repository; and added `DEADMANSNITCH_API_KEY` as a GitHub Actions secret without displaying it.

Remaining:

- Leave the GitHub fork network through GitHub Settings or Support.
- Create the main and validation Amp projects, load the checked-in project plugin in an orb, and start the chief-of-staff agent.
- Create a fine-grained token scoped to the holdout repository.
- Add the DMS key as a secret only in the dedicated Amp validation project. DMS does not support exchanging Amp OIDC identity, so implementation orbs must remain in the separate main project.
- Activate Dependabot, CI, release, webhook, and scheduled-automation settings after human review.

## Required spikes before Phase 1

All four spikes remain pending because they require an Amp workspace, fresh orbs, account-side automation, or authorized secret delivery:

1. Prove an orb pipeline blocks on a failing `mise run` gate and proceeds on a passing gate.
2. Prove a runbook-wrapped automation recovers from deliberate failure without remaining paused, or select the webhook path.
3. Prove the validation project's MCP configuration is available inside its orbs; current Amp ignores per-run SDK `mcpConfig` during orb execution.
4. Prove an authorized validation orb can reach the live DMS API through Amp project-secret delivery without exposing the key.

No live API was contacted and no secret value was read into output. Commit `8e7e989`, which briefly tracked `.env`, was amended as `bf4c2a4`; its reflog was expired and the old object was pruned. The local file is preserved, ignored, and untracked. Rotate the credential if it was exposed anywhere outside this local history. Orb hours: 0; all work in this report was local Phase 0 repository scaffolding.
