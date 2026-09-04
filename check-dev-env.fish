#!/usr/bin/env -S fish --no-config
set -g failures 0
function require_path
    if not test -e $argv[1]
        echo "MISSING: $argv[1]"
        set -g failures (math $failures + 1)
    end
end
for path in Cargo.toml Cargo.lock rust-toolchain.toml mise.toml hk.pkl deny.toml .gitleaks.toml AGENTS.md CLAUDE.md docs/ARCHITECTURE.md CONTRIBUTING.md LICENSE CHANGELOG.md docs/MISTAKES.md docs/LEARNINGS.md docs/DESIRES.md docs/factory-improvements.md .agents/setup .agents/resume .amp/plugins/factory/index.ts
    require_path $path
end
for crate in deadmanssnitch mcp-deadmanssnitch deadmanssnitch-twin deadmanssnitch-conformance
    require_path crates/$crate/Cargo.toml
end
for guard in rust-code testing-and-proof tool-contract-stability errors-and-retries dependencies twin-fidelity
    require_path docs/guardrails/$guard.md
end
for runbook in twin-drift dependency-sweep release security-red-team doc-drift coverage-ratchet flake-hunter refactor qa-explorer factory-improvement loop-health
    require_path docs/automations/$runbook.md
end
for removed in .python-version .pre-commit-config.yaml .envrc .claude
    if test -e $removed
        echo "PYTHON REMNANT: $removed"
        set failures (math $failures + 1)
    end
end
if test -f .env; and grep -q '^DEADMANSSNITCH_API_KEY=' .env
    echo 'INVALID ENV: use DEADMANSNITCH_API_KEY'
    set failures (math $failures + 1)
end
if not grep -q '^rust = "1.88.0"' mise.toml; or not grep -q '^channel = "1.88.0"' rust-toolchain.toml
    echo 'TOOLCHAIN DRIFT: mise and rust-toolchain must both pin 1.88.0'
    set failures (math $failures + 1)
end
if not cargo metadata --no-deps --format-version 1 >/dev/null
    echo 'FAILED: cargo metadata'
    set failures (math $failures + 1)
end
if not hk config dump >/dev/null
    echo 'FAILED: hk config dump'
    set -g failures (math $failures + 1)
end
if test $failures -eq 0
    echo 'Phase 0 development environment checks passed.'
else
    echo "$failures Phase 0 development environment check(s) failed."
end
exit $failures
